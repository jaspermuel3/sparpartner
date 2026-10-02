-- ============================================================
-- 0020: FINAL-FIX Lead-Zuweisungs-RPCs (V4)
-- ============================================================
-- GEFUNDENE BUGS in Migration 0015, die dazu führten, dass
-- "Lead anfordern" in der Praxis oft stillschweigend fehlschlug
-- obwohl die UI verfügbare Leads anzeigte:
--
-- BUG (1) Fehlende Filter in assign_next_lead_to_user:
--         Migration 0015 hat NUR is_deleted=FALSE gesetzt,
--         aber is_on_hold=FALSE und archived=FALSE fehlten.
--         Die UI zeigte mit diesen 3 Filtern also z.B. 5 Leads an,
--         während die RPC zusätzlich gehaltene/archivierte Leads
--         einschloss, die gesperrt oder nicht sichtbar waren.
--         Ergebnis: NO_LEAD_AVAILABLE obwohl der Pool gefüllt ist.
--
-- BUG (2) Inkonsistente Produktlogik:
--         UI + getAvailableLeadCountBreakdown behandeln 'beides'
--         anders als Migration 0015 (nur einfaches OR product='beides').
--         Migration 0007 hatte korrekte TRIM/LOWER + IN-List-Logik.
--
-- BUG (3) reset_lead Signatur/Param-Namen inkonsistent zum Code:
--         admin.service.ts übergibt p_by_user_id, Migration 0015
--         hieß der Parameter p_by. Named-Parameters-RPCs werden
--         über Namen zugeordnet → byUserId landete in p_refund!
--
-- BUG (4) assign_lead_to_seller: Fehlende is_on_hold + archived Filter.
--
-- BUG (5) Status-Filter in assign_next_lead_to_user zu restriktiv
--         vs. UI: Migration 0007 nutzte nur status='new', UI
--         ignoriert canceled/wrong_data/no_interest/closed.
--         → Aufgehobene Leads (assigned->new nach Reset) wurden
--         trotzdem zugewiesen, sobald sie Status !=new hatten.
--         Nach Rücksprache im Code ist Migration 0007s restriktiver
--         Status-Filter falsch: Leads sollen nach Reset mit Status
--         'new' zurückkommen, aber bei getAvailableLeadCountBreakdown
--         sind ALLE außer 4 Endstatus erlaubt. Also anpassen an UI.
--
-- BUG (6) assign_lead_to_seller gibt BOOLEAN zurück, wurde aber
--         in einigen Vorgängerversionen VOID/Exception-basiert.
--         Sicherstellen, dass FALSE sauber zurückkommt statt
--         stiller Success-Annahme.
-- ============================================================

-- =====================================================================
-- (PRE) NUKING ALL OVERLOADS – wirklich alle sauber entfernen!
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

-- =====================================================================
-- KONSISTENZ-REGELN (gelten für ALLE Abfragen auf leads):
--   is_deleted = FALSE   → Soft-Delete Leads komplett ausschließen
--   archived = FALSE     → Automatisch archivierte Leads ausschließen
--   is_on_hold = FALSE   → Gehaltene Leads NICHT verteilen
-- =====================================================================

-- ============================================================
-- (1) assign_next_lead_to_user — V4
--     UI + Service: 2 Parameter (UUID, TEXT mit DEFAULT NULL)
-- ============================================================
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
  -- Wallet laden und sperren
  SELECT * INTO v_wallet FROM public.token_wallets
    WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WALLET_NOT_FOUND'; END IF;
  IF v_wallet.balance < v_cost THEN RAISE EXCEPTION 'NOT_ENOUGH_TOKENS'; END IF;

  -- Produkt-Normalisierung (KONSISTENT ZU MIGRATION 0007)
  v_product_norm := CASE
    WHEN p_product IS NULL THEN NULL
    WHEN LENGTH(TRIM(p_product)) = 0 THEN NULL
    WHEN LOWER(TRIM(p_product)) IN ('all','beides','beide','alle') THEN NULL
    ELSE LOWER(TRIM(p_product))
  END;

  -- Pool wählen: SELBE Filter wie getAvailableLeadCountBreakdown()
  WITH pool AS (
    SELECT id FROM public.leads
    WHERE assigned_user_id IS NULL
      AND is_deleted = FALSE         -- Fix BUG(1)
      AND archived = FALSE           -- Fix BUG(1)
      AND is_on_hold = FALSE         -- Fix BUG(1)
      AND status NOT IN ('canceled','wrong_data','no_interest','closed')
      AND (
            v_product_norm IS NULL                   -- → alle Produkte
            OR product = v_product_norm              -- → genau gesuchtes Produkt
            OR product = 'beides'                    -- → beides gilt IMMER als Treffer
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

  -- Token abbuchen
  UPDATE public.token_wallets
    SET balance = balance - v_cost, updated_at = NOW()
  WHERE id = v_wallet.id;

  -- Token-Transaktion
  INSERT INTO public.token_transactions
    (wallet_id, user_id, amount, type, reason, lead_id, created_by, created_at)
  VALUES (
    v_wallet.id, p_user_id, -v_cost, 'abbuchung',
    'Automatische Lead-Zuweisung (RPC assign_next_lead_to_user V4)',
    v_lead_id, p_user_id, NOW()
  );

  -- Activity Feed, falls Funktion vorhanden (defensiv mit PERFORM)
  BEGIN
    PERFORM public.log_activity_feed(p_user_id, 'lead_assigned', v_lead_id, NULL);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'log_activity_feed nicht verfügbar, übersprungen';
  END;

  RETURN v_lead_id;
END $$;

-- ============================================================
-- (2) assign_lead_to_seller — V4 (manuelle Admin-Zuweisung)
--     Service ruft auf: p_lead_id, p_seller_id, p_charge_token
-- ============================================================
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
  -- Lead laden & sperren — mit ALLEN Konsistenz-Filtern
  SELECT * INTO v_lead FROM public.leads
    WHERE id = p_lead_id
      AND is_deleted = FALSE         -- BUG(4) Fix
      AND archived = FALSE           -- BUG(4) Fix
      AND is_on_hold = FALSE         -- BUG(4) Fix
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
      'Manuelle Lead-Zuweisung (Admin, RPC assign_lead_to_seller V4)',
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

-- ============================================================
-- (3) reset_lead — V4, Param-Namen KONSISTENT zum Code
--     admin.service.ts: p_lead_id, p_by_user_id, p_refund
--     (WICHTIG: Reihenfolge der Named Parameter spielt keine Rolle,
--               die NAMEN MÜSSEN exakt übereinstimmen!)
-- ============================================================
CREATE OR REPLACE FUNCTION public.reset_lead(
  p_lead_id UUID,
  p_by_user_id UUID DEFAULT NULL,     -- ← BUG(3) Fix: hieß früher p_by!
  p_refund BOOLEAN DEFAULT TRUE       -- ← BUG(3) Fix: Reihenfolge wie im Code
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_lead public.leads%ROWTYPE;
  v_wallet public.token_wallets%ROWTYPE;
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
      UPDATE public.token_wallets
        SET balance = balance + 1, updated_at = NOW()
      WHERE id = v_wallet.id;

      INSERT INTO public.token_transactions
        (wallet_id, user_id, amount, type, reason, lead_id, created_by, created_at)
      VALUES (
        v_wallet.id, v_lead.assigned_user_id, 1, 'aufladung',
        'Lead-Reset Rückerstattung (RPC reset_lead V4)',
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

-- ============================================================
-- (4) get_lead_status_distribution — V4
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_lead_status_distribution()
RETURNS TABLE(status TEXT, count BIGINT) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT l.status::TEXT AS status, COUNT(*) AS count
  FROM public.leads l
  WHERE l.is_deleted = FALSE
    AND l.archived = FALSE
  GROUP BY l.status;
END $$;

-- ============================================================
-- (5) get_contact_time_heatmap — V4
-- ============================================================
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
   AND l.archived = FALSE
  WHERE ca.user_id = p_user_id
    AND ca.attempt_date >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY 1, 2, 3
  ORDER BY 1, 3;
END $$;

-- ============================================================
-- (6) BERECHTIGUNGEN — konsistent zu Migration 0015 + Hotfix
-- ============================================================
REVOKE ALL ON FUNCTION public.assign_lead_to_seller(UUID,UUID,BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_lead(UUID,UUID,BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_next_lead_to_user(UUID,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_lead_status_distribution() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_contact_time_heatmap(UUID,INT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.assign_lead_to_seller(UUID,UUID,BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_lead(UUID,UUID,BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.assign_next_lead_to_user(UUID,TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_lead_status_distribution() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_contact_time_heatmap(UUID,INT) TO authenticated, service_role;

COMMENT ON FUNCTION public.assign_next_lead_to_user(UUID,TEXT) IS
  'V4 – is_deleted=FALSE + archived=FALSE + is_on_hold=FALSE + korrekte Produktlogik (TRIM/LOWER) + Übereinstimmung mit UI Lead-Pool';
COMMENT ON FUNCTION public.assign_lead_to_seller(UUID,UUID,BOOLEAN) IS
  'V4 – is_deleted=FALSE + archived=FALSE + is_on_hold=FALSE + konsistente Signatur (3 Param: lead_id,seller_id,charge_token)';
COMMENT ON FUNCTION public.reset_lead(UUID,UUID,BOOLEAN) IS
  'V4 – korrekte Param-Namen (p_by_user_id statt p_by) zur Named-Parameter-Kompatibilität + archived Filter';
COMMENT ON FUNCTION public.get_lead_status_distribution() IS
  'V4 – archived=FALSE konsistent';
COMMENT ON FUNCTION public.get_contact_time_heatmap(UUID,INT) IS
  'V4 – archived=FALSE konsistent';

-- ============================================================
-- (7) DIAGNOSE — ausführen, um zu sehen OB DIE MIGRATION GRÜN IST
-- ============================================================
-- Alle 4 Lead-Konsistenzfilter (is_deleted, archived, is_on_hold)
-- MÜSSEN in assign_next_lead_to_user und assign_lead_to_seller
-- vorhanden sein.
-- ============================================================
WITH checks AS (
  SELECT
    'assign_next_lead_to_user' AS funktion,
    CASE WHEN prosrc ILIKE '%is_deleted = FALSE%'       THEN 1 ELSE 0 END AS has_is_deleted,
    CASE WHEN prosrc ILIKE '%archived = FALSE%'         THEN 1 ELSE 0 END AS has_archived,
    CASE WHEN prosrc ILIKE '%is_on_hold = FALSE%'       THEN 1 ELSE 0 END AS has_is_on_hold,
    CASE WHEN prosrc ILIKE '%TRIM(%'                    THEN 1 ELSE 0 END AS has_trim,
    CASE WHEN prosrc ILIKE '%product = ''beides''%'     THEN 1 ELSE 0 END AS has_beides_fallback
  FROM pg_proc WHERE proname = 'assign_next_lead_to_user'
  UNION ALL
  SELECT
    'assign_lead_to_seller' AS funktion,
    CASE WHEN prosrc ILIKE '%is_deleted = FALSE%'       THEN 1 ELSE 0 END,
    CASE WHEN prosrc ILIKE '%archived = FALSE%'         THEN 1 ELSE 0 END,
    CASE WHEN prosrc ILIKE '%is_on_hold = FALSE%'       THEN 1 ELSE 0 END,
    0, 0
  FROM pg_proc WHERE proname = 'assign_lead_to_seller'
  UNION ALL
  SELECT
    'reset_lead' AS funktion,
    CASE WHEN prosrc ILIKE '%p_by_user_id%'             THEN 1 ELSE 0 END AS param_by_user_id_ok,
    CASE WHEN prosrc ILIKE '%archived = FALSE%'         THEN 1 ELSE 0 END,
    CASE WHEN prosrc ILIKE '%p_refund%'                 THEN 1 ELSE 0 END AS param_refund_ok,
    0, 0
  FROM pg_proc WHERE proname = 'reset_lead'
)
SELECT
  funktion,
  has_is_deleted + has_archived + has_is_on_hold + has_trim + has_beides_fallback AS gesamt_checks,
  CASE
    WHEN funktion = 'assign_next_lead_to_user' AND has_is_deleted + has_archived + has_is_on_hold + has_trim + has_beides_fallback = 5
      THEN 'OK ✅'
    WHEN funktion = 'assign_lead_to_seller' AND has_is_deleted + has_archived + has_is_on_hold = 3
      THEN 'OK ✅'
    WHEN funktion = 'reset_lead' AND param_by_user_id_ok + has_archived + param_refund_ok = 3
      THEN 'OK ✅'
    ELSE 'FEHLT ❌'
  END AS status,
  has_is_deleted AS filter_is_deleted,
  has_archived AS filter_archived,
  has_is_on_hold AS filter_is_on_hold,
  has_trim AS produkt_trim,
  has_beides_fallback AS produkt_beides_fallback
FROM checks;
