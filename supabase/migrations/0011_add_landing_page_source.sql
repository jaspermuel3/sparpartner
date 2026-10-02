-- =========================================================
-- 0011 – Lead-Quelle "landing_page" + Lead-Tabelle Kampagnen-Link Index
-- Manuell im Supabase SQL-Editor ausführen!
-- =========================================================

ALTER TYPE public.lead_source ADD VALUE IF NOT EXISTS 'landing_page';

CREATE INDEX IF NOT EXISTS idx_leads_source_created
  ON public.leads(source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_campaign_source
  ON public.leads(campaign_id, source);
