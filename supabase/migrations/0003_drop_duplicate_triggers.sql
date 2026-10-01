-- =============================================
-- Migration 0003: Doppelte Trigger + alte Funktionen entfernen
-- =============================================
-- Problem: Migration 0001 legte einen Trigger „leads_log_status“ + Funktion
-- „log_lead_status_change“ an. Migration 0002 fügte einen zweiten Trigger
-- „leads_track_status“ + Funktion „track_lead_status_change“ hinzu, ohne den
-- alten Trigger zu entfernen. Ergebnis: Status-Änderungen erzeugen doppelte
-- Einträge in lead_status_history.
-- =============================================

-- 1. Alten Trigger DROP (falls vorhanden)
DROP TRIGGER IF EXISTS leads_log_status ON public.leads;

-- 2. Alte Trigger-Funktion DROP (falls vorhanden)
DROP FUNCTION IF EXISTS public.log_lead_status_change();

-- =============================================
-- Zusatz-Sicherheit: Sicherstellen, dass NUR der neue Trigger aktiv ist
-- (Migration 0002 hat diesen angelegt – falls er fehlt, NUR anlegen,
--  wenn die Funktion track_lead_status_change bereits existiert)
-- =============================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.leads'::regclass
      AND tgname = 'leads_track_status'
  ) AND EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'track_lead_status_change'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    CREATE TRIGGER leads_track_status
    AFTER UPDATE ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION public.track_lead_status_change();
  END IF;
END $$;
