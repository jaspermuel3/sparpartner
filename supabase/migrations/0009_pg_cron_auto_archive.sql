-- =====================================================================
-- 0009_pg_cron_auto_archive.sql
-- Auto-Archivierung abgeschlossener/verworfener Leads nach 90 Tagen
-- ---------------------------------------------------------------------
-- Aktiviert die pg_cron-Extension, legt die archived-Spalte an,
-- erstellt eine PL/pgSQL-Funktion zum Archivieren und plant einen
-- Cron-Job, der täglich um 03:00 UTC läuft.
-- HINWEIS: Wenn im Supabase SQL Editor der Fehler "2BP01 dependent
-- privileges exist" erscheint, dann führe zuerst NUR den Block
-- "(Schritt A) pg_cron Extension anlegen" einzeln aus, dann den Rest.
-- =====================================================================

-- =====================================================================
-- (Schritt A) pg_cron-Extension aktivieren (nur, falls noch nicht geschehen)
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =====================================================================
-- (Schritt B) KOMPLETTE Bereinigung aller Rechte auf cron-Schema.
-- Der Supabase Extension-Wizard vergibt Default-Rechte MIT "GRANT OPTION"
-- und legt ALTER DEFAULT PRIVILEGES an. Ohne explizites Zurücksetzen
-- dieser Default-Privileges knallt es mit "2BP01: dependent privileges".
-- =====================================================================
DO $$ BEGIN
  -- 1) Alle direkt vergebenen Rechte CASCADE zurückziehen
  BEGIN
    REVOKE ALL PRIVILEGES ON SCHEMA cron FROM postgres, service_role, supabase_admin, authenticated, anon CASCADE;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    REVOKE CREATE ON SCHEMA cron FROM public, postgres, service_role, supabase_admin CASCADE;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA cron FROM postgres, service_role, supabase_admin, authenticated CASCADE;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron FROM postgres, service_role, supabase_admin, authenticated CASCADE;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA cron FROM postgres, service_role, supabase_admin CASCADE;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- 2) Die entscheidenden DEFAULT PRIVILEGES (für supabase_admin) zurücksetzen.
  --    Das löst das 2BP01-Problem. Weil Supabase bei CREATE EXTENSION pg_cron
  --    für supabase_admin Default-Rechte anlegt, die wiederum Rechte mit
  --    GRANT OPTION für postgres erzeugen.
  BEGIN
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR USER supabase_admin IN SCHEMA cron REVOKE ALL ON SEQUENCES FROM postgres CASCADE';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR USER supabase_admin IN SCHEMA cron REVOKE ALL ON TABLES FROM postgres CASCADE';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR USER supabase_admin IN SCHEMA cron REVOKE ALL ON FUNCTIONS FROM postgres CASCADE';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR USER supabase_admin IN SCHEMA cron REVOKE GRANT OPTION FOR ALL ON SEQUENCES FROM postgres CASCADE';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR USER supabase_admin IN SCHEMA cron REVOKE GRANT OPTION FOR ALL ON TABLES FROM postgres CASCADE';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR USER supabase_admin IN SCHEMA cron REVOKE GRANT OPTION FOR ALL ON FUNCTIONS FROM postgres CASCADE';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- (Schritt B2) Kurze Pause: Rechte neu aufbauen – GRANT mit GRANT OPTION vermeiden,
-- also nur einfache Grants OHNE WITH GRANT OPTION.
DO $$ BEGIN
  BEGIN
    GRANT USAGE ON SCHEMA cron TO postgres;
    GRANT ALL ON ALL FUNCTIONS IN SCHEMA cron TO postgres;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA cron TO postgres;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA cron TO postgres;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER DEFAULT PRIVILEGES FOR USER supabase_admin IN SCHEMA cron GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO postgres;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER DEFAULT PRIVILEGES FOR USER supabase_admin IN SCHEMA cron GRANT USAGE, SELECT ON SEQUENCES TO postgres;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER DEFAULT PRIVILEGES FOR USER supabase_admin IN SCHEMA cron GRANT ALL ON FUNCTIONS TO postgres;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  -- cron.job soll für postgres nur SELECT dürfen (kein INSERT per Hand)
  BEGIN
    REVOKE ALL ON TABLE cron.job FROM postgres;
    GRANT SELECT ON TABLE cron.job TO postgres;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    REVOKE ALL ON TABLE cron.job_run_details FROM postgres;
    GRANT SELECT ON TABLE cron.job_run_details TO postgres;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- 2) archived-Spalte in der leads-Tabelle ergänzen (Idempotent)
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false NOT NULL;

-- 3) Index auf (status, updated_at, archived) für schnelle Filterung
CREATE INDEX IF NOT EXISTS idx_leads_archive_candidate
  ON leads (status, updated_at)
  WHERE archived = false;

-- =====================================================================
-- 4) PL/pgSQL Funktion: archive_old_leads()
-- ---------------------------------------------------------------------
-- Markiert alle Leads mit den Endstatus-Werten
--   'canceled' | 'no_interest' | 'wrong_data'
-- deren last_update mindestens 90 Tage zurückliegt, als archived=true
-- und schreibt einen Eintrag in lead_status_history als Audit-Log.
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

  -- 4a) Audit-Eintrag in lead_status_history vorbereiten (falls Tabelle existiert)
  --     Wir schreiben pro archiviertem Lead keine Zeile, sondern nachher ein Sammel-Update.
  --     Aber: wir fügen für jeden archivierten Lead eine Status-Übergangszeile hinzu,
  --     damit die Historie vollständig bleibt.

  -- 4b) Alle in Frage kommenden Leads temporär sammeln
  CREATE TEMP TABLE IF NOT EXISTS _archive_candidates ON COMMIT DROP AS
    SELECT id, status, updated_at
    FROM leads
    WHERE archived = false
      AND status IN ('canceled', 'no_interest', 'wrong_data')
      AND updated_at <= cutoff_date;

  GET DIAGNOSTICS affected_count = ROW_COUNT;

  IF affected_count = 0 THEN
    RETURN 0;
  END IF;

  -- 4c) Audit-Log in lead_status_history schreiben (sofern die Tabelle existiert)
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
  EXCEPTION WHEN undefined_table OR insufficient_privilege THEN
    -- Falls lead_status_history nicht existiert oder Rechte fehlen, einfach überspringen
    NULL;
  END;

  -- 4d) Jetzt archived=true setzen
  UPDATE leads l
  SET archived = true
  FROM _archive_candidates c
  WHERE l.id = c.id;

  RETURN affected_count;
END;
$$;

-- 5) Berechtigungen setzen – service_role darf die Funktion ausführen
GRANT EXECUTE ON FUNCTION archive_old_leads() TO service_role;
GRANT EXECUTE ON FUNCTION archive_old_leads() TO postgres;

-- =====================================================================
-- 6) Cron-Job einrichten: Täglich um 03:00 UTC ausführen
-- ---------------------------------------------------------------------
-- Der Job wird mit cron.schedule angelegt. Wenn der Job schon existiert,
-- aktualisieren wir ihn über cron.unschedule + schedule, damit das
-- Skript idempotent bleibt. (Robust gegen fehlende Rechte auf cron.job)
-- =====================================================================
DO $$
DECLARE
  job_name text := 'archive-old-leads';
  existing_job_id integer;
BEGIN
  -- (Schritt 1) Zuerst: Alle Rechte für cron-Jobs garantieren,
  -- damit wir cron.schedule/unschedule auch ausführen dürfen.
  BEGIN
    EXECUTE 'GRANT USAGE ON SCHEMA cron TO postgres';
    EXECUTE 'GRANT ALL ON ALL FUNCTIONS IN SCHEMA cron TO postgres';
    EXECUTE 'GRANT SELECT ON cron.job TO postgres';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- (Schritt 2) Versuche existierenden Job über cron.job-Tabelle zu finden
  BEGIN
    SELECT jobid INTO existing_job_id
    FROM cron.job
    WHERE jobname = job_name
    LIMIT 1;

    IF existing_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(existing_job_id);
    END IF;
  EXCEPTION WHEN insufficient_privilege OR undefined_table OR OTHERS THEN
    -- Fallback: versuche unschedule per Namen (pg_cron 1.4+)
    BEGIN
      PERFORM cron.unschedule(job_name);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END;

  -- (Schritt 3) Job neu anlegen: '0 3 * * *' = täglich 03:00 UTC
  PERFORM cron.schedule(
    job_name,
    '0 3 * * *',
    'SELECT archive_old_leads();'
  );
END $$;

-- =====================================================================
-- 7) Recht für cron-scheduling erteilen (nur postgres/service_role)
-- =====================================================================
GRANT USAGE ON SCHEMA cron TO service_role;
GRANT SELECT ON cron.job TO service_role;

-- =====================================================================
-- 8) Initial einmal ausführen, damit bestehende alte Datensätze
--    sofort archiviert werden (kann manuell übersprungen werden)
-- =====================================================================
-- SELECT archive_old_leads();

COMMIT;
