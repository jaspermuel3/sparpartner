-- =============================================
-- Migration 0002: Status-Historie + Atomare RPCs
-- =============================================
-- Fixes:
--  1. Trigger für lead_status_history bei Statusänderung
--  2. RPC assign_next_lead_to_user schreibt jetzt History
--  3. Atomare RPCs: assign_lead_to_seller, reset_lead
--  4. Atomare RPCs: credit_tokens, debit_tokens
--  5. RPCs für Dashboard-Aggregationen (statt client-seitig)
-- =============================================

-- =============================================
-- 1. Trigger: Automatischer Eintrag in lead_status_history
-- =============================================

CREATE OR REPLACE FUNCTION public.track_lead_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.lead_status_history (
      lead_id,
      old_status,
      new_status,
      user_id,
      created_at
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      COALESCE(NEW.updated_by, auth.uid()),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

DROP TRIGGER IF EXISTS leads_track_status ON public.leads;
CREATE TRIGGER leads_track_status
AFTER UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.track_lead_status_change();

-- Optional: Spalte updated_by auf leads ergänzen (für History-Eintrag bei manueller Service-Role Änderung)
DO $$ BEGIN
  ALTER TABLE public.leads ADD COLUMN updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- =============================================
-- 2. RPC: assign_next_lead_to_user - ergänzt um Status-History Eintrag
-- =============================================

CREATE OR REPLACE FUNCTION public.assign_next_lead_to_user(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_lead_id UUID;
  v_cost INTEGER;
  v_wallet_id UUID;
  v_balance INTEGER;
BEGIN
  -- Wallet des Users laden und sperren
  SELECT id, balance INTO v_wallet_id, v_balance
  FROM public.token_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_WALLET';
  END IF;

  -- Ältesten verfügbaren Lead holen und sperren (FIFO)
  SELECT id, COALESCE(token_cost, 1) INTO v_lead_id, v_cost
  FROM public.leads
  WHERE status = 'new' AND assigned_user_id IS NULL
  ORDER BY created_at ASC, id ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_lead_id IS NULL THEN
    RAISE EXCEPTION 'NO_LEAD';
  END IF;

  IF v_balance < v_cost THEN
    RAISE EXCEPTION 'NOT_ENOUGH_TOKENS';
  END IF;

  -- Lead zuweisen (Trigger erstellt Status-History new->assigned automatisch)
  UPDATE public.leads
  SET assigned_user_id = p_user_id,
      status = 'assigned'::public.lead_status,
      updated_by = p_user_id
  WHERE id = v_lead_id;

  -- Wallet abbuchen
  UPDATE public.token_wallets
  SET balance = balance - v_cost
  WHERE id = v_wallet_id;

  -- Token-Transaktion erstellen (Lead-Kauf)
  INSERT INTO public.token_transactions (wallet_id, user_id, amount, type, reason, lead_id, created_by)
  VALUES (v_wallet_id, p_user_id, -v_cost, 'lead_kauf'::public.token_transaction_type, 'Lead angefordert', v_lead_id, p_user_id);

  -- Status-History explizit sicherstellen (für den Fall, dass Trigger noch nicht aktiv war)
  INSERT INTO public.lead_status_history (lead_id, old_status, new_status, user_id, created_at)
  SELECT v_lead_id, 'new'::public.lead_status, 'assigned'::public.lead_status, p_user_id, NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.lead_status_history h
    WHERE h.lead_id = v_lead_id AND h.new_status = 'assigned'::public.lead_status
  );

  RETURN v_lead_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- =============================================
-- 3a. RPC: assign_lead_to_seller (Admin - manuelle Zuweisung atomar)
-- =============================================

CREATE OR REPLACE FUNCTION public.assign_lead_to_seller(
  p_lead_id UUID,
  p_seller_id UUID,
  p_by_user_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_lead_status public.lead_status;
  v_assigned UUID;
  v_cost INTEGER;
  v_wallet_id UUID;
  v_balance INTEGER;
BEGIN
  -- Lead sperren
  SELECT status, assigned_user_id, COALESCE(token_cost, 1)
    INTO v_lead_status, v_assigned, v_cost
  FROM public.leads
  WHERE id = p_lead_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEAD_NOT_FOUND';
  END IF;
  IF v_assigned IS NOT NULL THEN
    RAISE EXCEPTION 'ALREADY_ASSIGNED';
  END IF;

  -- Wallet des Verkäufers sperren
  SELECT id, balance INTO v_wallet_id, v_balance
  FROM public.token_wallets
  WHERE user_id = p_seller_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND';
  END IF;
  IF v_balance < v_cost THEN
    RAISE EXCEPTION 'NOT_ENOUGH_TOKENS';
  END IF;

  -- Alles atomar durchführen
  UPDATE public.leads
  SET assigned_user_id = p_seller_id,
      status = 'assigned'::public.lead_status,
      updated_by = p_by_user_id
  WHERE id = p_lead_id;

  UPDATE public.token_wallets
  SET balance = balance - v_cost
  WHERE id = v_wallet_id;

  INSERT INTO public.token_transactions (wallet_id, user_id, amount, type, reason, lead_id, created_by)
  VALUES (
    v_wallet_id,
    p_seller_id,
    -v_cost,
    'lead_kauf'::public.token_transaction_type,
    'Manuelle Zuweisung durch Admin',
    p_lead_id,
    p_by_user_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- =============================================
-- 3b. RPC: reset_lead (Admin - Lead zurücksetzen, ggf. Token erstatten)
-- =============================================

CREATE OR REPLACE FUNCTION public.reset_lead(
  p_lead_id UUID,
  p_by_user_id UUID,
  p_refund BOOLEAN DEFAULT TRUE
)
RETURNS VOID AS $$
DECLARE
  v_prev_user UUID;
  v_cost INTEGER;
  v_wallet_id UUID;
BEGIN
  SELECT assigned_user_id, COALESCE(token_cost, 1)
    INTO v_prev_user, v_cost
  FROM public.leads
  WHERE id = p_lead_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEAD_NOT_FOUND';
  END IF;

  -- Token erstatten, falls gefordert und vorher zugewiesen
  IF p_refund AND v_prev_user IS NOT NULL THEN
    SELECT id INTO v_wallet_id
    FROM public.token_wallets
    WHERE user_id = v_prev_user
    FOR UPDATE;

    IF v_wallet_id IS NOT NULL THEN
      UPDATE public.token_wallets
      SET balance = balance + v_cost
      WHERE id = v_wallet_id;

      INSERT INTO public.token_transactions (wallet_id, user_id, amount, type, reason, lead_id, created_by)
      VALUES (
        v_wallet_id,
        v_prev_user,
        v_cost,
        'rueckerstattung'::public.token_transaction_type,
        'Lead zurückgesetzt durch Admin',
        p_lead_id,
        p_by_user_id
      );
    END IF;
  END IF;

  UPDATE public.leads
  SET assigned_user_id = NULL,
      status = 'new'::public.lead_status,
      updated_by = p_by_user_id
  WHERE id = p_lead_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- =============================================
-- 4a. RPC: credit_tokens (Admin - Token gut-/abschreiben, atomar)
-- =============================================

CREATE OR REPLACE FUNCTION public.credit_tokens(
  p_target_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_type public.token_transaction_type DEFAULT 'aufladung'::public.token_transaction_type,
  p_created_by UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_wallet_id UUID;
  v_old_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'AMOUNT_MUST_BE_POSITIVE';
  END IF;

  SELECT id, balance INTO v_wallet_id, v_old_balance
  FROM public.token_wallets
  WHERE user_id = p_target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND';
  END IF;

  v_new_balance := v_old_balance + p_amount;

  UPDATE public.token_wallets
  SET balance = v_new_balance
  WHERE id = v_wallet_id;

  INSERT INTO public.token_transactions (wallet_id, user_id, amount, type, reason, created_by)
  VALUES (v_wallet_id, p_target_user_id, p_amount, p_type, p_reason, p_created_by);

  RETURN v_new_balance;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- =============================================
-- 4b. RPC: debit_tokens (Admin - Token abziehen, atomar)
-- =============================================

CREATE OR REPLACE FUNCTION public.debit_tokens(
  p_target_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_type public.token_transaction_type DEFAULT 'korrektur_minus'::public.token_transaction_type,
  p_created_by UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_wallet_id UUID;
  v_old_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'AMOUNT_MUST_BE_POSITIVE';
  END IF;

  SELECT id, balance INTO v_wallet_id, v_old_balance
  FROM public.token_wallets
  WHERE user_id = p_target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND';
  END IF;
  IF v_old_balance < p_amount THEN
    RAISE EXCEPTION 'NOT_ENOUGH_TOKENS';
  END IF;

  v_new_balance := v_old_balance - p_amount;

  UPDATE public.token_wallets
  SET balance = v_new_balance
  WHERE id = v_wallet_id;

  INSERT INTO public.token_transactions (wallet_id, user_id, amount, type, reason, created_by)
  VALUES (v_wallet_id, p_target_user_id, -p_amount, p_type, p_reason, p_created_by);

  RETURN v_new_balance;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- =============================================
-- 5a. RPC: get_lead_status_distribution (Aggregation statt Client-Loop)
-- =============================================

CREATE OR REPLACE FUNCTION public.get_lead_status_distribution()
RETURNS TABLE (status public.lead_status, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT l.status::public.lead_status, COUNT(*)::BIGINT
  FROM public.leads l
  GROUP BY l.status
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =============================================
-- 5b. RPC: get_leads_per_day (letzte N Tage)
-- =============================================

CREATE OR REPLACE FUNCTION public.get_leads_per_day(p_days INTEGER DEFAULT 7)
RETURNS TABLE (date_label TEXT, new_count BIGINT, closed_count BIGINT) AS $$
DECLARE
  v_start DATE;
  v_d DATE;
BEGIN
  v_start := CURRENT_DATE - (p_days - 1);

  CREATE TEMP TABLE IF NOT EXISTS _calendar (d DATE PRIMARY KEY) ON COMMIT DROP;
  TRUNCATE TABLE _calendar;

  v_d := v_start;
  WHILE v_d <= CURRENT_DATE LOOP
    INSERT INTO _calendar (d) VALUES (v_d);
    v_d := v_d + 1;
  END LOOP;

  RETURN QUERY
  SELECT
    TO_CHAR(c.d, 'YYYY-MM-DD')::TEXT AS date_label,
    COALESCE(lc.cnt, 0)::BIGINT AS new_count,
    COALESCE(cc.cnt, 0)::BIGINT AS closed_count
  FROM _calendar c
  LEFT JOIN (
    SELECT DATE(created_at) AS d, COUNT(*) AS cnt
    FROM public.leads
    WHERE DATE(created_at) >= v_start
    GROUP BY DATE(created_at)
  ) lc ON lc.d = c.d
  LEFT JOIN (
    SELECT DATE(h.created_at) AS d, COUNT(*) AS cnt
    FROM public.lead_status_history h
    WHERE h.new_status = 'closed'::public.lead_status
      AND DATE(h.created_at) >= v_start
    GROUP BY DATE(h.created_at)
  ) cc ON cc.d = c.d
  ORDER BY c.d ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =============================================
-- 5c. RPC: get_admin_dashboard_stats
-- =============================================

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS TABLE (
  new_leads_today BIGINT,
  available_leads BIGINT,
  assigned_leads BIGINT,
  closed_leads BIGINT,
  lost_leads BIGINT,
  active_sellers BIGINT,
  tokens_debit BIGINT
) AS $$
DECLARE
  v_today_start TIMESTAMPTZ := DATE_TRUNC('day', NOW());
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.leads WHERE created_at >= v_today_start)::BIGINT AS new_leads_today,
    (SELECT COUNT(*) FROM public.leads WHERE assigned_user_id IS NULL)::BIGINT AS available_leads,
    (SELECT COUNT(*) FROM public.leads WHERE assigned_user_id IS NOT NULL)::BIGINT AS assigned_leads,
    (SELECT COUNT(*) FROM public.leads WHERE status = 'closed'::public.lead_status)::BIGINT AS closed_leads,
    (SELECT COUNT(*) FROM public.leads WHERE status IN ('no_interest','wrong_data','canceled'::public.lead_status))::BIGINT AS lost_leads,
    (SELECT COUNT(*) FROM public.users WHERE role = 'seller'::public.user_role AND is_active = TRUE)::BIGINT AS active_sellers,
    (SELECT COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0)::BIGINT FROM public.token_transactions) AS tokens_debit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
