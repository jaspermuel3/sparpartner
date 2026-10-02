-- =====================================================================
-- 0013_repair_cancellation_policies_and_grants.sql
-- Falls du 0012 bereits ausgeführt hast, OHNE dass Stornos in
-- Admin → Tokens auftauchen, führe DIESE Datei aus.
-- Sie fügt die fehlenden RLS-Policies + expliziten Rechte-GRANTs
-- nachträglich hinzu (idempotent, also beliebig oft ausführbar).
-- =====================================================================

-- (1) Explizite Rechte für service_role (createAdminClient Backend)
GRANT SELECT, INSERT, UPDATE, DELETE ON lead_cancellation_requests TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT SELECT, UPDATE ON leads TO service_role;

-- (2) Explizite Rechte für alle eingeloggten Benutzer (authenticated = Seller + Admin)
GRANT SELECT, INSERT, UPDATE ON lead_cancellation_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON leads TO authenticated;

-- =====================================================================
-- (3) Zusätzliche RLS-Policy: ADMIN darf ALLE Stornos sehen
-- Die bestehende cancel_req_seller_select erlaubt es dem Seller nur die
-- EIGENEN Anfragen + Admin via EXISTS zu sehen. In manchen Supabase-Versionen
-- wird der EXISTS-Zweig aber nicht korrekt ausgewertet. Diese Extra-Policy
-- erlaubt Admin explizit alles, falls die ursprüngliche Policy nicht greift.
-- =====================================================================
DROP POLICY IF EXISTS cancel_req_admin_select ON lead_cancellation_requests;
CREATE POLICY cancel_req_admin_select ON lead_cancellation_requests
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE
  )
);

DROP POLICY IF EXISTS cancel_req_admin_update ON lead_cancellation_requests;
CREATE POLICY cancel_req_admin_update ON lead_cancellation_requests
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE
  )
);

-- (4) Admin darf auch Anfragen auf jeden Fall generell IMMER lesen (ServiceRole)
GRANT SELECT ON lead_cancellation_requests TO postgres;
GRANT SELECT ON leads TO postgres;
