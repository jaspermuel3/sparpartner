-- =============================================
-- Migration 0003: assigned_at + Status-Sync Korrekturen
--
-- Worum es geht:
-- 1) Die Tabelle "leads" hat bisher keine assigned_at-Spalte,
--    obwohl Sortierung/Filter nach "Zugewiesen am" in der UI
--    (Meine Leads) angeboten wird → leads.sort assigned_at
--    führt dann zu stillschweigendem Fallback auf created_at.
-- 2) Nach jedem Kontaktversuch (Callback / "kontaktiert")
--    wird die Status-Spalte bisher nicht aktualisiert →
--    die Leads bleiben bei status='assigned', obwohl es
--    bereits einen neuen Kontaktversuch gab.
-- 3) assign_next_lead_to_user wird hier ebenfalls nochmals
--    überschrieben mit einer robusteren Fassung (ohne
--    p_product::product_type-Cast, der bei NULL/Werten
--    wie 'beides' fehlschlagen kann).
-- =============================================

-- ---------------------------------------------
-- 1) Spalte assigned_at ergänzen (idempotent)
-- ---------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'leads'
       AND column_name  = 'assigned_at'
  ) THEN
    ALTER TABLE public.leads
      ADD COLUMN assigned_at TIMESTAMPTZ;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_assigned_at
  ON public.leads(assigned_at);

-- ---------------------------------------------
-- 2) assigned_at für bereits zugewiesene Leads
--    nachträglich füllen (aus lead_status_history
--    oder created_at als Fallback)
-- ---------------------------------------------
UPDATE public.leads
   SET assigned_at = COALESCE(
         (SELECT lsh.created_at
            FROM public.lead_status_history lsh
           WHERE lsh.lead_id   = leads.id
             AND lsh.new_status = 'assigned'
           ORDER BY lsh.created_at ASC
           LIMIT 1),
         created_at
       )
 WHERE assigned_user_id IS NOT NULL
   AND assigned_at IS NULL;

-- ---------------------------------------------
-- 3) Trigger-Funktion: Immer wenn assigned_user_id
--    gesetzt / gelöscht wird → assigned_at anpassen
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_lead_assigned_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Fall: Neu zugewiesen
  IF NEW.assigned_user_id IS NOT NULL AND
     (OLD.assigned_user_id IS NULL OR OLD.assigned_user_id <> NEW.assigned_user_id) THEN
    NEW.assigned_at := NOW();
  END IF;

  -- Fall: Zuweisung aufgehoben (z. B. Lead-Reset)
  IF NEW.assigned_user_id IS NULL AND OLD.assigned_user_id IS NOT NULL THEN
    NEW.assigned_at := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE;

DROP TRIGGER IF EXISTS trg_leads_sync_assigned_at ON public.leads;
CREATE TRIGGER trg_leads_sync_assigned_at
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.sync_lead_assigned_at();

-- ---------------------------------------------
-- 4) Trigger-Funktion: Nach INSERT einer
--    Kontaktversuchs → Lead-Status auf 'contacted'
--    (nur falls aktuell 'assigned' oder 'new'),
--    UND assigned_user_id bleibt dabei erhalten.
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_lead_status_after_contact_attempt()
RETURNS TRIGGER AS $$
DECLARE
  v_current_status public.lead_status;
  v_assigned_user   UUID;
BEGIN
  SELECT status, assigned_user_id
    INTO v_current_status, v_assigned_user
    FROM public.leads
   WHERE id = NEW.lead_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Status auf 'contacted' heben, falls noch vorheriger Initialzustand.
  IF v_current_status IN ('assigned', 'new') THEN
    UPDATE public.leads
       SET status         = 'contacted'
     WHERE id             = NEW.lead_id
       AND status         = v_current_status
       AND assigned_user_id IS NOT DISTINCT FROM v_assigned_user;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE;

DROP TRIGGER IF EXISTS trg_contact_attempts_sync_status ON public.contact_attempts;
CREATE TRIGGER trg_contact_attempts_sync_status
AFTER INSERT ON public.contact_attempts
FOR EACH ROW
EXECUTE FUNCTION public.sync_lead_status_after_contact_attempt();

-- ---------------------------------------------
-- 5) Trigger-Funktion: Nach INSERT eines
--    Rückrufs → Lead-Status auf 'callback'
--    (nicht aber, wenn er bereits weiter
--    fortgeschritten ist, z. B. 'closed')
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_lead_status_after_callback_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_current_status public.lead_status;
BEGIN
  SELECT status INTO v_current_status
    FROM public.leads
   WHERE id = NEW.lead_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'offen' AND
     v_current_status IN ('new', 'assigned', 'contacted') THEN
    UPDATE public.leads
       SET status = 'callback'
     WHERE id = NEW.lead_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE;

DROP TRIGGER IF EXISTS trg_callbacks_sync_status_insert ON public.callbacks;
CREATE TRIGGER trg_callbacks_sync_status_insert
AFTER INSERT ON public.callbacks
FOR EACH ROW
EXECUTE FUNCTION public.sync_lead_status_after_callback_insert();

-- ---------------------------------------------
-- 6) assign_next_lead_to_user (nochmal sicher
--    überschrieben): p_product wird ohne
--    riskanten ::product_type-Cast verarbeitet.
--    DIESE Fassung hat VORRANG vor 0001/0002.
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_next_lead_to_user(
  p_user_id UUID,
  p_product TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_lead_id  UUID;
  v_cost     INTEGER;
  v_wallet_id UUID;
  v_balance  INTEGER;
BEGIN
  SELECT id, balance INTO v_wallet_id, v_balance
    FROM public.token_wallets
   WHERE user_id = p_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_WALLET';
  END IF;

  SELECT id, COALESCE(token_cost, 1)
    INTO v_lead_id, v_cost
    FROM public.leads
   WHERE status = 'new'
     AND assigned_user_id IS NULL
     AND (
       p_product IS NULL
       OR LENGTH(TRIM(p_product)) = 0
       OR p_product = 'all'
       OR p_product = 'beides'
       OR product = (p_product::text)::public.product_type
     )
   ORDER BY created_at ASC, id ASC
   LIMIT 1
     FOR UPDATE SKIP LOCKED;

  IF v_lead_id IS NULL THEN
    RAISE EXCEPTION 'NO_LEAD';
  END IF;

  IF v_balance < v_cost THEN
    RAISE EXCEPTION 'NOT_ENOUGH_TOKENS';
  END IF;

  UPDATE public.leads
     SET assigned_user_id = p_user_id,
         status = 'assigned'
   WHERE id = v_lead_id;

  UPDATE public.token_wallets
     SET balance = balance - v_cost
   WHERE id = v_wallet_id;

  INSERT INTO public.token_transactions
    (wallet_id, user_id, amount, type, reason, lead_id, created_by)
  VALUES
    (v_wallet_id, p_user_id, -v_cost, 'lead_kauf', 'Lead angefordert', v_lead_id, p_user_id);

  RETURN v_lead_id;
EXCEPTION
  WHEN OTHERS THEN RAISE;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;
