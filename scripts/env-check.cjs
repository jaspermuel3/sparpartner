/* Env-Var Checker: lädt .env.local ohne externe Dependencies */
const fs = require('fs')
const pth = require('path')

const envFile = pth.join(process.cwd(), '.env.local')
if (fs.existsSync(envFile)) {
  const raw = fs.readFileSync(envFile, 'utf8')
  for (const ln of raw.split(/\r?\n/)) {
    const m = ln.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    const k = m[1]
    let v = m[2]
    const q1 = v.startsWith('"') && v.endsWith('"')
    const q2 = v.startsWith("'") && v.endsWith("'")
    if (q1 || q2) v = v.slice(1, -1)
    if (process.env[k] === undefined) process.env[k] = v
  }
}

const required = [
  ['NEXT_PUBLIC_SUPABASE_URL', 8],
  ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 20],
  ['SUPABASE_SERVICE_ROLE_KEY', 20],
  ['LANDING_API_KEY', 32],
]

let ok = true
for (const [k, min] of required) {
  const v = (process.env[k] || '').trim()
  if (v.length < min) {
    console.error('❌ ' + k + ': fehlt oder zu kurz (min ' + min + ' Chars), aktuell ' + v.length)
    ok = false
  }
}

if (!ok) {
  console.error('Bitte .env.local im Projekt-Root anlegen bzw. korrigieren.')
  process.exit(1)
}

console.log('✅ Alle ' + required.length + ' Pflicht-Env-Variablen in .env.local vorhanden.')
