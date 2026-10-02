-- ============================================================
-- 0014: Soft-Delete RLS + Policies + Ansichts-Filter FIX
-- ============================================================
-- Problem: Migration 0012 hat ALTEN leads_* Policies aus 0001
-- nicht gelöscht → Konflikte (OR-Verknüpfung aller Policies).
-- Ergebnis: is_deleted=FALSE Filter wurde ignoriert →
-- Seller und Admin sahen gelöschte Leads weiterhin →
-- User annahmte "Löschen geht nicht".
-- ============================================================

-- (1) ALLE Alt-Policies an leads entfernen (0001 + 0012 + 0013)
DROP POLICY IF EXISTS users_select                  ON public.users;
DROP POLICY IF EXISTS users_update                  ON public.users;
DROP POLICY IF EXISTS users_insert                  ON public.users;
DROP POLICY IF EXISTS campaigns_select              ON public.campaigns;
DROP POLICY IF EXISTS campaigns_all                 ON public.campaigns;

DROP POLICY IF EXISTS leads_select                  ON public.leads;
DROP POLICY IF EXISTS leads_insert                  ON public.leads;
DROP POLICY IF EXISTS leads_update                  ON public.leads;
DROP POLICY IF EXISTS leads_delete                  ON public.leads;
DROP POLICY IF EXISTS leads_seller_select_existing  ON public.leads;
DROP POLICY IF EXISTS leads_admin_see_all           ON public.leads;

DROP POLICY IF EXISTS lead_status_history_select    ON public.lead_status_history;
DROP POLICY IF EXISTS lead_status_history_insert    ON public.lead_status_history;

DROP POLICY IF EXISTS contact_attempts_select       ON public.contact_attempts;
DROP POLICY IF EXISTS contact_attempts_insert       ON public.contact_attempts;

DROP POLICY IF EXISTS callbacks_select              ON public.callbacks;
DROP POLICY IF EXISTS callbacks_insert              ON public.callbacks;
DROP POLICY IF EXISTS callbacks_update              ON public.callbacks;

DROP POLICY IF EXISTS token_wallets_select          ON public.token_wallets;
DROP POLICY IF EXISTS token_wallets_update          ON public.token_wallets;

DROP POLICY IF EXISTS token_transactions_select     ON public.token_transactions;
DROP POLICY IF EXISTS token_transactions_insert     ON public.token_transactions;

DROP POLICY IF EXISTS audit_logs_select             ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_insert             ON public.audit_logs;

DROP POLICY IF EXISTS cancel_req_seller_select      ON public.lead_cancellation_requests;
DROP POLICY IF EXISTS cancel_req_seller_insert      ON public.lead_cancellation_requests;
DROP POLICY IF EXISTS cancel_req_admin_update       ON public.lead_cancellation_requests;
DROP POLICY IF EXISTS cancel_req_admin_select       ON public.lead_cancellation_requests;

-- ============================================================
-- (2) policies RECREATE (sauber, KEINE Doppelten mehr!)
-- ============================================================

-- users (Profile) — Admin darf alles; User eigenes Profil
CREATE POLICY users_select ON public.users FOR SELECT
USING (auth.uid() = id OR public.is_admin());

CREATE POLICY users_update ON public.users FOR UPDATE
USING (auth.uid() = id OR public.is_admin());

CREATE POLICY users_insert ON public.users FOR INSERT
WITH CHECK (public.is_admin() OR auth.uid() = id);

-- campaigns
CREATE POLICY campaigns_select ON public.campaigns FOR SELECT
USING (public.is_active_seller() OR public.is_admin());

CREATE POLICY campaigns_all ON public.campaigns FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ============================================================
-- LEADS — KRITISCHER FIX: is_deleted = FALSE standardmäßig!
-- ============================================================
-- SELECT:
--  Admin:   DARF grundsätzlich auch gelöschte sehen (Soft-Delete via UI-Archiv)
--  Seller:  NUR eigene, aktive (is_deleted = FALSE)
CREATE POLICY leads_select ON public.leads FOR SELECT
USING (
  public.is_admin()
  OR (assigned_user_id = auth.uid() AND is_deleted = FALSE)
);

-- INSERT: Nur Admin
CREATE POLICY leads_insert ON public.leads FOR INSERT
WITH CHECK (public.is_admin());

-- UPDATE:
--  Admin:  alles erlaubt (auch is_deleted auf true setzen!)
--  Seller: NUR eigene, NICHT gelöschte → assigned_user_id = auth.uid() AND is_deleted = FALSE
CREATE POLICY leads_update ON public.leads FOR UPDATE
USING (
  public.is_admin()
  OR (assigned_user_id = auth.uid() AND is_deleted = FALSE)
)
WITH CHECK (
  public.is_admin()
  OR (assigned_user_id = auth.uid() AND is_deleted = FALSE)
);

-- DELETE (Hard-Delete): NUR Admin
CREATE POLICY leads_delete ON public.leads FOR DELETE
USING (public.is_admin());

-- lead_status_history
CREATE POLICY lead_status_history_select ON public.lead_status_history FOR SELECT
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_status_history.lead_id
      AND l.assigned_user_id = auth.uid()
      AND l.is_deleted = FALSE
  )
);

CREATE POLICY lead_status_history_insert ON public.lead_status_history FOR INSERT
WITH CHECK (TRUE);

-- contact_attempts
CREATE POLICY contact_attempts_select ON public.contact_attempts FOR SELECT
USING (
  public.is_admin()
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = contact_attempts.lead_id
      AND l.assigned_user_id = auth.uid()
      AND l.is_deleted = FALSE
  )
);

CREATE POLICY contact_attempts_insert ON public.contact_attempts FOR INSERT
WITH CHECK (public.is_admin() OR user_id = auth.uid());

-- callbacks
CREATE POLICY callbacks_select ON public.callbacks FOR SELECT
USING (public.is_admin() OR user_id = auth.uid());

CREATE POLICY callbacks_insert ON public.callbacks FOR INSERT
WITH CHECK (public.is_admin() OR user_id = auth.uid());

CREATE POLICY callbacks_update ON public.callbacks FOR UPDATE
USING (public.is_admin() OR user_id = auth.uid())
WITH CHECK (public.is_admin() OR user_id = auth.uid());

-- token_wallets
CREATE POLICY token_wallets_select ON public.token_wallets FOR SELECT
USING (public.is_admin() OR user_id = auth.uid());

CREATE POLICY token_wallets_update ON public.token_wallets FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- token_transactions
CREATE POLICY token_transactions_select ON public.token_transactions FOR SELECT
USING (public.is_admin() OR user_id = auth.uid());

CREATE POLICY token_transactions_insert ON public.token_transactions FOR INSERT
WITH CHECK (public.is_admin() OR user_id = auth.uid());

-- audit_logs
CREATE POLICY audit_logs_select ON public.audit_logs FOR SELECT
USING (public.is_admin());

CREATE POLICY audit_logs_insert ON public.audit_logs FOR INSERT
WITH CHECK (TRUE);

-- lead_cancellation_requests
-- SELECT: Seller eigene Anfragen; Admin ALLE
CREATE POLICY cancel_req_seller_select ON public.lead_cancellation_requests
FOR SELECT TO authenticated
USING (
  requested_by = auth.uid() OR public.is_admin()
);

-- INSERT: Seller darf eigene erstellen (Status=pending, Lead muss ihm gehören)
CREATE POLICY cancel_req_seller_insert ON public.lead_cancellation_requests
FOR INSERT TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  AND status = 'pending'
  AND EXISTS (
    SELECT 1 FROM public.leads
    WHERE id = lead_id
      AND assigned_user_id = auth.uid()
      AND is_deleted = FALSE
  )
);

-- UPDATE: Admin darf alles (review)
CREATE POLICY cancel_req_admin_update ON public.lead_cancellation_requests
FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ============================================================
-- (3) EXPLIZITE Rechte (service_role + authenticated)
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON leads                   TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON lead_status_history     TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON lead_cancellation_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON contact_attempts        TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON callbacks               TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON token_wallets           TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON token_transactions      TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON audit_logs              TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON users                   TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON campaigns               TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE ON leads                        TO authenticated;
GRANT SELECT, INSERT         ON lead_status_history          TO authenticated;
GRANT SELECT, INSERT, UPDATE ON lead_cancellation_requests   TO authenticated;
GRANT SELECT, INSERT         ON contact_attempts             TO authenticated;
GRANT SELECT, INSERT, UPDATE ON callbacks                    TO authenticated;
GRANT SELECT                 ON token_wallets                TO authenticated;
GRANT SELECT, INSERT         ON token_transactions           TO authenticated;
GRANT SELECT, INSERT         ON audit_logs                   TO authenticated;
GRANT SELECT, UPDATE         ON users                        TO authenticated;
GRANT SELECT                 ON campaigns                    TO authenticated;

-- ============================================================
-- (4) Konsistenz-Check: Bereits als gelöscht markierte Leads
--     sollen aus Seller-Ansicht sofort verschwinden.
--     (Policy oben sorgt dafür; hier nur Doku-Statement)
-- ============================================================
COMMENT ON COLUMN public.leads.is_deleted IS 'Soft-Delete: TRUE → Lead nur noch sichtbar in Admin Archiv (is_admin() = TRUE)';
