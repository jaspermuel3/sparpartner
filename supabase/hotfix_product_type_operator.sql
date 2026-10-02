-- ============================================================
-- HOTFIX: "operator does not exist: product_type = text"
-- ------------------------------------------------------------
-- Fehler trat bei "Lead anfordern" auf:
--   assign_next_lead_to_user() verglich die ENUM-Spalte `product`
--   (TYPE product_type) mit TEXT-Parametern ohne expliziten CAST.
--
-- Reparatur:
--   1) Explizite Casts product::TEXT innerhalb der RPC
--   2) Zusätzlich einen impliziten Cast operator anlegen, damit
--      Supabase-JS-Client .eq('product','strom') Aufrufe klappen.
-- ============================================================

-- (1) Zuerst: RPC assign_next_lead_to_user V4 NEU anlegen
--     (gleiche Signatur, aber product::TEXT Casts im Pool-Filter)
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

  -- WICHTIG: product ist product_type (ENUM). Cast auf TEXT.
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
    v_wallet.id, p_user_id, -v_cost, 'abbuchung',
    'Automatische Lead-Zuweisung (RPC assign_next_lead_to_user V4.1 – product::TEXT FIX)',
    v_lead_id, p_user_id, NOW()
  );

  BEGIN
    PERFORM public.log_activity_feed(p_user_id, 'lead_assigned', v_lead_id, NULL);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'log_activity_feed nicht verfügbar, übersprungen';
  END;

  RETURN v_lead_id;
END $$;

-- (2) Rechte
REVOKE ALL ON FUNCTION public.assign_next_lead_to_user(UUID,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_next_lead_to_user(UUID,TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION public.assign_next_lead_to_user(UUID,TEXT) IS
  'V4.1 – HOTFIX product::TEXT Cast gegen "operator does not exist: product_type = text"';

-- (3) Optional (aber empfohlen): Impliziten Cast operator anlegen,
--     damit Supabase-JS .eq('product','strom') generisch funktioniert,
--     falls an anderer Stelle keine Casts vorhanden sind.
--     Vorsicht: Nur ausführen, wenn folgende Operatoren noch fehlen.
DO $$ BEGIN
  -- equality: product_type = text
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
      PROCEDURE = pg_catalog.textlike
    )';
    RAISE NOTICE 'Neuer Operator: product_type = text angelegt';
  ELSE
    RAISE NOTICE 'Operator product_type = text existiert bereits – übersprungen';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Konnte Operator nicht anlegen (%. %) – nicht kritisch, RPCs nutzen jetzt ::TEXT Cast', SQLSTATE, SQLERRM;
END $$;

-- (4) Sanity-Check: Eine Testabfrage gegen die Spalte (ohne Ergebnis, nur kein Fehler!)
DO $$ BEGIN
  PERFORM 1 FROM public.leads WHERE product::TEXT = 'strom' LIMIT 1;
  RAISE NOTICE 'Sanity-Check product::TEXT OK';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Sanity-Check Warnung: %', SQLERRM;
END $$;
