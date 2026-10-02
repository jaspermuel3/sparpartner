-- ============================================================
-- Migration 0023: create_notification() mit erweitertem
--   Duplikatsschutz (300 Sekunden statt 60)
--
-- Problem: Gleiche Benachrichtigung wurde mehrfach erzeugt
--   (GlobalNotifiers Polling + Realtime + Race Conditions).
--   Lose Datei fix_notification_dedup.sql lag unausgeführt
--   in supabase/ und war auf 60s ausgelegt.
--
-- Loesung: Innerhalb eines 300-Sekunden-Fensters wird eine
--   identische Benachrichtigung
--     (gleiche user_id + type + link + title)
--   nicht nochmal eingefuegt, sondern die vorhandene ID
--   zurueckgegeben.
--   Zusaetzlich: Falls data->>'lead_id' oder data->>'callback_at'
--   gleich sind, wird ebenfalls gededupliziert, auch wenn title
--   leicht abweicht (z.B. anderes Datumsformat).
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT DEFAULT NULL,
  p_link TEXT DEFAULT NULL,
  p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_existing_id UUID;
  v_dedup_window INTERVAL := '300 seconds';
  v_lead_id TEXT;
  v_callback_at TEXT;
BEGIN
  v_lead_id     := p_data->>'lead_id';
  v_callback_at := p_data->>'callback_at';

  -- (1) Duplikatspruefung (strikt): gleiche user_id + type + link + title
  --     innerhalb der letzten 300 Sekunden -> bestehende ID liefern
  SELECT id INTO v_existing_id
    FROM public.notifications
   WHERE user_id = p_user_id
     AND type    = p_type::TEXT
     AND COALESCE(link, '') = COALESCE(p_link, '')
     AND title   = p_title
     AND created_at >= NOW() - v_dedup_window
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  -- (2) Duplikatspruefung (relaxed): gleiche user_id + type +
  --     gleiches data.lead_id oder callback_at
  --     (insb. wichtig fuer lead_assigned / callback_due)
  IF (v_lead_id IS NOT NULL OR v_callback_at IS NOT NULL) THEN
    SELECT id INTO v_existing_id
      FROM public.notifications
     WHERE user_id = p_user_id
       AND type    = p_type::TEXT
       AND (
          (v_lead_id IS NOT NULL AND data->>'lead_id' = v_lead_id)
          OR
          (v_callback_at IS NOT NULL AND data->>'callback_at' = v_callback_at)
       )
       AND created_at >= NOW() - v_dedup_window
     ORDER BY created_at DESC
     LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      RETURN v_existing_id;
    END IF;
  END IF;

  -- (3) Sonst neuen Datensatz anlegen
  INSERT INTO public.notifications (user_id, type, title, body, link, data)
  VALUES (p_user_id, p_type::TEXT, p_title, p_body, p_link, p_data)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;

COMMENT ON FUNCTION public.create_notification IS 'V3 – mit 300s-Duplikatschutz (strikt + relaxed per lead_id/callback_at)';
