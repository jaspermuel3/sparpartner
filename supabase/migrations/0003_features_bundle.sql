-- =============================================================
-- CRM Migration 0003 — FEATURES BUNDLE
-- -------------------------------------------------------------
-- Features: 4,5,6,7,8,9,13,15,16,19,20,22,25,30,31,32,33,34,
--           35,36,44,46,51,52,53,56,58,59,71,74,76,78,79,80,
--           85,86,95,96,101,104,113
-- -------------------------------------------------------------
-- Hinweis zur Ausführung:
--   Dieses Skript muss IM SUPABASE SQL EDITOR ausgeführt werden
--   (Menü: SQL Editor → New Query → Einfügen → RUN).
--
-- Nach der Ausführung:
--   1. Supabase Dashboard → Storage → New Bucket:
--      Name = "lead-documents", Public = AUS
--      Policy: INSERT/SELECT nur für assigned_user + Admin
--   2. Dashboard → Realtime → Enable Realtime für:
--      Tabelle "leads" → events: INSERT,UPDATE
--      Tabelle "token_transactions" → events: INSERT
--      Optional Tabelle "lead_waitlist"
-- =============================================================
-- Kosten: ca. 0,0000 XCRED

-- =============================================================
-- 1. ENUM audit_action_type erweitern
--    (Werte werden per IF-NOT-EXISTS INSERT in ENUM gemacht)
-- =============================================================
DO $$ BEGIN
  ALTER TYPE audit_action_type ADD VALUE 'LEAD_CREATED';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE audit_action_type ADD VALUE 'DOCUMENT_UPLOADED';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE audit_action_type ADD VALUE 'TAG_ASSIGNED';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE audit_action_type ADD VALUE 'LEAD_HOLD_UPDATED';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================
-- 2. Bestehende Tabellen um neue Spalten ergänzen
-- =============================================================

-- leads: Hold-Status (statt ENUM-Erweiterung)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS is_on_hold BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS hold_notes TEXT NULL;

-- campaigns: erweiterte Meta-Daten für Kampagnen-Management
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS budget_amount NUMERIC NULL;

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS start_date DATE NULL;

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS end_date DATE NULL;

-- =============================================================
-- 3. Neue Tabelle "teams" + users.team_id
-- =============================================================
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS team_id UUID NULL REFERENCES public.teams(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS teams_updated_at ON public.teams;
-- teams hat aktuell kein updated_at, wird bei Bedarf ergänzt.

CREATE INDEX IF NOT EXISTS idx_users_team_id ON public.users(team_id);

-- =============================================================
-- 4. Warteliste für Lead-Anfragen
-- =============================================================
CREATE TABLE IF NOT EXISTS public.lead_waitlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product product_type NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_lead_waitlist_user ON public.lead_waitlist(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_waitlist_created ON public.lead_waitlist(created_at);

ALTER TABLE public.lead_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_waitlist_self_select ON public.lead_waitlist;
CREATE POLICY lead_waitlist_self_select ON public.lead_waitlist
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS lead_waitlist_self_insert ON public.lead_waitlist;
CREATE POLICY lead_waitlist_self_insert ON public.lead_waitlist
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS lead_waitlist_self_delete ON public.lead_waitlist;
CREATE POLICY lead_waitlist_self_delete ON public.lead_waitlist
  FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin());

-- =============================================================
-- 5. Dokumente / Uploads
-- =============================================================
CREATE TABLE IF NOT EXISTS public.lead_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  storage_path TEXT NOT NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_documents_lead ON public.lead_documents(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_documents_created_by ON public.lead_documents(created_by);

ALTER TABLE public.lead_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_documents_read ON public.lead_documents;
CREATE POLICY lead_documents_read ON public.lead_documents
  FOR SELECT
  USING (
    public.is_admin()
    OR
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_documents.lead_id
        AND l.assigned_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS lead_documents_write ON public.lead_documents;
CREATE POLICY lead_documents_write ON public.lead_documents
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND (
      public.is_admin()
      OR
      EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = lead_documents.lead_id
          AND l.assigned_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS lead_documents_delete ON public.lead_documents;
CREATE POLICY lead_documents_delete ON public.lead_documents
  FOR DELETE
  USING (
    public.is_admin()
    OR
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_documents.lead_id
        AND l.assigned_user_id = auth.uid()
    )
  );

-- =============================================================
-- 6. Tags (Schlagwörter)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lead_tags (
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (lead_id, tag_id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_tags_tag ON public.lead_tags(tag_id);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tags_select_all ON public.tags;
CREATE POLICY tags_select_all ON public.tags FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS tags_admin_write ON public.tags;
CREATE POLICY tags_admin_write ON public.tags
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS lead_tags_read ON public.lead_tags;
CREATE POLICY lead_tags_read ON public.lead_tags
  FOR SELECT
  USING (
    public.is_admin()
    OR
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_tags.lead_id
        AND l.assigned_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS lead_tags_write ON public.lead_tags;
CREATE POLICY lead_tags_write ON public.lead_tags
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND (
      public.is_admin()
      OR
      EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = lead_tags.lead_id
          AND l.assigned_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS lead_tags_delete ON public.lead_tags;
CREATE POLICY lead_tags_delete ON public.lead_tags
  FOR DELETE
  USING (
    public.is_admin()
    OR
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_tags.lead_id
        AND l.assigned_user_id = auth.uid()
    )
  );

-- =============================================================
-- 7. Seller Targets (Ziele)
-- =============================================================
CREATE TABLE IF NOT EXISTS public.seller_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL CHECK (period_type IN ('day','week','month')),
  period_label TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('abschluesse','leads','kontaktquote','token_einsparung')),
  target_value NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, period_type, period_label, target_type)
);

CREATE INDEX IF NOT EXISTS idx_seller_targets_user ON public.seller_targets(user_id);

ALTER TABLE public.seller_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS seller_targets_self ON public.seller_targets;
CREATE POLICY seller_targets_self ON public.seller_targets
  FOR ALL
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- =============================================================
-- 8. Notification Preferences
-- =============================================================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  push_callbacks BOOLEAN NOT NULL DEFAULT TRUE,
  push_leads BOOLEAN NOT NULL DEFAULT TRUE,
  push_tokens BOOLEAN NOT NULL DEFAULT TRUE,
  email_summary BOOLEAN NOT NULL DEFAULT FALSE,
  email_tokens BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_preferences_self ON public.notification_preferences;
CREATE POLICY notification_preferences_self ON public.notification_preferences
  FOR ALL
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Auto-Initialisierung neuer User (per Trigger AFTER INSERT auf users)
CREATE OR REPLACE FUNCTION public.ensure_notify_prefs()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_insert_notify_prefs ON public.users;
CREATE TRIGGER users_insert_notify_prefs
AFTER INSERT ON public.users
FOR EACH ROW EXECUTE FUNCTION public.ensure_notify_prefs();

-- Nachträglich vorhandene User befüllen
INSERT INTO public.notification_preferences (user_id)
SELECT id FROM public.users
ON CONFLICT (user_id) DO NOTHING;

-- =============================================================
-- 9. RPCs anpassen und neu erstellen
-- =============================================================

-- 9a) assign_next_lead_to_user um optionalen Produkt-Filter erweitern
--     + is_on_hold = FALSE berücksichtigen
CREATE OR REPLACE FUNCTION public.assign_next_lead_to_user(
  p_user_id UUID,
  p_product product_type DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_balance INT;
  v_lead_id UUID;
  v_cost INT := 1;
BEGIN
  -- Wallet & Balance prüfen
  SELECT id, balance INTO v_wallet_id, v_balance
  FROM public.token_wallets
  WHERE user_id = p_user_id
  LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'WALLET_NOT_FOUND'; END IF;
  IF v_balance < v_cost THEN RAISE EXCEPTION 'NOT_ENOUGH_TOKENS'; END IF;

  -- Lead finden
  SELECT id INTO v_lead_id
  FROM public.leads
  WHERE assigned_user_id IS NULL
    AND status = 'new'
    AND is_on_hold = FALSE
    AND (p_product IS NULL OR product = p_product)
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_lead_id IS NULL THEN RAISE EXCEPTION 'NO_LEAD_AVAILABLE'; END IF;

  UPDATE public.leads
  SET assigned_user_id = p_user_id,
      status = 'assigned',
      updated_at = NOW()
  WHERE id = v_lead_id;

  UPDATE public.token_wallets
  SET balance = balance - v_cost,
      updated_at = NOW()
  WHERE id = v_wallet_id;

  INSERT INTO public.token_transactions
    (wallet_id, user_id, amount, type, reason, lead_id, created_by)
  VALUES (v_wallet_id, p_user_id, (v_cost * -1), 'lead_kauf', 'Lead-Anfrage', v_lead_id, NULL);

  RETURN v_lead_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9b) Duplikat-Suche
CREATE OR REPLACE FUNCTION public.find_duplicate_leads(p_phone TEXT)
RETURNS TABLE (
  lead_id UUID,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  assigned_user_id UUID,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT l.id, l.first_name, l.last_name, l.phone, l.assigned_user_id, l.created_at
  FROM public.leads l
  WHERE l.phone = p_phone
  ORDER BY l.created_at ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 9c) Kontaktzeiten-Heatmap (8-20 Uhr in Stunden × 7 Tage)
CREATE OR REPLACE FUNCTION public.get_contact_time_heatmap(
  p_user_id UUID DEFAULT NULL,
  p_days INT DEFAULT 56
)
RETURNS TABLE (
  day_of_week INT,
  hour_of_day INT,
  attempts INT,
  reached INT
) AS $$
DECLARE
  v_start TIMESTAMPTZ := NOW() - (p_days || ' days')::INTERVAL;
BEGIN
  RETURN QUERY
  SELECT
    EXTRACT(ISODOW FROM c.attempt_date)::INT AS day_of_week,
    EXTRACT(HOUR FROM c.attempt_date)::INT AS hour_of_day,
    COUNT(*)::INT AS attempts,
    SUM(CASE WHEN c.result IN ('rueckruf','interessiert','kein_interesse') THEN 1 ELSE 0 END)::INT AS reached
  FROM public.contact_attempts c
  WHERE c.attempt_date >= v_start
    AND (p_user_id IS NULL OR c.user_id = p_user_id)
    AND EXTRACT(HOUR FROM c.attempt_date) BETWEEN 8 AND 20
  GROUP BY 1, 2
  ORDER BY 1, 2;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =============================================================
-- 10. Indizes für neue Spalten
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_leads_is_on_hold ON public.leads(is_on_hold);
CREATE INDEX IF NOT EXISTS idx_leads_product ON public.leads(product);
CREATE INDEX IF NOT EXISTS idx_campaigns_active ON public.campaigns(is_active);
CREATE INDEX IF NOT EXISTS idx_seller_targets_period ON public.seller_targets(user_id, period_type, period_label);

-- =============================================================
-- FERTIG
-- -------------------------------------------------------------
-- Nach dem Ausführen:
--   [ ] Bucket "lead-documents" im Storage anlegen
--   [ ] RLS Policies für Storage Bucket "lead-documents" setzen
--       (nur zugewiesener Seller + Admin lesen/schreiben)
--   [ ] Realtime Subscriptions freischalten (siehe oben)
-- =============================================================
