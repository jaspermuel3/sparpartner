-- ============================================================
-- 0018: created_by Spalte zur teams-Tabelle hinzufügen
-- ============================================================
-- Fehlerursache: teams.service.ts setzt created_by beim INSERT,
-- aber die Spalte existierte nicht im Schema → Supabase Schema
-- Cache-Fehler "Could not find the 'created_by' column of 'teams'"
-- ============================================================

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS created_by UUID NULL
  REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_teams_created_by ON public.teams(created_by);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS teams_select_admin ON public.teams;
CREATE POLICY teams_select_admin ON public.teams
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'admin'::public.user_role
        AND u.is_deleted = FALSE
        AND u.is_active = TRUE
    )
  );

DROP POLICY IF EXISTS teams_insert_admin ON public.teams;
CREATE POLICY teams_insert_admin ON public.teams
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'admin'::public.user_role
        AND u.is_deleted = FALSE
        AND u.is_active = TRUE
    )
  );

DROP POLICY IF EXISTS teams_update_admin ON public.teams;
CREATE POLICY teams_update_admin ON public.teams
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'admin'::public.user_role
        AND u.is_deleted = FALSE
        AND u.is_active = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'admin'::public.user_role
        AND u.is_deleted = FALSE
        AND u.is_active = TRUE
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO service_role;
