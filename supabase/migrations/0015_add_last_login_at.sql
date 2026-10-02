-- ============================================================
-- 0015: Letzte-Anmeldung + Account-Wechsel vorbereiten
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.last_login_at IS 'Zeitpunkt der vorherigen erfolgreichen Anmeldung (für "Letzter Login"-Hinweis und Sicherheitscheck)';

GRANT UPDATE ON public.users TO service_role;
GRANT UPDATE ON public.users TO authenticated;
