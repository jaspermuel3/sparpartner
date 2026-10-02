-- =====================================================================
-- SOFT-DELETE: ALLE aktuellen Leads als gelöscht markieren
-- =====================================================================
-- AUSFÜHREN IM SUPABASE DASHBOARD → SQL EDITOR
--
-- Aktion: Alle Leads, wo is_deleted = FALSE → is_deleted = TRUE
--         (Soft-Delete! Datensätze bleiben in DB, Audit-fähig!)
-- Grund : Massenlöschung durch Admin
-- Ergebnis: Leads erscheinen in keiner UI mehr
-- =====================================================================

DO $$
DECLARE
  v_count_before INT;
  v_count_deleted INT;
  v_admin_id UUID := NULL;   -- optional: ersetze durch echte Admin-User ID
                             -- z.B. v_admin_id := '00000000-0000-0000-0000-000000000000'::uuid;
BEGIN
  -- (1) Count vorher (aktive Leads)
  SELECT COUNT(*) INTO v_count_before
  FROM public.leads WHERE is_deleted = FALSE;

  -- (2) Admin-ID automatisch ermitteln (erster aktiver Admin)
  IF v_admin_id IS NULL THEN
    SELECT id INTO v_admin_id
    FROM public.users
    WHERE role = 'admin' AND is_active = TRUE
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- (3) ALLE aktiven Leads auf is_deleted = TRUE setzen
  UPDATE public.leads
  SET
    is_deleted      = TRUE,
    deleted_at      = NOW(),
    deleted_by      = v_admin_id,
    deletion_reason = COALESCE(deletion_reason, 'Massenlöschung durch Admin'),
    updated_at      = NOW()
  WHERE is_deleted = FALSE;

  GET DIAGNOSTICS v_count_deleted = ROW_COUNT;

  -- (4) Console-Ausgabe
  RAISE NOTICE '=====================================================';
  RAISE NOTICE 'ERGEBNIS Massenlöschung (Soft-Delete)';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE 'Aktive Leads VORHER : %', v_count_before;
  RAISE NOTICE 'Gerade deaktiviert    : %', v_count_deleted;
  RAISE NOTICE 'Admin-User ID (deleted_by): %', COALESCE(v_admin_id::text, 'KEIN ADMIN GEFUNDEN → deleted_by=NULL');
  RAISE NOTICE '=====================================================';
  RAISE NOTICE 'Hinweis: Callbacks, Cancellation Requests, Contact-Attempts';
  RAISE NOTICE '         und Token-Transaktionen bleiben unangetastet.';
  RAISE NOTICE '         Für Hard-Delete (wirklich ALLES löschen):';
  RAISE NOTICE '         Script unten (Block B) verwenden.';
  RAISE NOTICE '=====================================================';
END $$;

-- =====================================================================
-- CHECK: 5 Sekunden danach → anzeigen, ob es funktioniert hat
-- =====================================================================
SELECT
  COUNT(*) FILTER (WHERE is_deleted = FALSE) AS aktive_leads,
  COUNT(*) FILTER (WHERE is_deleted = TRUE)  AS geloeschte_leads,
  COUNT(*)                                   AS gesamt_leads,
  MAX(deleted_at)                            AS letzte_loeschung
FROM public.leads;

-- =====================================================================
-- (OPTIONAL) BLOCK B — HARD DELETE: Leads WIRKLICH aus DB entfernen
-- =====================================================================
-- WARNUNG: Nicht rückgängig zu machen! FK-CASCADE löscht auch:
--          lead_status_history, contact_attempts, callbacks,
--          lead_cancellation_requests, lead_documents, lead_tags,
--          token_transactions mit Bezug auf diese Leads
--
-- Benutze NUR, wenn du Testdaten restlos entfernen möchtest.
-- (Entferne /* und */ zum Aktivieren)
/*

DO $$
DECLARE
  v_count_before INT;
  v_count_after  INT;
BEGIN
  SELECT COUNT(*) INTO v_count_before FROM public.leads;
  DELETE FROM public.leads WHERE 1=1;                      -- ALLE
  GET DIAGNOSTICS v_count_after = ROW_COUNT;
  RAISE NOTICE 'HARD-DELETE: % von % Leads WIRKLICH gelöscht!', v_count_after, v_count_before;
END $$;

SELECT COUNT(*) AS uebrige_leads FROM public.leads;

*/
