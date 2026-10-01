# Debug Session: crm-login-not-working
**Status**: [OPEN]
**Symptom**: Login funktioniert nicht (Benutzer kann sich nicht anmelden)
**Umgebung**: Next.js App Router + @supabase/ssr + Route Handler POST /api/auth/login
**Session ID**: crm-login-not-working

---

## 🔍 Falsifizierbare Hypothesen (3–5)

| # | Hypothese | Beobachtungspunkt |
|---|-----------|-------------------|
| H1 | **Cookies werden nicht an Redirect-Response angehängt** | `server.ts` `createClient()` nutzt `cookies()` aus `next/headers`, aber `NextResponse.redirect()` erzeugt neue Response; Cookies gelangen u.U. nicht in die Redirect-Header | API-Route: `supabase.auth.setSession()` Cookie-Schreiben vs. `NextResponse.redirect()` |
| H2 | **Demo-User fehlen in `auth.users` oder `public.users`** | Seed-Skript wurde nie ausgeführt oder fehlgeschlagen; IDs zwischen `auth.users` und `public.users` stimmen nicht überein | Supabase: Tabellen `auth.users`, `public.users` nach seller/admin durchsuchen |
| H3 | **Middleware löscht Auth-Cookies nach Login** | Nach erfolgreichem Redirect prüft Middleware `getUser()`, schlägt fehl und leitet wieder auf /login zurück | Middleware: `authUser` = null nach Redirect → Cookies werden bereinigt |
| H4 | **`signInWithPassword` + `setSession` Race-Condition** | `setSession()` läuft asynchron, aber Response wird zurückgegeben bevor Cookies geschrieben sind | API-Route: Timing zwischen `setSession()` und `return NextResponse.redirect()` |
| H5 | **Falsche bcrypt-Hashes im Seed** | Passwörter seller1234 / admin1234 passen nicht zu den gespeicherten Hashes | Supabase: `signInWithPassword` gibt "Invalid credentials" zurück |

---

## 🧪 Phase 1: Instrumentation & Pre-Fix Evidence
_Noch keine Business-Logik-Modifikationen._

### Log-Collection Plan
- Debug Server starten → Logs an `trae-debug-log-crm-login-not-working.ndjson`
- Instrumentation in `src/app/api/auth/login/route.ts`:
  - Nach `signInWithPassword`: signInError / session vorhanden?
  - Nach `setSession`: Erfolgreich? Cookies geschrieben?
  - Nach `getUser`: authUser.id?
  - Nach DB-Abfrage: dbUser vorhanden? is_active?
  - Vor Redirect: safeNext Wert
- Instrumentation in `middleware.ts`:
  - Bei Routen-Zugriff: pathname, authUser != null?, dbUser vorhanden?
  - Cookie-Namen + Werte (anonymisiert)

---

## 📊 Phase 2: Evidence-Auswertung (wird nach Log-Collection ausgefüllt)
| Hypothese | Status (✓/✗/?) | Beweis (Log-Zeile) |
|-----------|----------------|---------------------|
| H1 | ? | — |
| H2 | ? | — |
| H3 | ? | — |
| H4 | ? | — |
| H5 | ? | — |

### Root Cause: _(wird nach Analyse eingetragen)_

---

## 🔧 Phase 3: Fix & Post-Fix Verification
_Minimaler Fix wird hier dokumentiert._

### Geänderte Dateien
- _(Datei + Diff kommt hier)_

### Pre vs. Post Vergleich
| Metrik | Pre-Fix | Post-Fix |
|--------|---------|----------|
| Login Response Status | — | — |
| Auth-Cookies gesetzt? | — | — |
| Weiterleitung zu /dashboard | — | — |

---

## ✅ Cleanup
_Erst nach Benutzerbestätigung "Fixed"!_
- [ ] Instrumentation entfernen
- [ ] Debug Server stoppen
- [ ] Debug-Datei archivieren / löschen
