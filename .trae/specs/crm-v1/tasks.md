# CRM für Strom- und Gasvertrieb - Implementation Plan

## Task 1: Projekt-Grundstruktur initialisieren
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Next.js 14+ App Router Projekt mit TypeScript initialisieren
  - Tailwind CSS konfigurieren
  - shadcn/ui Komponentenbibliothek einbinden
  - Supabase Client konfigurieren
  - Projekt-Struktur (app/, lib/, components/, types/) aufbauen
- **Acceptance Criteria Addressed**: AC-9
- **Test Requirements**:
  - `rule` TR-1.1: `npm run dev` startet ohne Fehler, Basis-Route / zeigt ein Layout
  - `rubric` TR-1.2: Projektstruktur-Klarheit; Scale 1-5; 1=chaotisch, 3=brauchbar, 5=sauber getrennt nach Schichten; Threshold >= 4; Evidence: Verzeichnisbaum
- **Notes**: Supabase-Integration via supabase_get_project verwenden

## Task 2: Datenbankschema und Migrationen
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - Tabellen erstellen: users (erweitert), leads, lead_status_history, contact_attempts, callbacks, token_wallets, token_transactions, audit_logs, campaigns
  - Foreign Keys und Indizes definieren
  - Supabase Migration SQL-Datei erstellen
  - Row-Level-Security (RLS) Policies vorbereiten
- **Acceptance Criteria Addressed**: AC-3, AC-4, AC-5, AC-6, AC-7
- **Test Requirements**:
  - `rule` TR-2.1: Alle Tabellen existieren nach Migration mit korrekten Spalten und FKs
  - `rule` TR-2.2: RLS auf leads-Tabelle: Verkäufer lesen nur eigene Leads (via Test-Query)
- **Notes**: Token-Cost-Feld vorbereiten für zukünftige Preise

## Task 3: Authentifizierung und Rollen-Management
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - Login-Seite mit E-Mail/Passwort
  - Supabase Auth Integration
  - Server-Middleware für Auth-Check
  - Rolle aus DB auslesen und im Session-Kontext halten
  - Check: Deaktivierte Verkäufer können nicht einloggen
- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
  - `rule` TR-3.1: Aktiver Verkäufer loggt sich ein → weiter auf Dashboard
  - `rule` TR-3.2: Inaktiver Verkäufer loggt sich ein → Fehlermeldung, kein Login
  - `rule` TR-3.3: Ungeschützte Route /login ohne Auth erreichbar, /dashboard ohne Auth → Redirect zu /login

## Task 4: Rollenbasierte Navigation und Grundlayout
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 3
- **Description**:
  - Sidebar-Navigation mit rollenbasierten Menüpunkten
  - Header mit Benutzerinfo, Rollenanzeige, Logout
  - Layout-Komponente (Sidebar + Content)
  - Token-Guthaben-Anzeige in Nav für Verkäufer
- **Acceptance Criteria Addressed**: AC-10
- **Test Requirements**:
  - `rule` TR-4.1: Verkäufer sieht 6 Menüpunkte: Dashboard, Lead anfordern, Meine Leads, Rückrufe, Statistiken, Einstellungen
  - `rule` TR-4.2: Admin sieht 6 Menüpunkte: Dashboard, Leads, Verkäufer, Tokens, Statistiken, Einstellungen

## Task 5: Verkäufer-Dashboard
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 4
- **Description**:
  - Stat-Karten: Token-Guthaben, Meine Leads, Leads heute, Abschlüsse, Abschlussquote, offene/überfällige Rückrufe
  - Sektion: Meine letzten Aktivitäten (Kontaktversuche, Statusänderungen)
  - Sektion: Meine nächsten Rückrufe
  - Prominenter CTA: "Lead anfordern"
- **Acceptance Criteria Addressed**: AC-8
- **Test Requirements**:
  - `rule` TR-5.1: Alle Karten werden mit echten DB-Daten befüllt
  - `rule` TR-5.2: CTA "Lead anfordern" führt zur Seite Lead anfordern
  - `rubric` TR-5.3: Dashboard-Visuelle Qualität; Scale 1-5; Threshold >= 4; Evidence: Screenshot/Manueller Check

## Task 6: Lead-Anforderung (atomar, Race-Condition-sicher)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 5
- **Description**:
  - Seite "Lead anfordern": Guthaben-Anzeige + großer Button
  - Server-Action requestLead():
    - Berechtigung prüfen
    - Token >= 1 prüfen
    - DB-Transaction: ältesten Lead (FIFO) sperren → zuweisen → Token abziehen → Transaktion erstellen → Audit-Log → Status auf "Zugewiesen"
  - Weiterleitung zur Lead-Detailseite nach Erfolg
  - Fehlermeldungen: Keine Tokens, keine Leads verfügbar
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `rule` TR-6.1: Guthaben = 0 → Klick ergibt Meldung "Nicht genügend Tokens"
  - `rule` TR-6.2: Kein Lead verfügbar → Meldung "Keine Leads verfügbar"
  - `rule` TR-6.3: Erfolgreicher Request → Lead zugewiesen, Token -1, Status=Zugewiesen, Weiterleitung zu /leads/[id]

## Task 7: Lead-Detailseite und Statusänderung
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 6
- **Description**:
  - Kundendaten anzeigen (Name, Tel, E-Mail, Adresse, Produkt, Verbrauch, Quelle, Erstellt am)
  - Status-Badge + Status-Dropdown zum Ändern
  - Telefonnummer als tel:-Link
  - Status-Historie anzeigen (alt, neu, Benutzer, Zeit)
  - Notizen-Feld
  - Server-seitig: Statusänderung schreibt lead_status_history + audit_log
- **Acceptance Criteria Addressed**: AC-4, AC-6
- **Test Requirements**:
  - `rule` TR-7.1: Status ändern auf "Kontaktiert" → Eintrag in lead_status_history mit alter/neuer Status + User + Zeit
  - `rule` TR-7.2: Verkäufer A ruft Lead von B per URL auf → 403 oder Weiterleitung
  - `rule` TR-7.3: Telefonnummer hat href="tel:+49..."

## Task 8: Kontaktversuche dokumentieren
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 7
- **Description**:
  - Formular für neuen Kontaktversuch (Datum, Uhrzeit, Ergebnis-Auswahl, Notiz)
  - Chronologische Liste aller Kontaktversuche am Lead
  - Ergebnis-Optionen: Keine Antwort, Besetzt, Kunde möchte Rückruf, Kunde interessiert, Kein Interesse, Falsche Daten, Sonstiges
  - Automatisches Setzen von Datum/Uhrzeit auf "jetzt" (änderbar)
- **Acceptance Criteria Addressed**: AC-8
- **Test Requirements**:
  - `rule` TR-8.1: Neuer Kontaktversuch wird in contact_attempts gespeichert und angezeigt
  - `rule` TR-8.2: Liste ist absteigend nach Datum/Uhrzeit sortiert

## Task 9: Rückrufsystem
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 8
- **Description**:
  - Lead-Detail: Rückruf planen Formular (Datum, Uhrzeit, Notiz)
  - callbacks-Tabelle: status (offen, erledigt, storniert)
  - Seite "Rückrufe": Liste aller eigenen Rückrufe, Filter nach Status, nach Datum
  - Dashboard-Anzeige: Anzahl heutiger / überfälliger Rückrufe, Liste nächster Rückrufe
  - Überfällige Rückrufe farblich hervorheben (rot)
- **Acceptance Criteria Addressed**: AC-8
- **Test Requirements**:
  - `rule` TR-9.1: Rückruf speichern → callbacks-Eintrag vorhanden
  - `rule` TR-9.2: Rückruf "heute" erscheint auf Dashboard-Sektion "Heutige Rückrufe"
  - `rule` TR-9.3: Rückruf in Vergangenheit und offen = wird als "überfällig" markiert

## Task 10: Meine Leads (Tabelle + Filter)
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 9
- **Description**:
  - Tabellenansicht aller eigener Leads
  - Spalten: Name, Telefon, Produkt, Status, zugewiesen am, letzter Kontakt
  - Filter: nach Status (Multi-Select)
  - Suche: nach Name, Telefon, E-Mail
  - Sortierung: klickbare Spaltenköpfe
  - Zeitraumfilter: zugewiesen zwischen X und Y
  - Pagination (z.B. 25 pro Seite)
  - Klick auf Zeile → Lead-Detailseite
- **Acceptance Criteria Addressed**: AC-4, AC-8
- **Test Requirements**:
  - `rule` TR-10.1: Suche nach Teilstring aus Namen → nur passende Leads werden angezeigt
  - `rule` TR-10.2: Filter Status = "Rückruf" → nur Leads mit Status Rückruf

## Task 11: Admin-Dashboard
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 4
- **Description**:
  - Stat-Karten: neue Leads heute, verfügbare Leads, vergebene Leads, abgeschlossene Leads, aktive Verkäufer, verbrauchte Tokens, Abschlussquote
  - Einfache Charts (Balken/Line): Leads pro Tag (7 Tage), Abschlüsse pro Tag
  - Pie-Donut: Lead-Status-Verteilung
  - Nur für Admin zugänglich
- **Acceptance Criteria Addressed**: AC-8
- **Test Requirements**:
  - `rule` TR-11.1: Verkäufer versucht /admin/dashboard → 403 / Redirect
  - `rule` TR-11.2: Admin-Dashboard zeigt Stat-Karten mit echten DB-Werten
  - `rubric` TR-11.3: Klarheit & Übersichtlichkeit; Scale 1-5; Threshold >= 4

## Task 12: Admin - Leads verwalten
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 11
- **Description**:
  - Tabelle aller Leads (alle Verkäufer + unvergeben)
  - Spalten: ID, Name, Telefon, Produkt, Status, Verkäufer (oder "Verfügbar"), erstellt am
  - Filter: Status, Verfügbarkeit (verfügbar/zugewiesen), Verkäufer, Zeitraum
  - Suche
  - Aktionen pro Zeile: Öffnen, Status ändern, Verkäufer zuweisen, Lead zurücksetzen (wieder verfügbar machen)
  - Manuelles Zuweisen (Dialog mit Verkäufer-Auswahl)
- **Acceptance Criteria Addressed**: AC-4, AC-7
- **Test Requirements**:
  - `rule` TR-12.1: Admin sieht verfügbare Leads (ohne zugewiesenen Verkäufer)
  - `rule` TR-12.2: "Zurücksetzen" setzt assigned_user_id = NULL, Status = Neu, Token wird ggf. erstattet

## Task 13: Admin - Verkäufer verwalten
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 12
- **Description**:
  - Tabelle aller Verkäufer: Name, E-Mail, Status (aktiv/inaktiv), Token-Guthaben, Leads gesamt, Abschlüsse
  - Aktionen: Bearbeiten, Deaktivieren/Aktivieren, Passwort zurücksetzen
  - Verkäufer erstellen: Formular + Token-Wallet anlegen
  - Token-Verwaltung pro Verkäufer: +Tokens, -Tokens (jeweils mit Grund-Angabe)
  - Token-Historie pro Verkäufer anzeigen
- **Acceptance Criteria Addressed**: AC-2, AC-5, AC-7
- **Test Requirements**:
  - `rule` TR-13.1: Neuer Verkäufer erstellen → user + token_wallet mit Balance 0 existieren
  - `rule` TR-13.2: Verkäufer deaktivieren → Login nicht mehr möglich (AC-2)
  - `rule` TR-13.3: +50 Tokens mit Grund "Aufladung" → Token-Transaktion mit Betrag +50 erstellt
  - `rule` TR-13.4: Summe Token-Transaktionen = Wallet-Balance (AC-5)

## Task 14: Admin - Token-Übersicht
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 13
- **Description**:
  - Gesamtübersicht: Verkäufer mit Guthaben sortierbar
  - Gesamt verbrauchte Tokens, Aufladungen, Rückerstattungen
  - Filterbare Gesamt-Transaktionsliste (alle Verkäufer)
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `rule` TR-14.1: Transaktionsliste zeigt alle Einträge mit Verkäufer, Betrag, Typ, Grund, Datum

## Task 15: Statistiken
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 10 (Verkäufer) + Task 12 (Admin)
- **Description**:
  - Verkäufer-Seite "Statistiken": nur eigene Daten
    - Kennzahlen: Leads, Kontaktversuche, erreichte Kunden, Rückrufe, Angebote, Abschlüsse, Verloren, Abschlussquote, Kontaktquote, Ø Kontaktversuche pro Lead
    - Zeitraum wählbar (7T, 30T, 90T, Custom)
  - Admin-Seite "Statistiken": Gesamt + Filter nach Verkäufer
    - Gleiche Kennzahlen auf Gesamt-Ebene
    - Filter "Verkäufer = X" zeigt dessen Statistiken
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `rule` TR-15.1: Abschlussquote = Abgeschlossen / (Abgeschlossen + Verloren) wird korrekt berechnet
  - `rule` TR-15.2: Verkäufer sieht nur seine eigenen Zahlen (prüfe mit 2 Test-Verkäufern)

## Task 16: Audit Log (Admin)
- **Status**: `pending`
- **Priority**: low
- **Depends On**: Task 12
- **Description**:
  - Tabelle audit_logs: Benutzer, Aktion, Ressource, Zeitpunkt, Details
  - Filter: Benutzer, Aktionstyp, Zeitraum
  - Aktionen: LEAD_ASSIGNED, TOKEN_DEBIT, TOKEN_CREDIT, STATUS_CHANGED, SELLER_CREATED, SELLER_DEACTIVATED, ADMIN_CHANGE, LEAD_RESET
  - Alle bereits implementierten Stellen mit Audit-Log ergänzen (requestLead, Status ändern, Token +/- , Lead reset, Seller create/deactivate)
- **Acceptance Criteria Addressed**: AC-7
- **Test Requirements**:
  - `rule` TR-16.1: Nach requestLead(): Audit-Eintrag LEAD_ASSIGNED und TOKEN_DEBIT existieren
  - `rule` TR-16.2: Nach Statusänderung: Audit-Eintrag STATUS_CHANGED mit altem und neuem Status in details

## Task 17: UI-Polishing - Skeletons, Empty States, Toasts
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 5-16
- **Description**:
  - Skeleton Loading States für Dashboard-Karten, Tabellen, Lead-Detail
  - Empty States (keine Leads, keine Rückrufe etc. mit passender Meldung + CTA)
  - Toast-Benachrichtigungen für Erfolg/Fehler bei Aktionen
  - Einheitliche Badges für Status (Farbcodierung: Neu=Grau, Zugewiesen=Blau, Kontaktiert=Gelb, Rückruf=Orange, Angebot=Indigo, Abgeschlossen=Grün, Kein Interesse=Rot, Falsche Daten=Rot, Storniert=Grau)
  - Konsistente Button-Stile (Primary=CTA Lead anfordern besonders hervorgehoben)
- **Acceptance Criteria Addressed**: AC-8
- **Test Requirements**:
  - `rule` TR-17.1: Alle Status-Badges haben korrekte Farbzuordnung
  - `rubric` TR-17.2: UI-Gesamteindruck; Scale 1-5; Threshold >= 4; Evidence: Visuelle Prüfung

## Task 18: Einstellungen (Verkäufer + Admin)
- **Status**: `pending`
- **Priority**: low
- **Depends On**: Task 4
- **Description**:
  - Verkäufer-Einstellungen: Name, E-Mail, Passwort ändern
  - Admin-Einstellungen: Name, E-Mail, Passwort ändern (persönlich)
  - Formularvalidierung serverseitig
- **Test Requirements**:
  - `rule` TR-18.1: Passwort ändern mit altem + neuem Passwort funktioniert

## Task 19: Security & Performance-Review
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 6, 7, 12, 13, 15
- **Description**:
  - Alle Server-Actions auf Berechtigung prüfen (RLS + manuelle Checks)
  - Keine Lead-Daten anderer Verkäufer abfragbar
  - Indizes auf leads.status, leads.assigned_user_id, leads.created_at, callbacks.callback_at, token_transactions.wallet_id
  - Pagination in allen Listen
  - SQL-Injection Prüfung (parametrisierte Queries)
  - Input-Validation auf allen Formularen
- **Acceptance Criteria Addressed**: AC-4, NFR-3, NFR-4, NFR-5
- **Test Requirements**:
  - `rule` TR-19.1: Manuelle Abfrage per curl einer fremden Lead-ID → 403/leer
  - `rule` TR-19.2: Alle Tabellen haben Pagination (keine 1000+ Zeilen in einem Query)
  - `rubric` TR-19.3: Architektur-Trennung; Scale 1-5; Threshold >= 4; Evidence: Code Review Services vs Actions vs Components

## Task 20: Seed-Daten / Demo-Datensatz
- **Status**: `pending`
- **Priority**: low
- **Depends On**: Task 2
- **Description**:
  - Test-Benutzer: admin@test.local / admin1234 (Admin) und seller@test.local / seller1234 (Verkäufer)
  - 50 Demo-Leads (Status "Neu") mit unterschiedlichen Produkten (Strom/Gas)
  - 5 Verkäufer mit unterschiedlichem Token-Guthaben (10-200)
  - Einige Kontaktversuche, Rückrufe, Status-Änderungen für Vorschaudaten
- **Test Requirements**:
  - `rule` TR-20.1: Anmeldung mit admin@test.local / admin1234 erfolgreich
  - `rule` TR-20.2: Mind. 30 Leads mit Status "Neu" vorhanden (für Test der Lead-Anforderung)
