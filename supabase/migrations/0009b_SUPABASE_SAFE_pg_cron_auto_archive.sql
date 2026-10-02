-- =====================================================================
-- 0009b_SUPABASE_SAFE_pg_cron_auto_archive.sql
-- NUR ausführen, WENN pg_cron Extension bereits über das SUPABASE DASHBOARD
-- (Database → Extensions → pg_cron → ON) aktiviert wurde!
-- Diese Datei überspringt CREATE EXTENSION und macht nur noch
-- die "harmlosen" Teile (Rechte säubern, Spalte, Funktion, Cron-Job).
-- =====================================================================

-- =====================================================================
-- (Schritt 1) Komplette Bereinigung aller Rechte auf cron-Schema.
-- Wir ignorieren hierbei _alle_ Fehler, da wir uns nur in einen
-- sauberen Zustand versetzen wollen.
-- =====================================================================
DO $$ BEGIN
  -----------------------------------------------------------
  -- 1a) Direkt vergebene Rechte CASCADE zurückziehen
  -----------------------------------------------------------
  BEGIN
    REVOKE ALL PRIVILEGES ON SCHEMA cron
      FROM postgres, service_role, supabase_admin, authenticated, anon
      CASCADE;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    REVOKE CREATE ON SCHEMA cron
      FROM public, postgres, service_role, supabase_admin
      CASCADE;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA cron
      FROM postgres, service_role, supabase_admin, authenticated
      CASCADE;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron
      FROM postgres, service_role, supabase_admin, authenticated
      CASCADE;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA cron
      FROM postgres, service_role, supabase_admin
      CASCADE;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -----------------------------------------------------------
  -- 1b) DEFAULT PRIVILEGES von supabase_admin zurücksetzen
  --     Das ist die entscheidende Maßnahme gegen 2BP01.
  --     Wir verwenden REVOKE GRANT OPTION zusätzlich, weil
  --     die Supabase Policy Rechte mit WITH GRANT OPTION vergibt.
  -----------------------------------------------------------
  DECLARE
    dummy_sql text;
  BEGIN
    FOREACH dummy_sql IN ARRAY ARRAY[
      'ALTER DEFAULT PRIVILEGES FOR USER supabase_admin IN SCHEMA cron REVOKE ALL ON SEQUENCES FROM postgres CASCADE',
      'ALTER DEFAULT PRIVILEGES FOR USER supabase_admin IN SCHEMA cron REVOKE ALL ON TABLES FROM postgres CASCADE',
      'ALTER DEFAULT PRIVILEGES FOR USER supabase_admin IN SCHEMA cron REVOKE ALL ON FUNCTIONS FROM postgres CASCADE',
      'ALTER DEFAULT PRIVILEGES FOR USER supabase_admin IN SCHEMA cron REVOKE GRANT OPTION FOR ALL ON SEQUENCES FROM postgres CASCADE',
      'ALTER DEFAULT PRIVILEGES FOR USER supabase_admin IN SCHEMA cron REVOKE GRANT OPTION FOR ALL ON TABLES FROM postgres CASCADE',
      'ALTER DEFAULT PRIVILEGES FOR USER supabase_admin IN SCHEMA cron REVOKE GRANT OPTION FOR ALL ON FUNCTIONS FROM postgres CASCADE',
      'ALTER DEFAULT PRIVILEGES FOR USER supabase_admin IN SCHEMA cron REVOKE ALL ON SEQUENCES FROM service_role CASCADE',
      'ALTER DEFAULT PRIVILEGES FOR USER supabase_admin IN SCHEMA cron REVOKE ALL ON TABLES FROM service_role CASCADE',
      'ALTER DEFAULT PRIVILEGES FOR USER supabase_admin IN SCHEMA cron REVOKE ALL ON FUNCTIONS FROM service_role CASCADE'
    ] LOOP
      BEGIN
        EXECUTE dummy_sql;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END LOOP;
  END;
END $$;

-- =====================================================================
-- (Schritt 2) Rechte für postgres + service_role MINIMAL neu aufbauen,
--             OHNE irgendwelche "WITH GRANT OPTION" (das ist der Trick!)
-- =====================================================================
DO $$ BEGIN
  BEGIN
    GRANT USAGE ON SCHEMA cron TO postgres;
    GRANT ALL ON ALL FUNCTIONS IN SCHEMA cron TO postgres;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA cron TO postgres;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA cron TO postgres;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- cron.job und job_run_details: nur SELECT für postgres
  BEGIN
    REVOKE ALL ON cron.job FROM postgres;
    GRANT SELECT ON cron.job TO postgres;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    REVOKE ALL ON cron.job_run_details FROM postgres;
    GRANT SELECT ON cron.job_run_details TO postgres;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- service_role: minimal Rechte, damit Backend ggf. Job-Status lesen kann
  BEGIN
    GRANT USAGE ON SCHEMA cron TO service_role;
    GRANT SELECT ON cron.job TO service_role;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- =====================================================================
-- (Schritt 3) archived-Spalte + Index
-- =====================================================================
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_archive_candidate
  ON leads (status, updated_at)
  WHERE archived = false;

-- =====================================================================
-- (Schritt 4) Archivierungsfunktion
-- =====================================================================
CREATE OR REPLACE FUNCTION archive_old_leads()
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  cutoff_date timestamp;
  affected_count integer;
BEGIN
  cutoff_date := NOW() - INTERVAL '90 days';

  CREATE TEMP TABLE IF NOT EXISTS _archive_candidates ON COMMIT DROP AS
    SELECT id, status, updated_at
    FROM leads
    WHERE archived = false
      AND status IN ('canceled', 'no_interest', 'wrong_data')
      AND updated_at <= cutoff_date;

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  IF affected_count = 0 THEN RETURN 0; END IF;

  BEGIN
    INSERT INTO lead_status_history (lead_id, old_status, new_status, changed_by, note, created_at)
    SELECT
      c.id,
      c.status::text,
      c.status::text,
      '00000000-0000-0000-0000-000000000000'::uuid,
      '[System] Auto-Archivierung nach 90 Tagen (Status ' || c.status::text || ')',
      NOW()
    FROM _archive_candidates c;
  EXCEPTION WHEN undefined_table OR insufficient_privilege THEN NULL;
  END;

  UPDATE leads l
  SET archived = true
  FROM _archive_candidates c
  WHERE l.id = c.id;

  RETURN affected_count;
END;
$$;

GRANT EXECUTE ON FUNCTION archive_old_leads() TO service_role;
GRANT EXECUTE ON FUNCTION archive_old_leads() TO postgres;

-- =====================================================================
-- (Schritt 5) Cron-Job anlegen (täglich 03:00 UTC)
-- =====================================================================
DO $$
DECLARE
  job_name text := 'archive-old-leads';
  existing_job_id integer;
BEGIN
  -- Nochmal kurz: Sicherstellen, dass wir cron.schedule ausführen dürfen
  BEGIN
    GRANT USAGE ON SCHEMA cron TO postgres;
    GRANT ALL ON ALL FUNCTIONS IN SCHEMA cron TO postgres;
    GRANT SELECT ON cron.job TO postgres;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Existiert Job schon? (mit Fallback)
  BEGIN
    SELECT jobid INTO existing_job_id
    FROM cron.job
    WHERE jobname = job_name
    LIMIT 1;

    IF existing_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(existing_job_id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      PERFORM cron.unschedule(job_name);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END;

  -- Job anlegen
  PERFORM cron.schedule(
    job_name,
    '0 3 * * *',
    'SELECT archive_old_leads();'
  );
END $$;
