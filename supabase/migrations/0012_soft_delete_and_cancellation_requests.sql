-- ============================================================
-- 0012: Soft-Delete für Leads + Stornierungs-Anfragen (Seller → Admin)
-- ============================================================

-- 1) Spalten für Soft-Delete an leads anfügen
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_is_deleted ON leads(is_deleted);
CREATE INDEX IF NOT EXISTS idx_leads_deleted_at ON leads(deleted_at);

-- 2) lead_cancellation_requests - Anfragen von Verkäufern
CREATE TABLE IF NOT EXISTS lead_cancellation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  refund_tokens BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cancel_req_status ON lead_cancellation_requests(status);
CREATE INDEX IF NOT EXISTS idx_cancel_req_lead ON lead_cancellation_requests(lead_id);
CREATE INDEX IF NOT EXISTS idx_cancel_req_requester ON lead_cancellation_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_cancel_req_created ON lead_cancellation_requests(created_at DESC);

-- 3) Trigger für updated_at
CREATE OR REPLACE FUNCTION set_cancellation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cancel_req_updated ON lead_cancellation_requests;
CREATE TRIGGER trg_cancel_req_updated
BEFORE UPDATE ON lead_cancellation_requests
FOR EACH ROW EXECUTE FUNCTION set_cancellation_updated_at();

-- 4) RLS
ALTER TABLE lead_cancellation_requests ENABLE ROW LEVEL SECURITY;

-- Seller: darf eigene Anfragen sehen + erstellen
DROP POLICY IF EXISTS cancel_req_seller_select ON lead_cancellation_requests;
CREATE POLICY cancel_req_seller_select ON lead_cancellation_requests
FOR SELECT TO authenticated
USING (
  requested_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE
  )
);

DROP POLICY IF EXISTS cancel_req_seller_insert ON lead_cancellation_requests;
CREATE POLICY cancel_req_seller_insert ON lead_cancellation_requests
FOR INSERT TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  AND status = 'pending'
  AND EXISTS (
    SELECT 1 FROM leads WHERE id = lead_id AND assigned_user_id = auth.uid()
  )
);

-- Admin: darf alles aktualisieren (review)
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

-- 5) RLS an leads anpassen, so dass gelöschte standardmäßig unsichtbar sind
--    (Admin darf sie weiterhin über die RLS-Policies sehen)
DROP POLICY IF EXISTS leads_seller_select_existing ON leads;
DROP POLICY IF EXISTS leads_admin_see_all ON leads;

-- Seller sehen nur nicht-gelöschte, zugewiesene
CREATE POLICY leads_seller_select_existing ON leads
FOR SELECT TO authenticated
USING (
  assigned_user_id = auth.uid() AND is_deleted = FALSE
);

-- Admin sehen ALLE (auch gelöschte) – RLS wird durch den bestehenden Admin-Policy abgedeckt.
-- Falls er nicht existiert, explizit anlegen (DROP IF EXISTS ist bereits in Zeile 92 passiert):
CREATE POLICY leads_admin_see_all ON leads
FOR ALL TO authenticated
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

-- =====================================================================
-- (ZUSATZ 2025-10-02) Explizite Rechte + zusätzliche Policies, damit
-- Storno-Anfragen GARANTIERT auch auf Vercel-Produktion sichtbar sind.
-- Hintergrund: Manchmal fehlen Default-Grants an service_role
-- (Service-Role Key) bzw. authenticated-Rolle nach CREATE TABLE.
-- =====================================================================

-- Explizite Rechte für service_role (Backend nutzt Service Role Key via createAdminClient)
GRANT SELECT, INSERT, UPDATE, DELETE ON lead_cancellation_requests TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Explizite Rechte für authenticated (Seller + Admin Logged-In User via Browser)
GRANT SELECT, INSERT, UPDATE ON lead_cancellation_requests TO authenticated;

-- Explizite Rechte an leads soft-delete Spalten: authenticated darf upgedaten
GRANT SELECT, INSERT, UPDATE, DELETE ON leads TO authenticated;
GRANT SELECT, UPDATE ON leads TO service_role;

-- Admin explizite CancelSelectPolicy (Zusatzsicherheit, falls EXISTS-Clause aus Seller-Policy nicht matcht)
DROP POLICY IF EXISTS cancel_req_admin_select ON lead_cancellation_requests;
CREATE POLICY cancel_req_admin_select ON lead_cancellation_requests
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE
  )
);

-- 6) Views für Admin-Listen filtern standardmäßig is_deleted=false,
--    falls nicht anders angegeben. Hier als RPC-Helper, der in der App Fallback-Logik ergänzt.
COMMENT ON COLUMN leads.is_deleted IS 'Soft-Delete: TRUE = Lead ist aus Benutzer-Sicht entfernt';
COMMENT ON TABLE lead_cancellation_requests IS 'Verkäufer beantragen Stornierung, Admin genehmigt/ablehnt';
