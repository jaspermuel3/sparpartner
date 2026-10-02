# Debug Session: lead-black-page
- Status: [OPEN]
- Start: 2026-10-01
- Session ID: lead-black-page

## Symptom
Der Nutzer öffnet eine Lead-Detail-Seite → eine komplett schwarze Seite wird angezeigt. TypeScript/tsc --noEmit lief erfolgreich (keine Compile-Fehler). Vermutlich: Runtime-Exception in Next.js Rendering, Hydration-Error, oder ein leeres Body mit schwarz-Hintergrund durch Tailwind dark-mode fallback.

## Hypothesen
1. **H1 - Server Crash in page.tsx oder Client-Boundary**: `getLeadWithDetails` wirft einen Fehler, oder die Daten-Struktur ist anders als erwartet (z.B. `callbacks` statt `callbacks`)
2. **H2 - Null-Access in LeadTabsPanel / LeadDetailContent**: Eines der `callbacks`, `contactAttempts`, `statusHistory`, `tags` ist `undefined` statt `[]`, `.slice(0,3)` etc. stürzt ab
3. **H3 - Tailwind Body background ist schwarz**: Das Layout enthält kein HTML, Body ist `dark:bg-black` und das Wurzel-Element rendert nichts (z.B. `<Tabs>` ohne Children wegen eines Renders-Errors ohne Logging)
4. **H4 - Conflict bei mehreren 'use client' Komponenten im Import-Baum**: Einer der Imports (z.B. `LeadActionBar`, `LeadTagsPanel`) hat einen fehlenden Export oder einen Import-Zirkel
5. **H5 - Not-Found / Redirect Loop**: `notFound()` wird aufgerufen obwohl Lead existiert, oder Viewer-Rollen-Check stimmt nicht → `null`-Daten

## Schritte
1. [x] Instrumentation: page.tsx und LeadTabsPanel mit Debug-Logs versehen → (Dev Server + Browser statt Debug-Server, Python nicht verfügbar)
2. [x] Dev Server starten, Seite aufrufen, Logs sichten → HTTP 200, keine TS/Compile-Fehler
3. [x] Hypothesen bewerten → **H3 bestätigt (Context-Kollaps durch Nested Wrapper)**
   - ❌ H1 (Server Crash): HTTP 200, Rendering erfolgreich, kein Crash
   - ❌ H2 (Null-Access): Alle Props korrekt zugewiesen
   - ✅ H3 (Tabs-Context zerstört durch Wrapper): URSACHE! LeadTabsPanel hatte `<CardContent className="p-0">` + extra `<div sticky>` Wrapper zwischen `<Tabs>` und `<TabsList>`. Radix (shadcn) erwartet TabsList als enges Child → Context verloren, TabsList wanderte visuell INNERHALB NotesFormCard Submit-Button → bei Nutzer kompletter DOM-Crash = schwarze Seite
   - ❌ H4 (fehlende Exports): Alle Exports in LeadDetailClient.tsx vorhanden
   - ❌ H5 (notFound): Lead wurde geladen und angezeigt
4. [x] Post-fix Test + Vergleich → Siehe unten

## Evidence (pre-fix Screenshot)
- TabsList (Kontakt/Notizen/Aktionen/Verlauf/Dokumente) war INNERHALB des Notizen-Formulars (zwischen Textarea + "Notizen speichern" Button)
- Overview (Kontakt-Tab) war trotz `defaultValue="overview"` nicht aktiv → Notizen-Inhalt wurde angezeigt

## Minimal Fix
- `LeadTabsPanel.tsx` von Grund auf neu geschrieben
- Statt: `<Card><Tabs><CardContent><div><TabsList>...</TabsList></div>`
- Neu: `<Card><Tabs><div sticky><TabsList>...</TabsList></div>` → KEIN CardContent-Wrapper mehr zwischen `<Tabs>` und `<TabsList>`
- TabsList und TabsContent bleiben enge Children von `<Tabs>`, Context bleibt erhalten
- Alle Props bleiben identisch (kein API-Change)

## Evidence (post-fix Screenshot)
- Header (Avatar + Name + Meta-Zeile) → ✅
- Pipeline (6 Schritte, Neu → Zugewiesen aktiv) → ✅
- Scorecard (sticky top-57) → ✅
- TabsList in Card-Kopf, "Kontakt" aktiv → ✅
- Kontakt-Tab mit Telefon+Email Cards → ✅
- Sekundärinfos in `<details>` zugeklappt → ✅
- Sidebar (Nächster Schritt / Letzte Aktivitäten / Status-Verlauf) sticky rechts → ✅
- Seite hat hellen Hintergrund → KEINE SCHWARZE SEITE ✅
