-- 0021: Kampagnen-Tracking (UTMs + Meta IDs) & Campaigns Unique Key
-- Fügt filterbare Tracking-Spalten auf leads hinzu und legt einen Unique-Index auf campaigns.external_id
-- an, damit Upserts (ON CONFLICT) beim Anlegen von Kampagnen über API-Endpunkte funktionieren.

SET statement_timeout = 0;

-- =============================================================
-- 1. campaigns: Unique-Index auf external_id für Upsert
-- =============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'campaigns_external_id_key' AND n.nspname = 'public'
  ) THEN
    ALTER TABLE public.campaigns
      ADD CONSTRAINT campaigns_external_id_key UNIQUE (external_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_campaigns_source
  ON public.campaigns (source);
CREATE INDEX IF NOT EXISTS idx_campaigns_is_active
  ON public.campaigns (is_active);

-- =============================================================
-- 2. leads: UTM- & Meta-spezifische Tracking-Spalten
-- =============================================================
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS utm_source text;
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS utm_medium text;
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS utm_campaign text;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS meta_campaign_id text;
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS meta_adset_id text;
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS meta_adset_name text;
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS meta_form_id text;
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS meta_form_name text;

-- Indizes für schnelle Filterung nach UTMs / Meta-IDs
CREATE INDEX IF NOT EXISTS idx_leads_utm_campaign
  ON public.leads (utm_campaign);
CREATE INDEX IF NOT EXISTS idx_leads_utm_source
  ON public.leads (utm_source);
CREATE INDEX IF NOT EXISTS idx_leads_utm_medium
  ON public.leads (utm_medium);
CREATE INDEX IF NOT EXISTS idx_leads_meta_campaign_id
  ON public.leads (meta_campaign_id);
CREATE INDEX IF NOT EXISTS idx_leads_campaign_id
  ON public.leads (campaign_id);

-- =============================================================
-- 3. Kommentare (Dokumentation)
-- =============================================================
COMMENT ON COLUMN public.leads.utm_source IS 'UTM source (z. B. meta, google, landing)';
COMMENT ON COLUMN public.leads.utm_medium IS 'UTM medium (z. B. paid_social, organic)';
COMMENT ON COLUMN public.leads.utm_campaign IS 'UTM campaign – menschenlesbarer Kampagnen-Name';
COMMENT ON COLUMN public.leads.meta_campaign_id IS 'Meta-native Campaign ID (aus Lead Ads Trigger)';
COMMENT ON COLUMN public.leads.meta_adset_id IS 'Meta-native Ad Set ID';
COMMENT ON COLUMN public.leads.meta_adset_name IS 'Meta-native Ad Set Name (für Auswertung nach Werbegruppe)';
COMMENT ON COLUMN public.leads.meta_form_id IS 'Meta-native Lead Form ID';
COMMENT ON COLUMN public.leads.meta_form_name IS 'Meta-native Lead Form Name (Auswertung nach Formular)';
COMMENT ON COLUMN public.campaigns.external_id IS 'Externe Kampagnen-ID (z. B. Meta Campaign ID). Unique, für Upsert/Automatching via API.';
