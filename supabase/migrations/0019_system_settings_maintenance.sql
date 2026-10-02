-- =============================================
-- System Settings Tabelle
-- Key-Value Store für globale Admin-Einstellungen
-- =============================================

CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_settings_admin_read_all" ON public.system_settings;
CREATE POLICY "system_settings_admin_read_all"
  ON public.system_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'admin'
        AND u.is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "system_settings_admin_write_all" ON public.system_settings;
CREATE POLICY "system_settings_admin_write_all"
  ON public.system_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'admin'
        AND u.is_active = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'admin'
        AND u.is_active = TRUE
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_settings TO service_role;

DROP TRIGGER IF EXISTS system_settings_updated_at ON public.system_settings;
CREATE TRIGGER system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Default-Einstellungen initialisieren (UPSERT)
INSERT INTO public.system_settings (key, value)
VALUES
  ('maintenance_mode', '{"enabled": false, "message": "Wartungsarbeiten. Bitte versuche es später erneut."}'::jsonb),
  ('landing_api_enabled', '{"enabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;
