# CRM Features Bundle Implementation Plan

Bezug: Anforderung **4, 5, 6, 7, 8, 9, 13, 15, 16, 19, 20, 22, 25, 30, 31, 32, 33, 34, 35, 36, 44, 46, 51, 52, 53, 56, 58, 59, 71, 74, 76, 78, 79, 80, 85, 86, 95, 96, 101, 104, 113** aus der nummerierten Ideen-Liste.

> Hinweis: **16** und **113** sind inhaltsgleich (Trend-Pfeile in StatCards) und werden nur einmal umgesetzt.

---

## 1. Repository Research & Constraints

### Architektur
- Next.js 14.2 App Router + Server Components
- Supabase (@supabase/ssr + auth-helpers + Middleware Cookie-Adapter)
- UI-Primitive: Radix UI (via shadcn-style Komponenten in `src/components/ui`)
- Lucide Icons, Tailwind v3, Recharts (bereits in `package.json` vorhanden!), sonner (Toasts), next-themes (für Density)
- Alle Server Actions in [actions.ts](file:///c:/Users/jaspe/Documents/trae_projects/CRM/src/app/actions.ts)
- Services / DB-Zugriffe in `src/lib/services/*`
- Typen in [src/types/index.ts](file:///c:/Users/jaspe/Documents/trae_projects/CRM/src/types/index.ts)
- Konstanten/Labels und Formatierer in [src/lib/constants.ts](file:///c:/Users/jaspe/Documents/trae_projects/CRM/src/lib/constants.ts)

### Hard Constraints (aus project_memory)
- **Keine** Supabase-IDE-Integration / Run-Button verwenden
- Migrationen + Seeds werden als **SQL-Skripte** ausgeliefert, die der Nutzer im Supabase SQL Editor ausführt
- Server Actions mit `useFormState` → **kein** `redirect()` direkt, sondern `redirectTo` zurück und clientseitig via `router.push()`

### Bereits vorhandene, nutzbare Abhängigkeiten
- `recharts` → Funnel-Diagramm, Kampagnen-Charts, Heatmap-Visualisierungen
- `next-themes` → Density-Schalter (Provider bereits installiert)
- `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-checkbox`, `@radix-ui/react-tabs` → für alle neuen Modals/Filter

---

## 2. SQL-Migrationen (Batch-0: Schema)

**Datei**: `supabase/migrations/0003_features_bundle.sql` — muss vom Nutzer **vor** Code-Änderungen im Supabase SQL Editor ausgeführt werden.

### Hinzuzufügende Tabellen / Spalten

| Feature | Änderung |
|---------|----------|
| #20 Produkt-Filter | Spalte `token_cost` bleibt; RPC `assign_next_lead_to_user` erhält optionalen Parameter `p_product product_type DEFAULT NULL` |
| #22 Warteliste | Tabelle `lead_waitlist(id PK, user_id FK users, product product_type NULL, created_at, notified_at NULL)` + Index |
| #30 Duplikat-Warnung | Keine neue Spalte nötig; View/Query auf `leads.phone` Gruppierung |
| #46 Dokumente | Tabelle `lead_documents(id PK, lead_id FK leads, file_name, mime_type, size_bytes, storage_path, created_by FK users, created_at)` + RLS-Politik + Storage Bucket `lead-documents` |
| #51 Tags | Tabelle `tags(id PK, name UNIQUE, color, created_at)` + Junction `lead_tags(lead_id FK, tag_id FK, PK(lead_id, tag_id))` |
| #74 Hold-Status | ENUM-Erweiterung `lead_status`: Neuer Wert `'on_hold'` **ODER** (sauberer) – separate Spalte `leads.is_on_hold BOOLEAN DEFAULT FALSE` + `hold_notes TEXT NULL`; wir wählen die separate Spalte, weil bestehende Status-Reports nicht brechen sollen |
| #76 Kampagnen UI | Bestehende `campaigns` Tabelle erhält `is_active BOOLEAN DEFAULT TRUE` + `budget_amount NUMERIC NULL`, `start_date DATE NULL`, `end_date DATE NULL` |
| #78 Lead-Alter | Keine DB-Spalte, wird in App-Logik aus `created_at` berechnet |
| #79 Massen-Token Aufladung | Bestehende Tabellen reichen |
| #80 Teams | Tabelle `teams(id PK, name, color, created_at)` + Spalte `users.team_id UUID FK teams NULL` |
| #15 + #58 Ziele / Tagesziel | Tabelle `seller_targets(id PK, user_id FK users, period_type TEXT CHECK (period_type IN ('day','week','month')), period_label TEXT, target_type TEXT CHECK(target_type IN ('abschluesse','leads','kontaktquote')), target_value NUMERIC, created_at, UNIQUE(user_id, period_type, period_label))` |
| #101 Notification-Prefs | Tabelle `notification_preferences(user_id PK FK users, push_callbacks BOOLEAN DEFAULT TRUE, push_leads BOOLEAN DEFAULT TRUE, push_tokens BOOLEAN DEFAULT TRUE, email_summary BOOLEAN DEFAULT FALSE, email_tokens BOOLEAN DEFAULT TRUE)` |
| #8 Offline / Submit Queue | Tabelle `pending_submissions(id PK, user_id FK users, action_type TEXT, payload JSONB, created_at)` (optional; einfacherer Ansatz: localStorage + Retry on Load) |
| #9 Echtzeit-Benachrichtigungen | Kein DB-Objekt, Realtime-Channel wird clientseitig abonniert |

### ENUM-Ergänzungen
- `audit_action_type`: Neuer Wert `'LEAD_CREATED'` für #71, `'DOCUMENT_UPLOADED'` für #46, `'TAG_ASSIGNED'` für #51, `'LEAD_HOLD_UPDATED'` für #74

### RPC-Anpassungen
- `assign_next_lead_to_user(p_user_id UUID, p_product product_type DEFAULT NULL)`: Filtert `leads.product = p_product`, falls gesetzt; zusätzlich `AND is_on_hold = FALSE`
- Neue RPC `find_duplicate_leads(p_phone TEXT)` → Gibt IDs von Leads mit identischer Telefonnummer zurück
- Neue RPC `get_contact_time_heatmap(p_user_id UUID, p_days INT DEFAULT 56)` → Aggregiert Kontaktversuche pro (Wochentag × Stunde)

### RLS Policies
- `lead_waitlist`: `true` für `auth.uid() = user_id` (Eintrag selber lesen/erstellen)
- `lead_documents`: RLS Policy `auth.uid() IN (SELECT assigned_user_id FROM leads WHERE id = lead_id) OR is_admin(auth.uid())` — Schreiben nur für zugewiesenen Verkäufer + Admin, Lesen ebenfalls
- `tags`: Admin-only Schreiben, Lesen für alle authentifizierten
- `teams`: Admin-only Schreiben, Lesen für alle authentifizierten
- `seller_targets`: User-only Schreiben/Lesen für eigene Zeilen + Admin

---

## 3. Files & Modules to Change

### Neue Dateien
- `supabase/migrations/0003_features_bundle.sql`
- `src/components/layout/Breadcrumb.tsx`
- `src/components/ui-custom/CollapsibleCard.tsx`
- `src/components/ui-custom/CopyButton.tsx`
- `src/components/ui-custom/SkeletonShimmer.tsx`
- `src/components/ui-custom/DensityProvider.tsx` (erweitert `next-themes` Provider)
- `src/components/ui-custom/NotificationsProvider.tsx` (Realtime + Push)
- `src/components/ui-custom/OfflineIndicator.tsx`
- `src/components/ui-custom/QuickFilterChips.tsx`
- `src/components/ui-custom/ColumnSelector.tsx`
- `src/components/ui-custom/LeadAvatar.tsx`
- `src/components/ui-custom/TagInput.tsx`
- `src/components/ui-custom/TargetProgressBar.tsx`
- `src/components/ui-custom/HeatmapGrid.tsx`
- `src/components/ui-custom/CalendarView.tsx` (für #36)
- `src/hooks/useDensity.ts`
- `src/hooks/useNotifyPrefs.ts`
- `src/lib/services/tags.service.ts`
- `src/lib/services/documents.service.ts`
- `src/lib/services/teams.service.ts`
- `src/lib/services/targets.service.ts`
- `src/lib/services/waitlist.service.ts`
- `src/lib/services/campaigns.service.ts`
- `src/app/(sales)/my-leads/BulkActions.tsx`
- `src/app/(sales)/leads/[id]/StickyActionBar.tsx`
- `src/app/(sales)/leads/[id]/DocumentUploader.tsx`
- `src/app/(sales)/leads/[id]/TimelineFilters.tsx`
- `src/app/(sales)/leads/[id]/TagEditor.tsx`
- `src/app/(admin)/admin/leads/CreateLeadDialog.tsx`
- `src/app/(admin)/admin/leads/HoldLeadDialog.tsx`
- `src/app/(admin)/admin/campaigns/page.tsx` (neuer Reiter)
- `src/app/(admin)/admin/sellers/[id]/page.tsx` (Verkäufer-Detail)
- `src/app/(admin)/admin/dashboard/FunnelChart.tsx`
- `src/app/(admin)/admin/dashboard/CampaignReport.tsx`
- `src/app/(admin)/admin/sellers/BulkTokenForm.tsx`

### Modifizierte Dateien
- `src/types/index.ts`
- `src/lib/constants.ts`
- `src/components/layout/Sidebar.tsx` ( #4 Collapse)
- `src/components/layout/PageHeader.tsx` ( #5 Breadcrumb-Slot + Hover-Style #6)
- `src/components/ui-custom/StatCard.tsx` ( #16/#113: Trend-Pfeil)
- `src/app/layout.tsx` (Provider für Density, Notifications, Offline)
- `src/app/(sales)/layout.tsx` (Breadcrumb-Start)
- `src/app/(admin)/layout.tsx` (Breadcrumb-Start + Kampagnen-Nav-Eintrag #76)
- `src/app/(sales)/dashboard/page.tsx` (#13, #15, #16/#113, #19)
- `src/app/(sales)/request-lead/page.tsx` + RequestForm.tsx (#20, #22, #25)
- `src/app/(sales)/my-leads/page.tsx` (#30, #31, #32, #33, #34, #35)
- `src/app/(sales)/callbacks/page.tsx` (#36 Kalender-Toggle)
- `src/app/(sales)/leads/[id]/page.tsx` (#44, #46, #51, #52, #53, #56)
- `src/app/(sales)/stats/page.tsx` (#58, #59)
- `src/app/(admin)/admin/leads/page.tsx` + AdminLeadDialogs.tsx (#71, #74, #78)
- `src/app/(admin)/admin/sellers/page.tsx` + AdminSellerDialogs.tsx (#79, #80, #86)
- `src/app/(admin)/admin/stats/page.tsx` (#95, #96)
- `src/app/(sales)/settings/page.tsx` (#101, #104)
- `src/app/(admin)/admin/settings/page.tsx` (#104)
- `src/app/actions.ts` (alle neuen Actions)
- `src/lib/services/leads.service.ts` (requestLead, getMyLeads)
- `src/lib/services/admin.service.ts` (adminCreateLead, toggleHold, Kampagnen-Statistiken)
- `src/lib/audit.ts` (neue Audit-Action-Typen)

---

## 4. Implementation Steps (Dependency-Ordered Batches)

### Batch A — Infrastruktur & Schema
1. **0003_features_bundle.sql** schreiben und als manuell auszuführendes SQL vorbereiten
2. **Types** in [index.ts](file:///c:/Users/jaspe/Documents/trae_projects/CRM/src/types/index.ts) ergänzen (Interfaces für Document, Tag, Team, Target, NotificationPrefs, neue Audit-Action-Enum-Werte, `is_on_hold` und `hold_notes` auf Lead)
3. **Constants** in [constants.ts](file:///c:/Users/jaspe/Documents/trae_projects/CRM/src/lib/constants.ts) ergänzen (neue Labels + `formatDaysSince`, `formatRelative`)
4. **Audit-Modul**: Neue Action-Typen in `logAudit` ermöglichen

### Batch B — Globale UI Foundation (Layout + Primitives)
5. **DensityProvider & useDensity**: Drei Modi `compact | normal | spacious`, setzen CSS-Variablen für `--padding-card`, `--padding-cell` etc.; Einstellung wird in localStorage gemerkt; Provider in `app/layout.tsx` einhängen
6. **Sidebar Collapse** [Sidebar.tsx](file:///c:/Users/jaspe/Documents/trae_projects/CRM/src/components/layout/Sidebar.tsx): Toggle-Button oben rechts im Desktop-Aside; einklappen zeigt nur Icons + Tooltips; breite wird zu `w-16`; Zustand in localStorage merken
7. **Breadcrumb** [Breadcrumb.tsx](file:///c:/Users/jaspe/Documents/trae_projects/CRM/src/components/layout/Breadcrumb.tsx) + PageHeader-Erweiterung um `breadcrumb?: BreadcrumbItem[]`-Prop; Breadcrumbs in `PageHeader` oberhalb des Titels rendern; Startpunkte in `(sales)/layout.tsx` (`Dashboard ›`) und `(admin)/layout.tsx` (`Admin ›`) setzen
8. **Consistent Card Hover**: Globale `.card-hoverable` Utility-Klasse in globals.css mit `transition-all duration-200 hover:translate-y-[-1px] hover:shadow-md`, anwenden auf Card in StatCard, Callbacks-Karte, Dashboard-Activities etc.
9. **SkeletonShimmer**: Ersetzt die aktuelle statische `<Skeleton/>` Komponente durch einen animierten `bg-gradient + bg-[length:200%] + animate-shimmer`; alten Skeleton-Style nicht verändern, sondern `SkeletonShimmer.tsx` als neuen Export anlegen und bei Bedarf einbauen
10. **OfflineIndicator**: `useEffect` mit `window.navigator.onLine` + Event-Listener `online/offline`; Fixed unten links kleines Badge „Offline — Änderungen werden später synchronisiert"
11. **NotificationsProvider**: Nutzt Supabase Realtime Channel `public:notifications`; bindet zudem `Notification.requestPermission()` nach Login; erzeugt Toasts via `sonner` für neue Lead-Zuweisung, Rückruf-Erinnerung (5 Min vorher via setTimeout im Provider), Token-Buchungen

### Batch C — Verkäufer Dashboard
12. **StatCard Trend (#16/#113)**: Neue Props `trendValue?: number` (Prozentuale Änderung vs. Vortag) und `trendDirection?: 'up' | 'down' | 'flat'`; Trend-Pfeil-Icon (TrendingUp/Down) und grün/rote Zahl im `hint`-Bereich einbauen. `getSellerDashboardStats` um Vortags-Vergleich ergänzen.
13. **Arbeitsliste "Als Nächstes" (#13)**: Neue Card unter Dashboard-StatGrid. Sortierlogik: 1) überfällige Rückrufe (älteste zuerst), 2) neue zugewiesene Leads (älteste zuerst), 3) Rückrufe innerhalb 1h, 4) Leads mit `contacted` aber längere Zeit inaktiv (>48h). Jede Zeile hat "Öffnen" + "Anrufen" Quick-Actions.
14. **Tagesziel (#15)**: Neue Card „Deine Ziele heute" mit TargetProgressBar. Werte aus `seller_targets` Tabelle (Auto-Generierung, wenn keine vorhanden: Default 3 Abschlüsse/Tag, 10 Kontakte/Tag). Fortschrittsbalken pro Ziel.
15. **Kollabierbare Cards (#19)**: CollapsibleCard.tsx mit chevron-Button im Header; Expanded-State default aus `defaultOpen={true}`; localStorage-keyed merken pro (route + card-id); anwenden auf Dashboard-Cards: Letzte Aktivitäten, Nächste Rückrufe.

### Batch D — Lead anfordern
16. **Produkt-Filter (#20)**: RequestForm erhält RadioGroup (Strom / Gas / Beides / Alle) vor dem Submit; `requestLeadAction` wird um `product`-Parameter ergänzt. Parameter wird an `requestLead()` in leads.service.ts übergeben → RPC `assign_next_lead_to_user` erhält den Filter.
17. **Warteliste (#22)**: Wenn RPC `NO_LEAD_AVAILABLE` zurückgibt, Button "Auf Warteliste setzen" anzeigen → schreibt `lead_waitlist`-Eintrag mit gewünschtem Produkt + User; Badge "Du bist auf der Warteliste (Position X)" anzeigen. Provider prüft beim Next-App-Reload ob neue Leads für User auf Warteliste da sind und benachrichtigt.
18. **Confetti (#25)**: Nach erfolgreichem requestLead (wenn `state?.ok` und `state?.redirectTo`) feuert ein clientseitiger `<ConfettiBurst/>` (einfache 1-Sekunden CSS-Particle-Animation ohne externe Lib).

### Batch E — Meine Leads
19. **Avatare (#34)**: `LeadAvatar.tsx` – Initialen-Badge mit `hashString(first_name + last_name)`-basierter Farbe aus 12er-Palette; rendern in Name-Spalte vor dem Text.
20. **PageSize Selector (#35)**: `<Select>` rechts neben Pagination mit 10/25/50/100; Update via query-param `pageSize`.
21. **ColumnSelector (#31)**: Dropdown im Table-Header mit Checkboxes „E-Mail", „PLZ/Ort", „Quelle", „Kampagne", „Letzter Kontakt vor"; Sichtbarkeit wird in localStorage gemerkt; Tabelle rendert Spalten dynamisch.
22. **QuickFilterChips (#32)**: Chip-Reihe über Table: „Nicht kontaktiert", „Heute kontaktiert", „Überfällige Rückrufe", „Angebot", „Inaktiv (>7 Tage)". Jeder Chip ergänzt Filter-Query-Params (ODER-Verknüpfung).
23. **Hover Row Actions (#33)**: Actions (Anrufen, Status, Rückruf) werden per `group-hover:flex` nur beim Hovern der Row sichtbar. Absolute rechte Position. Sonst nur Pfeil/Öffnen.
24. **Duplikat-Warnung (#30)**: Beim Rendern der Lead-Zeile prüfen: Gibt es weitere Leads mit identischer Telefonnummer in der DB? → Mini-Badge "⚠ 2 Duplikate" als Tooltip. Link öffnet Filter auf diese Telefonnummer. (Query als Parallel-Abfrage zu `getMyLeads`).

### Batch F — Rückrufe Kalender
25. **Kalenderansicht Toggle (#36)**: Neue `Tabs` über der Callbacks-Card: „Liste" (bisherige Ansicht) + „Tag" + „Woche". Tag-Ansicht: Zeitachse 8:00–20:00 in 30-Min Blöcken, Rückrufe als Events drauf. Woche: 7 Spalten pro Tag. Click auf Termin → Lead öffnen. Drag auf Termin optional später, hier reicht Anzeige.

### Batch G — Lead Detailansicht
26. **Letzter Kontakt (#56)**: Neue Summary-Zeile unter dem Lead-Namen im Header: „Zuletzt vor 2 Tagen · 5 Kontaktversuche · Letztes Ergebnis: Kunde interessiert". Daten via Parallelabfrage (Max von contact_attempts.attempt_date).
27. **Copy Buttons (#53)**: `CopyButton.tsx` – Icon-only Button neben Telefon, E-Mail und Adresse; onClick → `navigator.clipboard.writeText()` + Sonner-Toast „kopiert". InfoRow-Komponente erhält optional `copyText`-Prop.
28. **Timeline Filter (#52)**: Toggle-Group (Checkboxen: Anrufe, Status, Rückrufe) über der Timeline; state variiert, welche Einträge sichtbar sind. Default alle an.
29. **Tags (#51)**: Rechts-Spalte erhält neue Card „Tags" mit TagInput (Lucide Tag); Vorschläge aus bestehenden Tags + neu anlegen via Enter; entfernen per X-Click. Änderungen schreiben in `lead_tags` Junction über `TagEditor`-Client-Component + neue Server-Actions `setLeadTagsAction`.
30. **Dokumente (#46)**: Rechts-Spalte neue Card „Dokumente" mit `<input type="file" accept=".pdf,.jpg,.png">` oder Drag&Drop-Fläche. Upload per Client-Komponente `DocumentUploader` via Server Action → lädt Datei in Supabase Storage Bucket `lead-documents/{leadId}/{id}-{filename}` und schreibt Zeile in `lead_documents` Tabelle. Liste zeigt vorhandene Dokumente mit Download-Link + Größe + Typ.
31. **Sticky Action Bar (#44)**: Fixed unten (mobile) oder fixed rechts neben Content (Desktop) mit den 3 primären Actions: **Anrufen** (tel: Link), **Rückruf planen** (öffnet Modal mit schnellem Zeitpunkt-Vorwahl „in 1 Stunde / Heute 14 Uhr / Morgen 9 Uhr"), **Status wechseln** (Menü mit allen Status). Min. 44px hohe Buttons.

### Batch H — Verkäufer Statistiken
32. **Ziele setzen (#58)**: Neuer Tabs oben auf Stats-Seite: „Übersicht" (bisher) + „Ziele". Auf Zielen-Tabelle User kann 4 Arten von Zielen (Abschlüsse, Leads, Kontaktquote, Token-Guthaben Ziel) je Periode (Tag/Monat) anlegen. Pro Ziel wird Fortschrittsbalken berechnet.
33. **Heatmap beste Zeit (#59)**: Card „Deine besten Zeiten" mit HeatmapGrid: Zeilen = Montag … Sonntag (7), Spalten = 8–20 Uhr (12). Farbsättigung nach Anzahl erfolgreicher Kontakte. Tooltip bei Hover „Montag 10 Uhr: 12 Versuche, 6 erreicht (50%)". Daten via RPC `get_contact_time_heatmap`.

### Batch I — Admin Leads verwalten
34. **Manuell Lead anlegen (#71)**: Neuer Button im PageHeader „Lead anlegen" → `CreateLeadDialog.tsx`. Formular mit allen Pflichtfeldern (Vorname, Nachname, Telefon, Produkt, Quelle). Legt Lead via `adminCreateLead` Service + Audit-Eintrag an.
35. **Lead Hold (#74)**: Neue Action in AdminLeadDialogs.tsx: `HoldLeadDialog` – Toggle `is_on_hold` + `hold_notes` Textfeld. In Tabelle neue Spalte "Status" ergänzt um Hold-Indikator: graues Overlay-Icon + Tooltip „Auf Eis gelegt · Grund: …".
36. **Lead-Alter Spalte (#78)**: Neue Tabellenspalte „Alter" mit `Math.floor(now - created_at / 1d)` Tagen. Farbkodierung: 0-3d grün, 4-7d gelb, >7d rot.
37. **Kampagnen verwalten (#76)**: Neuer Nav-Eintrag in Admin-Sidebar: „Kampagnen" → neue Seite `/admin/campaigns/page.tsx`. Tabelle mit Kampagnen (Name, Quelle, Aktiv, Budget, Start/Ende). Dialog zum Neuanlegen/Bearbeiten. Zwei neue KPI-Zeilen pro Kampagne in der Liste: „Leads" + „Abschlussquote". Berechnung via campaigns.service.

### Batch J — Admin Verkäufer
38. **Suche + sortierbare Spaltenköpfe (#86)**: Suchfeld über Verkäufer-Tabelle (Name / E-Mail). Click auf Spaltenköpfe sortiert asc/desc (Pfeil-Symbol); Sortierung via query-param.
39. **Massen-Token-Aufladung (#79)**: Checkbox-Spalte in der Tabelle + „Bulk Token +"-Button. Dialog öffnet sich, Feld "Betrag" + "Grund"; führt `svcCreditTokens` pro ausgewählten User aus.
40. **Teams (#80)**: Viele Sub-Änderungen: (a) Dropdown in Seller-Dialog für Team-Auswahl, (b) Filter über Tabelle "Alle Teams / Team A / Team B", (c) Bulk-Aktion "Ausgewählte zu Team X verschieben". Neues `CreateTeamDialog` auf Einstellungen.
41. **Verkäufer Detail-Profilseite (#85)**: Route `/admin/sellers/[id]/page.tsx`. Profil-Kopf mit Guthaben, Status + Aktionen (Token, Aktiv-toggle). Drei Tabs: „Performance" (Charts zu Quoten über letzten 6 Monaten), „Aktivitäten" (Audit-Feed für diesen User), „Leads" (Tabelle aller seiner Leads).

### Batch K — Admin Statistiken / Reports
42. **Funnel Diagramm (#95)**: Neue Card auf `/admin/stats` mit 5-Stufen-Funnel (Recharts FunnelChart): „Neue Leads" → „Zugewiesen" → „Erreicht" → „Angebot" → „Abgeschlossen". Jede Stufe zeigt Absolutwert + Drop-off-Prozent zur vorherigen.
43. **Kampagnen-Reporting (#96)**: Tabelle mit Kampagnen + Spalten: „Leads ges.", „Zugewiesen", „Abschlüsse", „Ø Verbrauch (kWh)", „Abschlussquote", „Kosten/Lead". Optional Link zur Kampagnen-Detailseite mit Drill-Down.

### Batch L — Einstellungen (Verkäufer + Admin)
44. **Notification Preferences (#101)**: Neuer Settings-Bereich „Benachrichtigungen" mit Switches pro Kanal (Push Callback, Push Lead, Push Token, E-Mail Wöchentlich). Werte werden via notification_preferences Tabelle geladen/gespeichert.
45. **Density-Schalter (#104)**: Settings-Bereich „Darstellung" mit Radio-Group: Kompakt / Standard / Geräumig. Umschalten ändert global Paddings in Tables/Cards via useDensity + CSS-Vars. Zustand wird in localStorage + optional in settings-Spalte persistiert.

### Batch M — Server Actions & Services (parallel zu UI-Batches erledigen)
- Bei jedem der obigen Schritte passend:
  - Aktionen in `actions.ts` anlegen (z.B. `createLeadAction`, `toggleHoldAction`, `setLeadTagsAction`, `uploadDocumentAction`, `creditTokensBulkAction`, `waitlistJoinAction`, etc.)
  - Service-Schicht in `lib/services/*` ergänzen
  - `revalidatePath()` auf betroffenen Routen

---

## 5. Dependencies and Considerations
- **Recharts**: Bereits installiert, erlaubt Funnel (#95), Heatmap-ähnliche Charts (#59) und Balken für Kampagnenreporting.
- **next-themes**: Bereits installiert, nutzen wir für Density via Theme-Attribut `data-density`.
- **Storage Bucket `lead-documents`**: Muss zusätzlich im Supabase Dashboard angelegt werden (kann nicht per SQL erstellt werden). Wir fügen einen expliziten Hinweis im Migration-Kommentar hinzu (Punkt 46).
- **RLS Policies**: Alle neuen Tabellen brauchen korrekte Policies – nicht vergessen, sonst lesen alle 0 Datensätze.
- **ENAM erweitern**: `lead_status` erweitern via `ALTER TYPE ... ADD VALUE 'on_hold'` ist nicht atomär; wir haben uns für `is_on_hold BOOLEAN` entschieden, um ALTER TYPE zu vermeiden (safer).
- **Doppelte Feature-Nummern**: 16 und 113 werden nur 1× als „StatCard mit Trend" umgesetzt.
- **#8 Offline Queue**: Als Low-Cost-Variante reicht ein Anzeige-Badge + Toasts; Formulare werden ohne Netz deaktiviert. Komplexes Queueing mit Sync-Table wird als Future Work ausgelassen, falls der Time-Frame eng wird.

---

## 6. Validation (nach jedem Batch, endgültig nach Abschluss)
1. **Typ-Check**: `npx tsc --noEmit` durchlaufen lassen
2. **Lint**: `npm run lint` — keine neuen Errors/Warnings
3. **Build**: `npm run build` erfolgreich
4. **Manuelle Tests** per User im Browser:
   - Sidebar Collapse toggle → Icons-only, Zustand bleibt nach Reload
   - Breadcrumbs auf 3 verschiedenen Seiten sichtbar und klickbar
   - StatCard mit Trend zeigt grünen/roten Pfeil korrekt
   - Lead anfordern mit Produkt = Gas → nur Gas-Leads zugewiesen
   - Meine Leads: Filter-Chips klicken → URL ändert sich → Tabelle aktualisiert
   - Lead-Details: Copy-Button Telefon → in Zwischenablage kopiert + Toast
   - Lead-Details: Sticky Action Bar scrollt mit und klickbare Buttons haben min. 44px
   - Admin Leads: Lead anlegen Dialog speichert, erscheint in Tabelle
   - Admin Verkäufer: Bulk Token auf 2 User → beide Wallets um X erhöht
   - Density Kompakt/Geräumig → sichtbare Änderung der Zeilenhöhen + Paddings
5. **Sicherheit**: Jede neue Server-Action ruft `requireAdmin/requireSeller` auf; keine Auth-Löcher.
6. **RLS**: Supabase Query-Editor als Seller-User testen – lead_documents von anderen Verkäufern nicht sichtbar.

---

## 7. Risiken & Handling

| Risiko | Likelihood | Impact | Maßnahme |
|--------|------------|--------|----------|
| Migration `0003` wird vergessen auszuführen → App-Crash durch fehlende Spalten/Tabellen | Medium | Hoch | Start des ersten Dev-Servers: In `lib/supabase/admin.ts` sanity-Check einbauen, fehlende Tabelle → Friendly-Error-Message auf Landing-Page mit „Migration 0003 fehlt"-Hinweis |
| `ALTER TYPE lead_status ADD VALUE` wird gebraucht, obwohl wir BOOLEAN wählten | Low | Medium | Wenn später erforderlich, SQL vorsehen mit `ALTER TYPE ... ADD VALUE IF NOT EXISTS` (PG14+) |
| Storage Bucket wurde nicht im Dashboard erstellt → Upload schlägt fehl | High | Medium | DocumentUploader fängt Fehler, Hinweis-Toast „Bucket lead-documents fehlt, bitte im Supabase Dashboard anlegen: Storage → New Bucket → Public aus, Name lead-documents" |
| Viele gleichzeitige Batches → Merge-Konflikte in actions.ts | Hoch | Mittel | Pro Batch eindeutige Namen für Actions; Batch M am Ende zentral konsolidieren, statt früher unkontrolliert hineinzuschreiben |
| Offline-Indikator / Notifications stören im Dev | Low | Niedrig | Env-Variable `NEXT_PUBLIC_DISABLE_NOTIFICATIONS=1` zum Abstellen |
| Duplikat-Suche zu langsam bei großen Lead-Tabellen | Low | Mittel | Index `idx_leads_phone` existiert bereits → Gruppierung nach `phone = p_phone` bleibt performant, aber RPC vermeidet N+1 |
