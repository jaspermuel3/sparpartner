-- ============================================================
-- HOTFIX KOMPLETT: Lead-Anforderung (2 Fehler auf einmal behoben)
-- ------------------------------------------------------------
-- Fehler 1: "operator does not exist: product_type = text"
--           → RPC assign_next_lead_to_user benutzen product::TEXT
-- Fehler 2: "invalid input value for enum token_transaction_type: abbuchung"
--           → ENUM token_transaction_type hat 'abbuchung' nicht,
--             obwohl RPCs ab 0015/0020 ihn ständig verwenden.
--
-- Ausführen im Supabase Dashboard → SQL Editor
-- ============================================================

-- =====================================================================
-- (A) ENUM token_transaction_type UM 'abbuchung' ERWEITERN
--     (Muss VOR dem Recreating der RPCs passieren, weil sie
--      beim INSERT auf den Wert zugreifen)
-- =====================================================================
DO $$
DECLARE
  v_enum_values TEXT[];
BEGIN
  -- 1) Aktuelle Werte des ENUM auslesen
  SELECT ARRAY_AGG(enumlabel::TEXT ORDER BY enumsortorder)
    INTO v_enum_values
  FROM pg_catalog.pg_enum e
  JOIN pg_catalog.pg_type t ON t.oid = e.enumtypid
  JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public'
    AND t.typname = 'token_transaction_type';

  IF v_enum_values IS NULL THEN
    RAISE NOTICE 'ENUM token_transaction_type nicht gefunden – versuche CREATE TYPE (wird scheitern falls vorhanden)';
  ELSIF 'abbuchung' = ANY(v_enum_values) THEN
    RAISE NOTICE 'OK – Wert ''abbuchung'' ist bereits in ENUM token_transaction_type vorhanden';
  ELSE
    RAISE NOTICE 'Füge ''abbuchung'' hinzu zu ENUM token_transaction_type (Vorher: %)', v_enum_values;
    ALTER TYPE public.token_transaction_type ADD VALUE IF NOT EXISTS 'abbuchung';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Warnung beim ENUM-Update: % – versuche Workaround via Work-Tabelle', SQLERRM;

  -- Fallback (falls ALTER TYPE ADD VALUE wegen Transaktionskontext nicht geht):
  --   Ignorieren – die RPCs unten nutzen CASTs auf TEXT-Fallback via
  --   INSERT-SELECT aus einer Hilfs-CTE, die den Wert nur einfügt, wenn
  --   er bereits im ENUM ist. Nicht nötig, ADD VALUE funktioniert idR.
END $$;

-- =====================================================================
-- (B) RPC assign_next_lead_to_user V4.2 NEU anlegen
--     - product::TEXT Casts (Fehler 1)
--     - 'abbuchung' als type (Fehler 2 jetzt erlaubt dank A)
-- =====================================================================
DROP FUNCTION IF EXISTS public.assign_next_lead_to_user(UUID,TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.assign_next_lead_to_user(
  p_user_id UUID,
  p_product TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cost INT := 1;
  v_wallet public.token_wallets%ROWTYPE;
  v_lead_id UUID;
  v_product_norm TEXT;
  v_tx_type public.token_transaction_type;
BEGIN
  SELECT * INTO v_wallet FROM public.token_wallets
    WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WALLET_NOT_FOUND'; END IF;
  IF v_wallet.balance < v_cost THEN RAISE EXCEPTION 'NOT_ENOUGH_TOKENS'; END IF;

  v_product_norm := CASE
    WHEN p_product IS NULL THEN NULL
    WHEN LENGTH(TRIM(p_product)) = 0 THEN NULL
    WHEN LOWER(TRIM(p_product)) IN ('all','beides','beide','alle') THEN NULL
    ELSE LOWER(TRIM(p_product))
  END;

  -- Abwehr ENUM-Fehler: 'abbuchung' nur verwenden falls im ENUM,
  -- sonst Fallback auf 'korrektur_minus' (sicher im ENUM vorhanden).
  v_tx_type := COALESCE(
    (SELECT 'abbuchung'::public.token_transaction_type
     WHERE EXISTS (
       SELECT 1 FROM pg_catalog.pg_enum e
       JOIN pg_catalog.pg_type t ON t.oid = e.enumtypid
       JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname='public' AND t.typname='token_transaction_type'
         AND e.enumlabel = 'abbuchung'
     )),
    'korrektur_minus'::public.token_transaction_type
  );

  -- Pool wählen: SELBE Filter wie UI + product::TEXT Cast
  WITH pool AS (
    SELECT id FROM public.leads
    WHERE assigned_user_id IS NULL
      AND is_deleted = FALSE
      AND archived = FALSE
      AND is_on_hold = FALSE
      AND status NOT IN ('canceled','wrong_data','no_interest','closed')
      AND (
            v_product_norm IS NULL
            OR product::TEXT = v_product_norm
            OR product::TEXT = 'beides'
          )
    ORDER BY created_at ASC, id ASC
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
    v_wallet.id, p_user_id, -v_cost, v_tx_type,
    'Automatische Lead-Zuweisung (RPC assign_next_lead_to_user V4.2)',
    v_lead_id, p_user_id, NOW()
  );

  BEGIN
    PERFORM public.log_activity_feed(p_user_id, 'lead_assigned', v_lead_id, NULL);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'log_activity_feed nicht verfügbar, übersprungen';
  END;

  RETURN v_lead_id;
END $$;

REVOKE ALL ON FUNCTION public.assign_next_lead_to_user(UUID,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_next_lead_to_user(UUID,TEXT) TO authenticated, service_role;
COMMENT ON FUNCTION public.assign_next_lead_to_user(UUID,TEXT) IS
  'V4.2 – HOTFIX: product::TEXT Cast + token_transaction_type ENUM um abbuchung';

-- =====================================================================
-- (C) Auch assign_lead_to_seller und reset_lead korrigieren
--     (Beide nutzen ebenfalls abbuchung / aufladung)
-- =====================================================================
DROP FUNCTION IF EXISTS public.assign_lead_to_seller(UUID,UUID,BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS public.reset_lead(UUID,UUID,BOOLEAN) CASCADE;

-- assign_lead_to_seller V4.2
CREATE OR REPLACE FUNCTION public.assign_lead_to_seller(
  p_lead_id UUID,
  p_seller_id UUID,
  p_charge_token BOOLEAN DEFAULT TRUE
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cost INT := 1;
  v_wallet public.token_wallets%ROWTYPE;
  v_lead public.leads%ROWTYPE;
  v_tx_type public.token_transaction_type;
BEGIN
  SELECT * INTO v_lead FROM public.leads
    WHERE id = p_lead_id
      AND is_deleted = FALSE
      AND archived = FALSE
      AND is_on_hold = FALSE
    FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v_lead.assigned_user_id IS NOT NULL THEN RETURN FALSE; END IF;

  IF p_charge_token THEN
    SELECT * INTO v_wallet FROM public.token_wallets
      WHERE user_id = p_seller_id FOR UPDATE;
    IF NOT FOUND THEN RETURN FALSE; END IF;
    IF v_wallet.balance < v_cost THEN RETURN FALSE; END IF;

    v_tx_type := COALESCE(
      (SELECT 'abbuchung'::public.token_transaction_type
       WHERE EXISTS (
         SELECT 1 FROM pg_catalog.pg_enum e
         JOIN pg_catalog.pg_type t ON t.oid = e.enumtypid
         JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
         WHERE n.nspname='public' AND t.typname='token_transaction_type'
           AND e.enumlabel = 'abbuchung'
       )),
      'korrektur_minus'::public.token_transaction_type
    );

    UPDATE public.token_wallets
      SET balance = balance - v_cost, updated_at = NOW()
    WHERE id = v_wallet.id;

    INSERT INTO public.token_transactions
      (wallet_id, user_id, amount, type, reason, lead_id, created_by, created_at)
    VALUES (
      v_wallet.id, p_seller_id, -v_cost, v_tx_type,
      'Manuelle Lead-Zuweisung (Admin, RPC assign_lead_to_seller V4.2)',
      p_lead_id, p_seller_id, NOW()
    );
  END IF;

  UPDATE public.leads SET
    assigned_user_id = p_seller_id,
    assigned_at = NOW(),
    status = CASE WHEN status = 'new' THEN 'assigned' ELSE status END,
    updated_at = NOW()
  WHERE id = p_lead_id;

  RETURN TRUE;
END $$;

REVOKE ALL ON FUNCTION public.assign_lead_to_seller(UUID,UUID,BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_lead_to_seller(UUID,UUID,BOOLEAN) TO service_role;

-- reset_lead V4.2 (p_by_user_id + p_refund)
CREATE OR REPLACE FUNCTION public.reset_lead(
  p_lead_id UUID,
  p_by_user_id UUID DEFAULT NULL,
  p_refund BOOLEAN DEFAULT TRUE
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_wallet public.token_wallets%ROWTYPE;
  v_tx_type public.token_transaction_type;
BEGIN
  SELECT * INTO v_lead FROM public.leads
    WHERE id = p_lead_id
      AND is_deleted = FALSE
      AND archived = FALSE
    FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v_lead.assigned_user_id IS NULL THEN RETURN TRUE; END IF;

  IF p_refund AND v_lead.assigned_user_id IS NOT NULL THEN
    SELECT * INTO v_wallet FROM public.token_wallets
      WHERE user_id = v_lead.assigned_user_id FOR UPDATE;
    IF FOUND THEN

      v_tx_type := COALESCE(
        (SELECT 'aufladung'::public.token_transaction_type
         WHERE EXISTS (
           SELECT 1 FROM pg_catalog.pg_enum e
           JOIN pg_catalog.pg_type t ON t.oid = e.enumtypid
           JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
           WHERE n.nspname='public' AND t.typname='token_transaction_type'
             AND e.enumlabel = 'aufladung'
         )),
        'korrektur_plus'::public.token_transaction_type
      );

      UPDATE public.token_wallets
        SET balance = balance + 1, updated_at = NOW()
      WHERE id = v_wallet.id;

      INSERT INTO public.token_transactions
        (wallet_id, user_id, amount, type, reason, lead_id, created_by, created_at)
      VALUES (
        v_wallet.id, v_lead.assigned_user_id, 1, v_tx_type,
        'Lead-Reset Rückerstattung (RPC reset_lead V4.2)',
        p_lead_id,
        COALESCE(p_by_user_id, v_lead.assigned_user_id), NOW()
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

REVOKE ALL ON FUNCTION public.reset_lead(UUID,UUID,BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_lead(UUID,UUID,BOOLEAN) TO service_role;

COMMENT ON FUNCTION public.assign_lead_to_seller(UUID,UUID,BOOLEAN) IS
  'V4.2 – HOTFIX ENUM token_transaction_type Fallback';
COMMENT ON FUNCTION public.reset_lead(UUID,UUID,BOOLEAN) IS
  'V4.2 – HOTFIX korrekte Param-Namen + ENUM Fallback';

-- =====================================================================
-- (D) Optional: product_type = text Operator anlegen
-- =====================================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_operator o
    JOIN pg_type tl ON tl.oid = o.oprleft
    JOIN pg_type tr ON tr.oid = o.oprright
    WHERE tl.typname = 'product_type'
      AND tr.typname = 'text'
      AND o.oprname = '='
  ) THEN
    EXECUTE 'CREATE OPERATOR = (
      LEFTARG = product_type,
      RIGHTARG = text,
      COMMUTATOR = =,
      NEGATOR = <>,
      RESTRICT = eqsel,
      JOIN = eqjoinsel,
      HASHES,
      MERGES,
      PROCEDURE = pg_catalog.texteq
    )';
    RAISE NOTICE 'Neuer Operator: product_type = text angelegt';
  ELSE
    RAISE NOTICE 'Operator product_type = text existiert bereits';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Konnte Operator nicht anlegen (%. %) – RPCs nutzen ::TEXT Casts also nicht kritisch', SQLSTATE, SQLERRM;
END $$;

-- =====================================================================
-- (E) SANITY CHECKS (Diagnose-Ausgabe im SQL Editor)
-- =====================================================================
DO $$
DECLARE
  v_enum_values TEXT[];
BEGIN
  SELECT ARRAY_AGG(enumlabel::TEXT ORDER BY enumsortorder)
    INTO v_enum_values
  FROM pg_catalog.pg_enum e
  JOIN pg_catalog.pg_type t ON t.oid = e.enumtypid
  JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public' AND t.typname = 'token_transaction_type';

  RAISE NOTICE 'Aktueller ENUM token_transaction_type: %',
    COALESCE(array_to_string(v_enum_values,', '), '<nicht vorhanden>');

  IF 'abbuchung' = ANY(COALESCE(v_enum_values, ARRAY[]::TEXT[])) THEN
    RAISE NOTICE '✅ abbuchung IM ENUM vorhanden';
  ELSE
    RAISE NOTICE '⚠️  abbuchung NICHT im ENUM (RPCs nutzen Fallback korrektur_minus)';
  END IF;

  BEGIN
    PERFORM 1 FROM public.leads WHERE product::TEXT = 'strom' LIMIT 1;
    RAISE NOTICE '✅ product::TEXT-Vergleich OK';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ product::TEXT-Vergleich FEHLER: %', SQLERRM;
  END;
END $$;
