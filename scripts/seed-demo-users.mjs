// Seed Demo-User für CRM
// Ausführung: node scripts/seed-demo-users.mjs
// Legt 2 Auth-Benutzer an (Verkäufer + Admin) und fügt public.users + token_wallets hinzu.
// Die DB-Migration (0001_init_schema.sql) muss VORHER gelaufen sein!

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { randomUUID } from 'crypto'

// .env.local laden (ohne dotenv-Abhängigkeit, Next.js installiert dotenv nicht global in Node)
{
  const envPath = new URL('../.env.local', import.meta.url)
  if (existsSync(envPath)) {
    const raw = readFileSync(envPath, 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      if (!line.trim() || line.trim().startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq === -1) continue
      const k = line.slice(0, eq).trim()
      let v = line.slice(eq + 1).trim()
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
      if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1)
      if (!(k in process.env)) process.env[k] = v
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('❌ Umgebungsvariablen fehlen. Stelle sicher, dass .env.local geladen wird.')
  process.exit(1)
}

// Service-Role Client umgeht RLS
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

function log(label, msg = '') {
  const prefix = label.padEnd(12)
  console.log(`${prefix} ${msg}`)
}

async function ensureSchema() {
  log('ℹ Prüfe', 'ob public.users & token_wallets Tabellen existieren (Migration gelaufen?)')
  try {
    const { error: uErr } = await admin.from('users').select('id').limit(1)
    if (uErr && uErr.code === '42P01') {
      console.error('❌ public.users existiert NICHT.')
      console.error(
        '   => Öffne Supabase Dashboard → SQL Editor → führe supabase/migrations/0001_init_schema.sql komplett aus!',
      )
      process.exit(2)
    }
    if (uErr) {
      console.error('❌ DB-Fehler:', uErr.message)
      process.exit(3)
    }
    log('✅', 'Schema ist vorhanden (Migration wurde gelaufen).')
  } catch (e) {
    console.error('❌ Keine Verbindung zur Supabase DB (URL/Key falsch?)', e.message)
    process.exit(4)
  }
}

async function upsertAuthUser({ email, password, role }) {
  log('🔐 Auth', `${email} anlegen / aktualisieren ...`)

  // 1) Suche nach bestehendem Auth-User (via admin.listUsers ist schneller)
  const { data: listData } = await admin.auth.admin.listUsers()
  let authUser = listData?.users?.find((u) => u.email === email)

  if (!authUser) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (error) {
      console.error('   ❌ Fehler beim Anlegen:', error.message)
      return null
    }
    authUser = data.user
    log('✅', `Neuer Auth-User: ${authUser.id}`)
  } else {
    // Update password falls abweichend (immer frisch setzen zur Sicherheit)
    const { data, error } = await admin.auth.admin.updateUserById(authUser.id, { password })
    if (error) {
      console.error('   ⚠ Passwort konnte nicht aktualisiert werden:', error.message)
    } else {
      log('✅', `Passwort aktualisiert für ${authUser.id} (${role})`)
    }
  }

  return authUser
}

async function upsertPublicUser(authUserId, fullName, role) {
  log('👤 Profil', `public.users für ${fullName} (${role}) anlegen ...`)
  const { error } = await admin.from('users').upsert(
    { id: authUserId, full_name: fullName, role, is_active: true },
    { onConflict: 'id' },
  )
  if (error) {
    console.error('   ❌', error.message)
    return false
  }
  log('✅', 'OK')
  return true
}

async function upsertWallet(authUserId, balance) {
  log('💰 Wallet', `token_wallets für User mit Startguthaben ${balance} anlegen ...`)
  // Wir holen uns die Wallet-ID um onConflict zu vereinfachen (oder via .upsert)
  const { data: existing } = await admin
    .from('token_wallets')
    .select('id, user_id')
    .eq('user_id', authUserId)
    .maybeSingle()

  if (existing) {
    log('ℹ', `Wallet existiert bereits (ID ${existing.id}). Balance wird NICHT überschrieben.`)
    return true
  }

  const { error } = await admin.from('token_wallets').insert({
    user_id: authUserId,
    balance,
  })
  if (error) {
    console.error('   ❌', error.message)
    return false
  }
  log('✅', `Wallet angelegt (Startguthaben ${balance} Tokens)`)
  return true
}

async function upsertDemoLead(lead) {
  log('🎫 Lead', `${lead.first_name} ${lead.last_name} (${lead.product}) anlegen ...`)
  // Kein upsert, jede Laufzeit neue Leads einfügen ist OK.
  // Eindeutigkeit via Telefonnummer: prüfe ob Telefon bereits angelegt wurde.
  const { data: exists } = await admin
    .from('leads')
    .select('id, phone')
    .eq('phone', lead.phone)
    .maybeSingle()
  if (exists) {
    log('ℹ', `Lead ${lead.phone} bereits vorhanden – übersprungen.`)
    return true
  }
  const { error } = await admin.from('leads').insert(lead)
  if (error) {
    console.error('   ❌', error.message)
    return false
  }
  log('✅', 'OK')
  return true
}

async function main() {
  console.log('\n🚀 Starte Demo-Seed ...')
  console.log('   Supabase URL:', SUPABASE_URL, '\n')

  await ensureSchema()
  console.log('')

  const sellers = [
    {
      email: 'seller@test.local',
      password: 'seller1234',
      fullName: 'Max Verkäufer',
      role: 'seller',
      balance: 100,
    },
  ]
  const admins = [
    {
      email: 'admin@test.local',
      password: 'admin1234',
      fullName: 'Ada Admin',
      role: 'admin',
      balance: 500,
    },
  ]

  for (const u of [...sellers, ...admins]) {
    const authUser = await upsertAuthUser(u)
    if (!authUser) continue
    await upsertPublicUser(authUser.id, u.fullName, u.role)
    await upsertWallet(authUser.id, u.balance)
    console.log('')
  }

  log('🎫', '5 Demo-Leads anlegen (zum Testen der Lead-Anforderung):')
  const demoLeads = [
    { source: 'meta_ads', product: 'strom', first_name: 'Tom', last_name: 'Müller', phone: '+4915123456789', zip: '10115', city: 'Berlin', token_cost: 1, status: 'new' },
    { source: 'google_ads', product: 'gas', first_name: 'Sara', last_name: 'Schmidt', phone: '+4917612345678', zip: '20095', city: 'Hamburg', token_cost: 1, status: 'new' },
    { source: 'manual', product: 'beides', first_name: 'Jonas', last_name: 'Weber', phone: '+4917011122233', zip: '80331', city: 'München', token_cost: 1, status: 'new' },
    { source: 'meta_ads', product: 'strom', first_name: 'Lisa', last_name: 'Fischer', phone: '+4915299887766', zip: '50667', city: 'Köln', token_cost: 1, status: 'new' },
    { source: 'import', product: 'gas', first_name: 'Paul', last_name: 'Schneider', phone: '+4917255566677', zip: '04109', city: 'Leipzig', token_cost: 1, status: 'new' },
  ]
  for (const lead of demoLeads) await upsertDemoLead(lead)

  console.log('\n🎉 Seed abgeschlossen! Anmelden mit:')
  console.log('   Verkäufer  → seller@test.local  / seller1234')
  console.log('   Admin      → admin@test.local   / admin1234\n')
}

main().catch((e) => {
  console.error('\n💥 Kritischer Fehler:', e)
  process.exit(5)
})
