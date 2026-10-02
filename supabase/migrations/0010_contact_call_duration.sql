-- =====================================================================
-- 0010_contact_call_duration.sql
-- Strukturierte Speicherung der Gesprächszeit pro Kontaktversuch
-- ---------------------------------------------------------------------
-- Fügt call_duration_seconds (integer) Spalte zu contact_attempts hinzu,
-- Indexe für schnelle Auswertungen und Helfer-Funktion zur Formatierung.
-- =====================================================================

-- 1) Spalte ergänzen (Idempotent)
ALTER TABLE public.contact_attempts
  ADD COLUMN IF NOT EXISTS call_duration_seconds integer DEFAULT NULL;

-- 2) Kommentar für Klarheit
COMMENT ON COLUMN public.contact_attempts.call_duration_seconds
  IS 'Dauer des Telefonats / Gesprächs in Sekunden. NULL = kein Anruf getätigt / nicht dokumentiert.';

-- 3) Index für Aggregationen (Gesamt-Summe pro User/Lead/Zeitraum)
CREATE INDEX IF NOT EXISTS idx_contact_attempts_duration_user_date
  ON public.contact_attempts(user_id, attempt_date DESC)
  INCLUDE (call_duration_seconds);

CREATE INDEX IF NOT EXISTS idx_contact_attempts_duration_lead
  ON public.contact_attempts(lead_id)
  INCLUDE (call_duration_seconds);

-- =====================================================================
-- 4) Helfer-Funktion: formatiert Sekunden als mm:ss (oder h:mm:ss)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.format_call_duration(total_seconds integer)
  RETURNS text
  LANGUAGE plpgsql
  IMMUTABLE
AS $$
BEGIN
  IF total_seconds IS NULL OR total_seconds <= 0 THEN
    RETURN NULL;
  END IF;
  IF total_seconds < 3600 THEN
    RETURN TO_CHAR((total_seconds || ' seconds')::interval, 'MI:SS');
  END IF;
  RETURN TRIM(LEADING '0' FROM TO_CHAR((total_seconds || ' seconds')::interval, 'HH24:MI:SS'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.format_call_duration(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.format_call_duration(integer) TO service_role;

COMMIT;
