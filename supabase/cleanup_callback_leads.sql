-- ============================================================
-- CLEANUP: Alle Leads mit AKTIVEN (offenen) Ruecken ENTFERNEN
-- ============================================================
-- Diese Leads haben status='callback' und mindestens einen
-- offenen Rueckruf-Eintrag in der callbacks Tabelle.
--
-- Durchgefuehrte Aktionen:
--   1. Alle offenen callbacks auf "storniert" setzen
--   2. Zugehoerige leads:
--        - is_deleted  = TRUE
--        - deleted_at  = NOW()
--        - deleted_by  = NULL (Automatismus / System)
--        - status      = 'archived'
--        - is_active   = FALSE
--        - deletion_reason = 'Automatische Bereinigung: Aktiver Rückruf (System-Cleanup)'
--   3. Lead-Storno-Anfragen dieser Leads auf 'approved' setzen
--
-- Diagnose-Query VORHER / NACHHER ist unten enthalten.
--
-- Ausfuehren im Supabase Dashboard -> SQL Editor.
-- ============================================================

-- ------------------------------------------------------------
-- (0) Diagnose: welche Leads + Ruecke sind betroffen?
-- ------------------------------------------------------------
SELECT
  l.id                         AS lead_id,
  l.first_name || ' ' || l.last_name AS lead_name,
  l.status                     AS lead_status,
  l.assigned_user_id           AS seller_id,
  u.email                      AS seller_email,
  COUNT(c.id)                  AS offene_ruecke,
  MIN(c.callback_at)           AS aeltester_rueckruf_termin
FROM public.leads l
LEFT JOIN public.users u      ON u.id = l.assigned_user_id
JOIN  public.callbacks c      ON c.lead_id = l.id AND c.status = 'offen'
WHERE l.is_deleted = FALSE
  AND l.status = 'callback'
GROUP BY l.id, l.first_name, l.last_name, l.status, l.assigned_user_id, u.email
ORDER BY aeltester_rueckruf_termin ASC;

-- ------------------------------------------------------------
-- (1) Betroffene offene Ruecke stornieren
-- ------------------------------------------------------------
UPDATE public.callbacks c
   SET status     = 'storniert',
       updated_at = NOW()
 WHERE c.status = 'offen'
   AND EXISTS (
         SELECT 1 FROM public.leads l
          WHERE l.id = c.lead_id
            AND l.is_deleted = FALSE
            AND l.status = 'callback'
       );

-- ------------------------------------------------------------
-- (2) Zugehoerige Leads soft-deleten + archivieren
-- ------------------------------------------------------------
UPDATE public.leads l
   SET is_deleted        = TRUE,
       deleted_at        = NOW(),
       deleted_by        = NULL,
       status            = 'archived',
       is_active         = FALSE,
       deletion_reason   = 'Automatische Bereinigung: Aktiver Rückruf (System-Cleanup)',
       updated_at        = NOW()
 WHERE l.is_deleted = FALSE
   AND l.status = 'callback'
   AND EXISTS (
         SELECT 1 FROM public.callbacks c
          WHERE c.lead_id = l.id
            AND c.status = 'storniert'
       );

-- ------------------------------------------------------------
-- (3) Ausstehende Storno-Anträge dieser Leads genehmigen
--     (damit sie nicht mehr im Admin-Tokens-Bereich auftauchen)
-- ------------------------------------------------------------
UPDATE public.lead_cancellation_requests r
   SET status        = 'approved',
       reviewed_at   = NOW(),
       review_notes  = COALESCE(review_notes, '') || ' [Auto-Approved: Lead durch Rückruf-Bereinigung gelöscht]',
       updated_at    = NOW()
 WHERE r.status = 'pending'
   AND EXISTS (
         SELECT 1 FROM public.leads l
          WHERE l.id = r.lead_id
            AND l.is_deleted = TRUE
       );

-- ------------------------------------------------------------
-- (4) Diagnose NACHHER: Pruefe Ergebnis
-- ------------------------------------------------------------
SELECT
  'Anpassungen Ruecke'  AS massnahme,
  COUNT(*)              AS anzahl
FROM public.callbacks
WHERE status = 'storniert'
  AND updated_at >= NOW() - INTERVAL '5 minutes'
UNION ALL
SELECT
  'Geloeschte Leads'    AS massnahme,
  COUNT(*)              AS anzahl
FROM public.leads
WHERE is_deleted = TRUE
  AND deletion_reason = 'Automatische Bereinigung: Aktiver Rückruf (System-Cleanup)';
