-- ============================================================
-- HOTFIX: create_notification() mit Duplikatsschutz
-- ============================================================
-- Problem: Gleiche Benachrichtigung wurde mehrfach erzeugt
--   (GlobalNotifiers Polling + Realtime + Race Conditions).
--
-- Loesung: Innerhalb eines 60-Sekunden-Fensters wird eine
--   identische Benachrichtigung (user_id + type + link + title)
--   nicht nochmal eingefuegt, sondern die vorhandene ID
--   zurueckgegeben.
--
-- Ausfuehren im Supabase Dashboard -> SQL Editor.
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
  v_dedup_window INTERVAL := '60 seconds';
BEGIN
  -- (1) Duplikatspruefung: gleiche user_id + type + link + title
  --     innerhalb der letzten 60 Sekunden -> bestehende ID liefern
  SELECT id INTO v_existing_id
    FROM public.notifications
   WHERE user_id = p_user_id
     AND type    = p_type
     AND COALESCE(link, '') = COALESCE(p_link, '')
     AND title   = p_title
     AND created_at >= NOW() - v_dedup_window
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  -- (2) Sonst neuen Datensatz anlegen
  INSERT INTO public.notifications (user_id, type, title, body, link, data)
  VALUES (p_user_id, p_type, p_title, p_body, p_link, p_data)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;

COMMENT ON FUNCTION public.create_notification IS 'V2 – mit 60s-Duplikatschutz (user_id + type + link + title)';
