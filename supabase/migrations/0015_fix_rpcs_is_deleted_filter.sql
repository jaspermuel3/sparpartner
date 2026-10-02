-- ============================================================
-- 0015: RPCs mit is_deleted=FALSE Filter + Token-Reset konsistent
-- ============================================================
-- Migration 0012 hat is_deleted Spalte hinzugefügt, aber die
-- bestehenden SQL-RPCs (aus 0001 + 0006 + 0007) nicht angepasst.
-- Ergebnis: Gelöschte Leads konnten erneut zugewiesen werden.
-- ============================================================

-- =====================================================================
-- (PRE) NUKING ALL OVERLOADS – egal welche Signatur!
-- =====================================================================
-- Grund für 42725: Mehrere Überladungen pro Funktionsname vorhanden,
-- angelegt aus Migrationen 0001 / 0006 / 0007 (DEFAULT-Parameter sorgt
-- dafür, dass CREATE OR REPLACE manchmal neue statt ersetzt).
--
-- Lösung: Hole via pg_proc + pg_namespace jede Überladung einzeln,
-- baue den korrekten DROP Befehl mit Argument-Types und führe ihn
-- per EXECUTE aus + CASCADE → danach wirklich keine Überladungen mehr.
-- =====================================================================
DO $$
DECLARE
  v_fns TEXT[] := ARRAY[
    'assign_lead_to_seller',
    'reset_lead',
    'assign_next_lead_to_user',
    'get_lead_status_distribution',
    'get_contact_time_heatmap'
  ];
  v_fn TEXT;
  v_rec RECORD;
  v_drop TEXT;
BEGIN
  FOREACH v_fn IN ARRAY v_fns LOOP
    FOR v_rec IN
      SELECT
        p.oid AS proc_oid,
        p.proname AS proc_name,
        pg_catalog.pg_get_function_identity_arguments(p.oid) AS arg_list
      FROM pg_catalog.pg_proc p
      JOIN pg_catalog.pg_namespace n
        ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = v_fn
    LOOP
      v_drop := format(
        'DROP FUNCTION IF EXISTS public.%I(%s) CASCADE;',
        v_rec.proc_name,
        v_rec.arg_list
      );
      RAISE NOTICE 'Drop: %', v_drop;
      EXECUTE v_drop;
    END LOOP;
  END LOOP;
END $$;

-- (1) assign_lead_to_seller — NUR aktive, NICHT gelöschte Leads!
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
      AND is_deleted = FALSE       -- <-- FIXED!
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

-- (2) reset_lead — NUR bei nicht-gelöschten Leads sinnvoll
CREATE OR REPLACE FUNCTION public.reset_lead(
  p_lead_id UUID,
  p_refund BOOLEAN DEFAULT FALSE,
  p_by UUID DEFAULT NULL
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_wallet public.token_wallets%ROWTYPE;
BEGIN
  SELECT * INTO v_lead FROM public.leads
    WHERE id = p_lead_id
      AND is_deleted = FALSE       -- <-- FIXED!
    FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v_lead.assigned_user_id IS NULL THEN RETURN TRUE; END IF;

  IF p_refund THEN
    SELECT * INTO v_wallet FROM public.token_wallets
      WHERE user_id = v_lead.assigned_user_id FOR UPDATE;
    IF FOUND THEN
      UPDATE public.token_wallets
        SET balance = balance + 1, updated_at = NOW()
        WHERE id = v_wallet.id;

      INSERT INTO public.token_transactions
        (wallet_id, user_id, amount, type, reason, lead_id, created_by, created_at)
      VALUES (
        v_wallet.id, v_lead.assigned_user_id, 1, 'aufladung',
        'Lead-Reset Rückerstattung', p_lead_id,
        COALESCE(p_by, v_lead.assigned_user_id), NOW()
      );
    END IF;
  END IF;

  UPDATE public.leads SET
    assigned_user_id = NULL,
    assigned_at = NULL,
    is_on_hold = FALSE,
    hold_notes = NULL,
    updated_at = NOW()
  WHERE id = p_lead_id;

  RETURN TRUE;
END $$;

-- (3) assign_next_lead_to_user — Pool NUR aus is_deleted=FALSE!
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

-- (4) get_lead_status_distribution — ignoriere gelöschte!
CREATE OR REPLACE FUNCTION public.get_lead_status_distribution()
RETURNS TABLE(status TEXT, count BIGINT) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT l.status::TEXT AS status, COUNT(*) AS count
  FROM public.leads l
  WHERE l.is_deleted = FALSE
  GROUP BY l.status;
END $$;

-- (5) get_contact_time_heatmap — ignoriere gelöschte!
CREATE OR REPLACE FUNCTION public.get_contact_time_heatmap(
  p_user_id UUID,
  p_days INT DEFAULT 56
)
RETURNS TABLE("day" TEXT, dow INT, "hour" INT, attempts BIGINT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    to_char(date_trunc('day', ca.attempt_date AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
    EXTRACT(ISODOW FROM date_trunc('day', ca.attempt_date AT TIME ZONE 'UTC'))::INT AS dow,
    EXTRACT(HOUR FROM ca.attempt_date AT TIME ZONE 'UTC')::INT AS hour,
    COUNT(*)::BIGINT AS attempts
  FROM public.contact_attempts ca
  INNER JOIN public.leads l
    ON l.id = ca.lead_id
   AND l.is_deleted = FALSE
  WHERE ca.user_id = p_user_id
    AND ca.attempt_date >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY 1, 2, 3
  ORDER BY 1, 3;
END $$;

-- (6) permissions
REVOKE ALL ON FUNCTION public.assign_lead_to_seller(UUID,UUID,BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_lead(UUID,BOOLEAN,UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_next_lead_to_user(UUID,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_lead_status_distribution() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_contact_time_heatmap(UUID,INT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.assign_lead_to_seller(UUID,UUID,BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_lead(UUID,BOOLEAN,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.assign_next_lead_to_user(UUID,TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_lead_status_distribution() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_contact_time_heatmap(UUID,INT) TO authenticated, service_role;

COMMENT ON FUNCTION public.assign_next_lead_to_user IS 'V2 – is_deleted = FALSE Filter';
COMMENT ON FUNCTION public.assign_lead_to_seller IS 'V2 – is_deleted = FALSE Filter';
COMMENT ON FUNCTION public.reset_lead IS 'V2 – is_deleted = FALSE Filter';
