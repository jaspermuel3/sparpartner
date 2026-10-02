-- =====================================================================
-- 0018_SECURITY_RLS_HARDENING.sql
-- =====================================================================
-- Schließt Lücken in RLS-Policies auf:
--   1) audit_logs_insert  : vorher WITH CHECK (TRUE) → JEDER User konnte
--      beliebige Log-Einträge schreiben (fremde user_id, gefälschte
--      details etc.)
--      → Authenticated darf GAR NICHT mehr inserten. Nur service_role
--        (RLS-bypassed) und SECURITY DEFINER-RPCs erlauben den Zugriff.
--        Die App nutzt ausschließlich createAdminClient() → service_role,
--        somit bleibt logAudit() funktionsfähig.
--
--   2) lead_status_history_insert : vorher WITH CHECK (TRUE) → Jeder
--      konnte beliebige Historie-Einträge für fremde Leads erzeugen.
--      → Nur Admin ODER User, dem der Lead zugewiesen ist.
--
--   3) contact_attempts_insert : vorher WITH CHECK (is_admin OR user_id=auth.uid)
--      → Prüfung war OK, aber es fehlte: user_id MUSS gleich auth.uid() sein,
--        wenn nicht Admin. Sonst kann Seller unter fremder User-ID Einträge
--        erzeugen. Jetzt STRICT.
--
--   4) lead_cancellation_requests UPDATE Policy vorher an "authenticated"
--      gerollt; jetzt explizit NUR Admin erlaubt (Seller dürfen NUR INSERT/SELECT
--      auf eigene Anfragen).
--
--   5) archived-Leads RLS-Ergänzung für Seller-Ansicht:
--      Seller sehen generell KEINE archived=true Leads mehr (zusätzlich
--      zu is_deleted). Im Code wird ebenfalls gefiltert (Service Layer),
--      dies ist ein zusätzlicher Datenbank-Schutz (Defence in Depth).
--
--   6) audit_logs Tabelle wird um ein DB-DEFAULT für user_id ergänzt,
--      das über einen Trigger auth.uid() erzwingt, falls nicht gesetzt.
--      Da die App via service_role schreibt, greift dies nicht; es
--      schützt aber für den Fall, dass mal ein authenticated-Insert
--      (z.B. bei fehlkonfigurierten GRANTs) doch erlaubt wird.
--
-- AUSFÜHREN: Supabase Dashboard → SQL Editor → Neue Query → hier einfügen
--           → "Run". Die "DROP POLICY IF EXISTS" machen es idempotent.
-- =====================================================================

DO $$ BEGIN RAISE NOTICE 'Starte 0018_SECURITY_RLS_HARDENING …'; END $$;

-- =====================================================================
-- (1) audit_logs: INSERT-Rechte + POLICY für authenticated ENTFERNEN
-- =====================================================================
DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;

-- KEINE neue INSERT-Policy für authenticated → Standardverhalten von RLS:
--   "Wenn keine Policy passt, ist die Operation verboten."
-- Ergebnis: Authentifizierte User können audit_logs NICHT mehr schreiben.
-- service_role & postgres umgehen RLS → logAudit() via createAdminClient()
--   funktioniert weiterhin.

-- Sicherstellen, dass service_role weiterhin explizit das Recht hat
-- (falls GRANTs in anderen Migrationen nicht gelaufen sind):
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_logs TO service_role;
-- Authenticated NUR select, WENN Admin (dazu behalten wir die SELECT-Policy):
GRANT SELECT ON public.audit_logs TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM authenticated;

-- =====================================================================
-- (2) lead_status_history_insert HARDENED
-- =====================================================================
DROP POLICY IF EXISTS lead_status_history_insert ON public.lead_status_history;

CREATE POLICY lead_status_history_insert ON public.lead_status_history
FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin()
  OR (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_status_history.lead_id
        AND l.assigned_user_id = auth.uid()
        AND l.is_deleted = FALSE
        AND l.archived   = FALSE
    )
  )
);

GRANT INSERT ON public.lead_status_history TO authenticated;

-- =====================================================================
-- (3) contact_attempts_insert HARDENED
-- =====================================================================
DROP POLICY IF EXISTS contact_attempts_insert ON public.contact_attempts;

CREATE POLICY contact_attempts_insert ON public.contact_attempts
FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin()
  OR (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = contact_attempts.lead_id
        AND l.assigned_user_id = auth.uid()
        AND l.is_deleted = FALSE
        AND l.archived   = FALSE
    )
  )
);

GRANT INSERT ON public.contact_attempts TO authenticated;

-- =====================================================================
-- (4) lead_cancellation_requests UPDATE: NUR Admin
-- =====================================================================
DROP POLICY IF EXISTS cancel_req_admin_update ON public.lead_cancellation_requests;

CREATE POLICY cancel_req_admin_update ON public.lead_cancellation_requests
FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

REVOKE UPDATE ON public.lead_cancellation_requests FROM authenticated;
GRANT UPDATE ON public.lead_cancellation_requests TO authenticated;

-- =====================================================================
-- (5) leads RLS ERWEITERUNG: archived = FALSE für Seller
-- =====================================================================
DROP POLICY IF EXISTS leads_select ON public.leads;
CREATE POLICY leads_select ON public.leads FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR (assigned_user_id = auth.uid() AND is_deleted = FALSE AND archived = FALSE)
);

DROP POLICY IF EXISTS leads_update ON public.leads;
CREATE POLICY leads_update ON public.leads FOR UPDATE TO authenticated
USING (
  public.is_admin()
  OR (assigned_user_id = auth.uid() AND is_deleted = FALSE AND archived = FALSE)
)
WITH CHECK (
  public.is_admin()
  OR (assigned_user_id = auth.uid() AND is_deleted = FALSE AND archived = FALSE)
);

-- =====================================================================
-- (6) TRIGGER + DEFAULT-Protect auf audit_logs.user_id
-- =====================================================================
ALTER TABLE public.audit_logs
  ALTER COLUMN user_id SET DEFAULT auth.uid();

CREATE OR REPLACE FUNCTION public.ensure_audit_user_id()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  -- Falls der angemeldete User NICHT service_role/postgres/supabase_admin ist,
  -- darf user_id NUR auth.uid() ODER NULL sein. NULL wird nach auth.uid()
  -- umgesetzt (System-Ausnahmen in der App setzen user_id auf null und
  -- laufen über service_role → dieser Trigger greift also dort NICHT).
  IF current_user NOT IN ('postgres', 'supabase_admin') THEN
    IF NEW.user_id IS NOT NULL AND NEW.user_id <> auth.uid() THEN
      RAISE EXCEPTION 'audit_logs.user_id darf nur eigene UID oder NULL sein.';
    END IF;
    IF NEW.user_id IS NULL THEN
      NEW.user_id := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_audit_user_id ON public.audit_logs;
CREATE TRIGGER trg_ensure_audit_user_id
BEFORE INSERT ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.ensure_audit_user_id();

DO $$ BEGIN RAISE NOTICE '0018_SECURITY_RLS_HARDENING erfolgreich abgeschlossen.'; END $$;
