# CRM für Strom- und Gasvertrieb - Product Requirements Document

## Overview
- **Summary**: Moderne, performante CRM-Webanwendung für Vertriebspartner zur Verwaltung von Leads, Tokens und Rückrufen im Strom- und Gasvertrieb mit Admin- und Verkäuferrollen
- **Purpose**: Internes CRM-System, das den kompletten Vertriebsworkflow von der Lead-Anforderung über Kontaktversuche bis zum Vertragsabschluss abbildet
- **Target Users**: Admin (Verwaltung) und Vertriebspartner (Verkäufer)

## Goals
- Vollständiger User-Flow vom Login bis zum Abschluss/Verlust eines Leads
- Sicheres Token-System mit Transaktionshistorie
- Race-Condition-sichere Lead-Vergabe per FIFO
- Rollenbasierte Zugriffskontrolle (serverseitig abgesichert)
- Modernes, professionelles SaaS-Design
- Hohe Performance und Ressourcenschonung

## Non-Goals
- Meta Ads API / Webhook Integration (nicht in V1)
- Teams und Team-Tokenpools
- Lead Scoring / Duplicate Detection
- E-Mail- und Browser-Notifications
- Unterschiedliche Leadpreise
- Lead-Reklamationen
- Mehrsprachigkeit
- Mobile App

## Background & Context
- Arbeitsverzeichnis ist leer, Projekt wird von Grund auf erstellt
- Supabase-Integration ist verfügbar (PostgreSQL + Auth)
- Benutzerprofil: Deutsch, professionelles/minimalistisches Design, schrittweise Umsetzung

## Functional Requirements

### Authentifizierung & Rollen
- **FR-1**: Benutzeranmeldung mit E-Mail/Passwort
- **FR-2**: Zwei Rollen: Admin und Verkäufer
- **FR-3**: Rollenbasierte Navigation und serverseitige Berechtigungsprüfung
- **FR-4**: Deaktivierte Verkäufer können sich nicht anmelden

### Token-System
- **FR-5**: Jeder Verkäufer hat ein Token-Guthaben (Wallet)
- **FR-6**: 1 Lead = 1 Token (V1)
- **FR-7**: Vollständige Token-Transaktionshistorie (Aufladung, Kauf, Rückerstattung, Korrektur)
- **FR-8**: Manuelle Token-Änderungen erfordern Grundangabe

### Lead-Management
- **FR-9**: Lead-Datenmodell mit allen Pflichtfeldern (Personendaten, Produkt, Verbrauch, Quelle etc.)
- **FR-10**: Lead-Status: Neu, Zugewiesen, Kontaktiert, Rückruf, Angebot, Abgeschlossen, Kein Interesse, Falsche Daten, Storniert
- **FR-11**: Status-Historie mit Benutzer- und Zeitstempel
- **FR-12**: FIFO-Lead-Vergabe (ältester verfügbarer Lead zuerst)
- **FR-13**: Atomare, transaktionssichere Lead-Zuweisung gegen Race Conditions
- **FR-14**: Kontaktversuch-Dokumentation (Datum, Uhrzeit, Ergebnis, Notiz)

### Lead-Anforderung (Verkäufer)
- **FR-15**: Seite "Lead anfordern" zeigt nur Guthaben + Button (keine Lead-Liste)
- **FR-16**: Bei Klick: Prüfung Token → ältester Lead → Zuweisung → Token-Abbuchung → Weiterleitung

### Rückrufsystem
- **FR-17**: Rückruf-Planung pro Lead (Datum, Uhrzeit, Notiz, Status)
- **FR-18**: Dashboard zeigt anstehende/überfällige Rückrufe

### Meine Leads (Verkäufer)
- **FR-19**: Tabellenansicht nur eigener Leads
- **FR-20**: Filter nach Status, Suche, Sortierung, Zeitraumfilter

### Dashboards
- **FR-21**: Verkäufer-Dashboard: Token-Guthaben, Lead-Zahlen, Abschlüsse, Rückrufe, letzte Aktivitäten
- **FR-22**: Admin-Dashboard: Gesamtübersicht Leads, Verkäufer, Tokens, einfache Diagramme

### Admin-Bereich
- **FR-23**: Admin kann alle Leads verwalten (Suche, Filter, Zuweisen, Zurücksetzen, Bearbeiten)
- **FR-24**: Admin kann Verkäufer verwalten (Erstellen, Deaktivieren, Bearbeiten, Token verwalten)
- **FR-25**: Tokenverwaltung mit Historie
- **FR-26**: Statistiken (Admin: Gesamt + nach Verkäufer filterbar; Verkäufer: nur eigene)

### Audit Log
- **FR-27**: Kritische Aktionen werden protokolliert (Benutzer, Aktion, Ressource, Zeitpunkt, Infos)

### UI/UX
- **FR-28**: Modernes SaaS-Dashboard Design (Cards, Tables, Badges, Toasts, Skeleton States, Empty States)
- **FR-29**: Responsive (Desktop-first, Mobil nutzbar)
- **FR-30**: Telefonnummer anklickbar (tel:-Link)

## Non-Functional Requirements
- **NFR-1**: Stabilität und einfache Bedienung über Feature-Reichtum
- **NFR-2**: Keine übermäßigen API-Requests, Pagination für Tabellen
- **NFR-3**: Serverseitige Authentifizierung und Berechtigungs-prüfung bei JEDEM Zugriff
- **NFR-4**: Schutz vor SQL-Injection, XSS, CSRF
- **NFR-5**: Kein Zugriff auf fremde Leads (serverseitig erzwungen)
- **NFR-6**: Modulare Architektur (Trennung UI / Business Logic / DB-Zugriff)
- **NFR-7**: Keine unnötigen Libraries
- **NFR-8**: Datenbankindizes für häufig genutzte Queries

## Constraints
- **Technisch**: PostgreSQL (Supabase), TypeScript, Next.js App Router, Tailwind CSS, shadcn/ui
- **Business**: Kein Superadmin, nur 2 Rollen
- **Dependencies**: Supabase (Auth + Postgres)

## Assumptions
- Supabase-Integration ist bereits eingerichtet oder kann konfiguriert werden
- Deployment per Vercel + GitHub
- Leads werden manuell eingepflegt bis Meta Ads Webhook kommt

## Acceptance Criteria

### AC-1: Login funktioniert rollenbasiert
- **Type**: `rule`
- **Given**: Benutzer existieren in der Datenbank mit Rolle Admin/Verkäufer
- **When**: Benutzer meldet sich mit korrekten Anmeldedaten an
- **Then**: Er wird auf sein Dashboard weitergeleitet, Navigation ist rollenspezifisch
- **Pass Condition**: Login-Test für beide Rollen erfolgreich, UI zeigt richtige Navigation
- **Evidence**: Manueller Test oder Auth-Flow mit Testdaten

### AC-2: Deaktivierter Verkäufer kann sich nicht anmelden
- **Type**: `rule`
- **Given**: Verkäufer ist als inaktiv markiert
- **When**: Er versucht sich anzumelden
- **Then**: Anmeldung wird abgelehnt mit Meldung
- **Pass Condition**: Login-Versuch inaktiver Nutzer schlägt fehl
- **Evidence**: Auth-Middleware oder Server-Action-Test

### AC-3: Lead-Anforderung ist atomar und FIFO-basiert
- **Type**: `rule`
- **Given**: N Verkäufer fordern gleichzeitig einen Lead an, es gibt M < N verfügbare Leads
- **When**: Alle Anfragen laufen parallel ein
- **Then**: Genau M Verkäufer erhalten einen Lead (älteste zuerst), die restlichen erhalten Meldung "kein Lead verfügbar"
- **Pass Condition**: Keine doppelten Zuweisungen, Token-Abbuchung stimmt mit zugewiesenen Leads überein
- **Evidence**: Paralleler Test mit Datenbank-Transaktion oder Code-Review

### AC-4: Verkäufer sieht keine fremden Leads
- **Type**: `rule`
- **Given**: Verkäufer A ist eingeloggt, Lead X gehört Verkäufer B
- **When**: A versucht per URL oder API Lead X abzurufen
- **Then**: Zugriff wird verweigert (403)
- **Pass Condition**: API-Route und UI geben keinen Zugriff
- **Evidence**: API-Test mit fremder Lead-ID per curl/Postman

### AC-5: Token-Transaktionshistorie ist vollständig
- **Type**: `rule`
- **Given**: Verkäufer hat X Tokens
- **When**: Beliebige Abfolge von Aufladungen, Lead-Käufen und Rückerstattungen
- **Then**: Summe der Transaktionen ergibt genau das aktuelle Guthaben
- **Pass Condition**: Rechenprüfung: sum(transactions) == wallet.balance
- **Evidence**: Query-Test auf Konsistenz

### AC-6: Lead-Status-Historie wird protokolliert
- **Type**: `rule`
- **Given**: Lead in Status "Zugewiesen
- **When**: Status wird auf "Kontaktiert" geändert
- **Then**: Neuer Eintrag in lead_status_history mit altem Status, neuem Status, Benutzer, Zeitpunkt
- **Pass Condition**: Datenbankeintrag vorhanden
- **Evidence**: Datenbank-Query nach Statusänderung

### AC-7: Kritische Aktionen werden audit-logged
- **Type**: `rule`
- **Given**: Admin oder Verkäufer führen kritische Aktionen aus
- **When**: Lead zugewiesen, Token gebucht, Status geändert, Verkäufer erstellt/deaktiviert
- **Then**: Jede Aktion hat einen audit_log-Eintrag
- **Pass Condition**: audit_logs-Tabelle enthält korrekte Einträge
- **Evidence**: Datenbankprüfung nach Aktionen

### AC-8: UI-Designqualität
- **Type**: `rubric`
- **Dimension**: Modernes, professionelles SaaS-Dashboard-Erscheinungsbild
- **Scale**: 1-5
- **Anchors**: 1 = veraltet, karg; 3 = funktional aber Standard; 5 = hochwertig, clean, minimal, klare Hierarchie
- **Pass Threshold**: >= 4
- **Evidence**: Visuelle Prüfung der Hauptseiten

### AC-9: Architektur-Modularität
- **Type**: `rubric`
- **Dimension**: Trennung UI / Business Logic / Datenzugriff
- **Scale**: 1-5
- **Anchors**: 1 = alles in Komponenten; 3 = teilweise getrennt; 5 = saubere Schichten, Business-Logic in separaten Services
- **Pass Threshold**: >= 4
- **Evidence**: Code-Struktur-Prüfung

### AC-10: Rollenbasierte Navigation
- **Type**: `rule`
- **Given**: Verkäufer und Admin sind eingeloggt
- **When**: Navigations-Menü wird angezeigt
- **Then**: Verkäufer sieht: Dashboard, Lead anfordern, Meine Leads, Rückrufe, Statistiken, Einstellungen; Admin sieht: Dashboard, Leads, Verkäufer, Tokens, Statistiken, Einstellungen
- **Pass Condition**: Navigation zeigt korrekte Menüpunkte je Rolle
- **Evidence**: UI-Prüfung beider Rollen

## Open Questions
- [x] Welche Supabase-Konfiguration ist bereits vorhanden? (Annahme: kann eingerichtet werden)
