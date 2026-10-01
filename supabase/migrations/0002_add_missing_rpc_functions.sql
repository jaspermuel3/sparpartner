-- =============================================
-- Migration 0002: Fehlende RPC-Funktionen ergänzen
-- Wird benötigt für:
--   - Admin: Lead manuell zuweisen / zurücksetzen
--   - Admin: Tokens aufladen / abziehen
--   - Verkäufer: Lead anfordern (Signatur korrigiert / ergänzt)
--
-- WICHTIG (2026-10-01): Alle Funktionen werden ZUERST per DROP
-- entfernt, falls sie mit abweichender Signatur / Parameternamen
-- bereits existieren (PostgreSQL erlaubt keine Parameternamen-
-- Änderung per CREATE OR REPLACE — Error 42P13).
-- =============================================

-- ======================================================================
-- 0) Alte Versionen derselben Funktionen DROP (falls vorhanden)
-- ======================================================================
DROP FUNCTION IF EXISTS public.assign_next_lead_to_user(UUID, TEXT);
DROP FUNCTION IF EXISTS public.assign_next_lead_to_user(UUID, UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.assign_lead_to_seller(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS public.assign_lead_to_seller(UUID, UUID, UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.reset_lead(UUID, UUID);
DROP FUNCTION IF EXISTS public.reset_lead(UUID, UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.credit_tokens(UUID, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.credit_tokens(UUID, INTEGER, TEXT, UUID);
DROP FUNCTION IF EXISTS public.debit_tokens(UUID, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.debit_tokens(UUID, INTEGER, TEXT, UUID);
DROP FUNCTION IF EXISTS public.get_lead_status_distribution();
DROP FUNCTION IF EXISTS public.get_leads_per_day(INTEGER);
DROP FUNCTION IF EXISTS public.get_admin_dashboard_stats();
DROP FUNCTION IF EXISTS public.find_duplicate_leads(TEXT);
DROP FUNCTION IF EXISTS public.get_contact_time_heatmap(UUID, INTEGER);

-- ======================================================================
-- 1) assign_next_lead_to_user — mit optionaler p_product-Filterung
-- ======================================================================
CREATE OR REPLACE FUNCTION public.assign_next_lead_to_user(
  p_user_id    UUID,
  p_product    TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_lead_id     UUID;
  v_token_cost  INTEGER := 1;
  v_wallet_id   UUID;
  v_balance     INTEGER;
BEGIN
  SELECT id, balance
    INTO v_wallet_id, v_balance
    FROM public.token_wallets
   WHERE user_id = p_user_id
   LIMIT 1
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND';
  END IF;

  IF v_balance < v_token_cost THEN
    RAISE EXCEPTION 'NOT_ENOUGH_TOKENS';
  END IF;

  SELECT id
    INTO v_lead_id
    FROM public.leads
   WHERE assigned_user_id IS NULL
     AND status = 'new'
     AND (p_product IS NULL
          OR LENGTH(TRIM(p_product)) = 0
          OR p_product = 'all'
          OR p_product = 'beides'
          OR product = (p_product::text)::public.product_type)
   ORDER BY created_at ASC, id ASC
   LIMIT 1
     FOR UPDATE SKIP LOCKED;

  IF v_lead_id IS NULL THEN
    RAISE EXCEPTION 'NO_LEAD_AVAILABLE';
  END IF;

  UPDATE public.leads
     SET assigned_user_id = p_user_id,
         status           = 'assigned'::public.lead_status,
         updated_by       = p_user_id,
         updated_at       = NOW()
   WHERE id = v_lead_id;

  UPDATE public.token_wallets
     SET balance    = balance - v_token_cost,
         updated_at = NOW()
   WHERE id = v_wallet_id;

  INSERT INTO public.token_transactions
    (wallet_id, user_id, amount, type, reason, lead_id, created_by)
  VALUES
    (v_wallet_id, p_user_id, (v_token_cost * -1), 'lead_kauf',
     'Lead-Anfrage (RPC assign_next_lead_to_user)', v_lead_id, NULL);

  RETURN v_lead_id;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- ======================================================================
-- 2) assign_lead_to_seller — Admin weist Lead manuell zu
-- ======================================================================
CREATE OR REPLACE FUNCTION public.assign_lead_to_seller(
  p_lead_id       UUID,
  p_seller_id     UUID,
  p_by_admin_id   UUID,
  p_debit_tokens  BOOLEAN DEFAULT TRUE
) RETURNS VOID AS $$
DECLARE
  v_token_cost  INTEGER := 1;
  v_wallet_id   UUID;
  v_balance     INTEGER;
  v_already     UUID;
BEGIN
  SELECT assigned_user_id INTO v_already
    FROM public.leads
   WHERE id = p_lead_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEAD_NOT_FOUND';
  END IF;

  IF v_already IS NOT NULL THEN
    RAISE EXCEPTION 'LEAD_ALREADY_ASSIGNED';
  END IF;

  IF p_debit_tokens THEN
    SELECT id, balance
      INTO v_wallet_id, v_balance
      FROM public.token_wallets
     WHERE user_id = p_seller_id
     LIMIT 1
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'WALLET_NOT_FOUND';
    END IF;

    IF v_balance < v_token_cost THEN
      RAISE EXCEPTION 'NOT_ENOUGH_TOKENS';
    END IF;

    UPDATE public.token_wallets
       SET balance    = balance - v_token_cost,
           updated_at = NOW()
     WHERE id = v_wallet_id;

    INSERT INTO public.token_transactions
      (wallet_id, user_id, amount, type, reason, lead_id, created_by)
    VALUES
      (v_wallet_id, p_seller_id, (v_token_cost * -1), 'lead_kauf',
       'Manuelle Zuweisung durch Admin', p_lead_id, p_by_admin_id);
  END IF;

  UPDATE public.leads
     SET assigned_user_id = p_seller_id,
         status           = 'assigned'::public.lead_status,
         updated_by       = p_by_admin_id,
         updated_at       = NOW()
   WHERE id = p_lead_id;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- ======================================================================
-- 3) reset_lead — Lead freigeben (Admin), ggf. Token zurück
-- ======================================================================
CREATE OR REPLACE FUNCTION public.reset_lead(
  p_lead_id         UUID,
  p_by_admin_id     UUID,
  p_refund_tokens   BOOLEAN DEFAULT TRUE
) RETURNS VOID AS $$
DECLARE
  v_seller_id   UUID;
  v_token_cost  INTEGER := 1;
  v_wallet_id   UUID;
BEGIN
  SELECT assigned_user_id, COALESCE(token_cost, 1)
    INTO v_seller_id, v_token_cost
    FROM public.leads
   WHERE id = p_lead_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEAD_NOT_FOUND';
  END IF;

  IF p_refund_tokens AND v_seller_id IS NOT NULL THEN
    SELECT id INTO v_wallet_id
      FROM public.token_wallets
     WHERE user_id = v_seller_id
     LIMIT 1
       FOR UPDATE;

    IF v_wallet_id IS NOT NULL THEN
      UPDATE public.token_wallets
         SET balance    = balance + v_token_cost,
             updated_at = NOW()
       WHERE id = v_wallet_id;

      INSERT INTO public.token_transactions
        (wallet_id, user_id, amount, type, reason, lead_id, created_by)
      VALUES
        (v_wallet_id, v_seller_id, v_token_cost, 'rueckerstattung',
         'Lead-Reset durch Admin', p_lead_id, p_by_admin_id);
    END IF;
  END IF;

  UPDATE public.leads
     SET assigned_user_id = NULL,
         status           = 'new'::public.lead_status,
         updated_by       = p_by_admin_id,
         updated_at       = NOW()
   WHERE id = p_lead_id;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- ======================================================================
-- 4) credit_tokens / debit_tokens — direkte Wallet-Operationen
-- ======================================================================
CREATE OR REPLACE FUNCTION public.credit_tokens(
  p_user_id     UUID,
  p_amount      INTEGER,
  p_reason      TEXT,
  p_by_admin_id UUID DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  v_wallet_id  UUID;
  v_new_bal    INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'AMOUNT_MUST_BE_POSITIVE';
  END IF;

  SELECT id INTO v_wallet_id
    FROM public.token_wallets
   WHERE user_id = p_user_id
   LIMIT 1
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND';
  END IF;

  UPDATE public.token_wallets
     SET balance    = balance + p_amount,
         updated_at = NOW()
   WHERE id = v_wallet_id
   RETURNING balance INTO v_new_bal;

  INSERT INTO public.token_transactions
    (wallet_id, user_id, amount, type, reason, created_by)
  VALUES
    (v_wallet_id, p_user_id, p_amount, 'aufladung', p_reason, p_by_admin_id);

  RETURN v_new_bal;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.debit_tokens(
  p_user_id     UUID,
  p_amount      INTEGER,
  p_reason      TEXT,
  p_by_admin_id UUID DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  v_wallet_id  UUID;
  v_balance    INTEGER;
  v_new_bal    INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'AMOUNT_MUST_BE_POSITIVE';
  END IF;

  SELECT id, balance
    INTO v_wallet_id, v_balance
    FROM public.token_wallets
   WHERE user_id = p_user_id
   LIMIT 1
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND';
  END IF;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'NOT_ENOUGH_TOKENS';
  END IF;

  UPDATE public.token_wallets
     SET balance    = balance - p_amount,
         updated_at = NOW()
   WHERE id = v_wallet_id
   RETURNING balance INTO v_new_bal;

  INSERT INTO public.token_transactions
    (wallet_id, user_id, amount, type, reason, created_by)
  VALUES
    (v_wallet_id, p_user_id, (p_amount * -1), 'korrektur_minus',
     p_reason, p_by_admin_id);

  RETURN v_new_bal;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- ======================================================================
-- 5) Aggregations-RPCs — Admin-Dashboard
-- ======================================================================
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

CREATE OR REPLACE FUNCTION public.get_leads_per_day(p_days INTEGER DEFAULT 7)
RETURNS TABLE (date_label TEXT, new_count BIGINT, closed_count BIGINT) AS $$
DECLARE
  v_start DATE;
  v_d     DATE;
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

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS TABLE (
  new_leads_today    BIGINT,
  available_leads    BIGINT,
  assigned_leads     BIGINT,
  closed_leads       BIGINT,
  lost_leads         BIGINT,
  active_sellers     BIGINT,
  tokens_debit       BIGINT
) AS $$
DECLARE
  v_today_start TIMESTAMPTZ := DATE_TRUNC('day', NOW());
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.leads WHERE created_at >= v_today_start)::BIGINT,
    (SELECT COUNT(*) FROM public.leads WHERE assigned_user_id IS NULL)::BIGINT,
    (SELECT COUNT(*) FROM public.leads WHERE assigned_user_id IS NOT NULL)::BIGINT,
    (SELECT COUNT(*) FROM public.leads WHERE status = 'closed'::public.lead_status)::BIGINT,
    (SELECT COUNT(*) FROM public.leads WHERE status = ANY(ARRAY['no_interest','wrong_data','canceled']::public.lead_status[]))::BIGINT,
    (SELECT COUNT(*) FROM public.users WHERE role = 'seller'::public.user_role AND is_active = TRUE)::BIGINT,
    (SELECT COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0)::BIGINT FROM public.token_transactions);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
