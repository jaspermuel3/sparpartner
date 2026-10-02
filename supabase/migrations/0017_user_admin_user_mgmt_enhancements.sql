-- ============================================================
-- 0017: Erweiterte Admin-Benutzerverwaltung
-- Spalten: is_deleted, deleted_at, deleted_by, phone, notes, deactivation_reason
-- + Sicherheits-RPC: letzter-Admin-Schutz, delete_user
-- + RLS / Grants
-- ============================================================

-- -------- Spalten auf public.users ergänzen ---------------
DO $$ BEGIN
  ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS phone TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS notes TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

COMMENT ON COLUMN public.users.is_deleted IS 'Soft-Delete: Benutzer unsichtbar für Verkäufer, Admin kann wiederherstellen';
COMMENT ON COLUMN public.users.phone IS 'Telefonnummer des Benutzers (intern)';
COMMENT ON COLUMN public.users.notes IS 'Interne Admin-Notizen zum Benutzer';
COMMENT ON COLUMN public.users.deactivation_reason IS 'Grund der letzten Deaktivierung (Admin)';

-- -------- Index für Soft-Delete + Team + deleted_by
CREATE INDEX IF NOT EXISTS idx_users_is_deleted ON public.users(is_deleted);
CREATE INDEX IF NOT EXISTS idx_users_deleted_by ON public.users(deleted_by);

-- ============================================================
-- RPC 1: delete_user (Soft-Delete) – Service-Rolle; prüft: Letzter-Admin-Schutz
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_user(
  p_user_id UUID,
  p_by_user_id UUID,
  p_reason TEXT DEFAULT ''
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_admin_count INTEGER;
BEGIN
  -- 1) Benutzer holen
  SELECT role INTO v_role FROM public.users WHERE id = p_user_id;
  IF v_role IS NULL THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;

  -- 2) Letzter-Admin-Schutz
  IF v_role = 'admin' AND p_user_id <> p_by_user_id THEN
    SELECT COUNT(*) INTO v_admin_count
      FROM public.users
     WHERE role = 'admin' AND is_active = TRUE AND is_deleted = FALSE AND id <> p_user_id;
    IF v_admin_count = 0 THEN
      RAISE EXCEPTION 'LAST_ADMIN_PROTECTED';
    END IF;
  END IF;

  -- 3) User auch sich selbst nicht löschen können (außer wir wollen das – hier blocken)
  IF p_user_id = p_by_user_id THEN
    RAISE EXCEPTION 'CANNOT_DELETE_SELF';
  END IF;

  -- 4) Public-User soft-deleten (auth.users bleibt erhalten (Referenzsicherheit);
  --    deaktivieren zusätzlich, damit Login nicht mehr geht
  UPDATE public.users
     SET is_deleted   = TRUE,
         deleted_at    = NOW(),
         deleted_by    = p_by_user_id,
         is_active    = FALSE,
         deactivation_reason = CASE WHEN COALESCE(p_reason, '') <> '' THEN p_reason ELSE 'Gelöscht durch Admin' END
   WHERE id = p_user_id;

  RETURN TRUE;
END; $$;

-- ============================================================
-- RPC 2: restore_user (Soft-Delete rückgängig)
-- ============================================================
CREATE OR REPLACE FUNCTION public.restore_user(
  p_user_id UUID,
  p_by_user_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.users WHERE id = p_user_id) INTO v_exists;
  IF NOT v_exists THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;

  UPDATE public.users
     SET is_deleted = FALSE,
         deleted_at = NULL,
         deleted_by = NULL
   WHERE id = p_user_id;

  RETURN TRUE;
END; $$;

-- ============================================================
-- RPC 3: count_active_admins – für UI-Validierung
-- ============================================================
CREATE OR REPLACE FUNCTION public.count_active_admins()
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
    FROM public.users
   WHERE role = 'admin' AND is_active = TRUE AND is_deleted = FALSE;
$$;

-- ============================================================
-- RPC 4: toggle_user_active mit Letzter-Admin-Schutz
-- ============================================================
CREATE OR REPLACE FUNCTION public.toggle_user_active(
  p_user_id UUID,
  p_by_user_id UUID,
  p_set_active BOOLEAN,
  p_reason TEXT DEFAULT ''
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_admin_count INTEGER;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = p_user_id;
  IF v_role IS NULL THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;

  -- Deaktivieren: Schutz für letzten Admin
  IF NOT p_set_active AND v_role = 'admin' THEN
    SELECT COUNT(*) INTO v_admin_count
      FROM public.users
     WHERE role = 'admin' AND is_active = TRUE AND is_deleted = FALSE AND id <> p_user_id;
    IF v_admin_count = 0 THEN
      RAISE EXCEPTION 'LAST_ADMIN_PROTECTED';
    END IF;
  END IF;

  UPDATE public.users
     SET is_active = p_set_active,
         deactivation_reason = CASE
           WHEN NOT p_set_active AND COALESCE(p_reason, '') <> '' THEN p_reason
           WHEN NOT p_set_active THEN 'Manuell deaktiviert'
           ELSE deactivation_reason
         END
   WHERE id = p_user_id;

  RETURN TRUE;
END; $$;

-- ============================================================
-- RLS Policies aktualisieren: is_deleted = FALSE für normale Abfragen
-- ============================================================
DROP POLICY IF EXISTS users_read_own ON public.users;
DROP POLICY IF EXISTS users_admin_all ON public.users;
DROP POLICY IF EXISTS users_sellers_read_active ON public.users;
DROP POLICY IF EXISTS users_authenticated_read ON public.users;

-- Authenticated User: Eigener Datensatz + active Teammitglieder
CREATE POLICY users_authenticated_read ON public.users
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR (
      -- Jeder authentifizierte Benutzer darf aktive, nicht gelöschte Benutzer sehen (für Select-Listen)
      is_active = TRUE AND is_deleted = FALSE
    )
  );

-- RLS + Trigger sicherstellen (nur service_role und owner schreiben implizit via RPC
-- Grants
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;

-- RPC Rechte
GRANT EXECUTE ON FUNCTION public.delete_user(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.restore_user(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.count_active_admins() TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_user_active(UUID, UUID, BOOLEAN, TEXT) TO service_role;
