-- ============================================================
-- HOTFIX: is_on_hold=FALSE Filter in Lead-Zuweisungs-RPCs
-- ============================================================
-- Migration 0015_fix_rpcs_is_deleted_filter.sql hat die RPCs
-- neu erstellt, dabei aber den is_on_hold Filter vergessen,
-- der in Migration 0006 / 0007 vorhanden war.
--
-- Folge:
--   1. Gehaltene Leads (is_on_hold=TRUE) wurden im Pool als
--      verfügbar gezählt und an Verkäufer zugewiesen.
--   2. Wartelisten-Logik im Frontend hat fälschlicherweise
--      zu "kein Lead verfügbar" geführt, obwohl neue
--      Leads vorhanden waren.
--
-- Ausführen im Supabase Dashboard → SQL Editor.
-- ============================================================

-- (1) assign_lead_to_seller — manuelle Admin-Zuweisung
CREATE OR REPLACE FUNCTION public.assign_lead_to_seller(
  p_lead_id UUID,
  p_seller_id UUID,
  p_charge_token BOOLEAN DEFAULT TRUE
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cost INT := 1;
  v_wallet public.token_wallets%ROWTYPE;
  v_lead public.leads%ROWTYPE;
BEGIN
  SELECT * INTO v_lead FROM public.leads
    WHERE id = p_lead_id
      AND is_deleted = FALSE
      AND is_on_hold = FALSE
    FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v_lead.assigned_user_id IS NOT NULL THEN RETURN FALSE; END IF;

  IF p_charge_token THEN
    SELECT * INTO v_wallet FROM public.token_wallets
      WHERE user_id = p_seller_id FOR UPDATE;
    IF NOT FOUND THEN RETURN FALSE; END IF;
    IF v_wallet.balance < v_cost THEN RETURN FALSE; END IF;

    UPDATE public.token_wallets
      SET balance = balance - v_cost, updated_at = NOW()
      WHERE id = v_wallet.id;

    INSERT INTO public.token_transactions
      (wallet_id, user_id, amount, type, reason, lead_id, created_by, created_at)
    VALUES (
      v_wallet.id, p_seller_id, -v_cost, 'abbuchung',
      'Lead-Zuweisung', p_lead_id, p_seller_id, NOW()
    );
  END IF;

  UPDATE public.leads SET
    assigned_user_id = p_seller_id,
    assigned_at = NOW(),
    updated_at = NOW()
  WHERE id = p_lead_id;

  RETURN TRUE;
END $$;

-- (2) assign_next_lead_to_user — automatische Zuweisung
--     HIER liegt der Hauptfehler: Ohne is_on_hold=FALSE
--     wurden gehaltene Leads aus dem Pool zugewiesen.
CREATE OR REPLACE FUNCTION public.assign_next_lead_to_user(
  p_user_id UUID,
  p_product TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cost INT := 1;
  v_wallet public.token_wallets%ROWTYPE;
  v_lead_id UUID;
BEGIN
  SELECT * INTO v_wallet FROM public.token_wallets
    WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WALLET_NOT_FOUND'; END IF;
  IF v_wallet.balance < v_cost THEN RAISE EXCEPTION 'NOT_ENOUGH_TOKENS'; END IF;

  WITH pool AS (
    SELECT id FROM public.leads
    WHERE assigned_user_id IS NULL
      AND is_deleted = FALSE
      AND is_on_hold = FALSE
      AND status NOT IN ('canceled','wrong_data','no_interest','closed')
      AND (p_product IS NULL OR product = p_product OR product = 'beides')
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.leads l
    SET assigned_user_id = p_user_id,
        assigned_at = NOW(),
        status = CASE WHEN l.status = 'new' THEN 'assigned' ELSE l.status END,
        updated_at = NOW()
  FROM pool p WHERE l.id = p.id
  RETURNING l.id INTO v_lead_id;

  IF v_lead_id IS NULL THEN RAISE EXCEPTION 'NO_LEAD_AVAILABLE'; END IF;

  UPDATE public.token_wallets
    SET balance = balance - v_cost, updated_at = NOW()
  WHERE id = v_wallet.id;

  INSERT INTO public.token_transactions
    (wallet_id, user_id, amount, type, reason, lead_id, created_by, created_at)
  VALUES (
    v_wallet.id, p_user_id, -v_cost, 'abbuchung',
    'Automatische Lead-Zuweisung', v_lead_id, p_user_id, NOW()
  );

  PERFORM public.log_activity_feed(p_user_id, 'lead_assigned', v_lead_id, NULL);

  RETURN v_lead_id;
END $$;

-- (3) Berechtigungen neu setzen (DROP + RE-CREATE erzwingt,
--     dass alte GRANTs nicht mehr greifen – hier explizit).
REVOKE ALL ON FUNCTION public.assign_lead_to_seller(UUID,UUID,BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_next_lead_to_user(UUID,TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.assign_lead_to_seller(UUID,UUID,BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.assign_next_lead_to_user(UUID,TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION public.assign_next_lead_to_user IS 'V3 – is_deleted + is_on_hold Filter';
COMMENT ON FUNCTION public.assign_lead_to_seller IS 'V3 – is_deleted + is_on_hold Filter';

-- (4) Diagnose-Query: Prüfe, ob die Migration geklappt hat.
--     Ergebnis: assign_next_lead_to_user und assign_lead_to_seller
--     sollten in pg_proc "is_on_hold" in prosrc enthalten.
SELECT
  proname AS funktion,
  CASE WHEN prosrc ILIKE '%is_on_hold = FALSE%' THEN 'OK ✅' ELSE 'FEHLT ❌' END AS status
FROM pg_proc
WHERE proname IN ('assign_next_lead_to_user','assign_lead_to_seller');
