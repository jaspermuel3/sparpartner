-- ==========================================================================
-- CRM DEMO-USER SEED · V1 · KOMPLETT IDENTISCH ZUM NODE-SKRIPT
-- ==========================================================================
-- WICHTIGE REGELN:
--  1. REIHENFOLGE: zuerst auth.users anlegen (mit festen UUIDs), DANN
--     public.users + token_wallets mit GENAU diesen UUIDs befüllen!
--     Grund: public.users.id REFERENCES auth.users(id) – FK Richtung!
--  2. IDEMPOTENZ: Abhängige Tabellen zuerst löschen, dann auth.users,
--     dann alles neu anlegen.
--  3. KEINE Spalten raten: Alle NOT-NULL-Spalten explizit setzen:
--     factors, email_change_confirm_status, is_sso_user, banned_until
--  4. bcrypt-Hashes (10 Rounds) werden 1:1 vom Node-Skript übernommen.
--
-- CREDENTIALS:
--   ▶ seller@test.local / seller1234  (Verkäufer · Max Verkäufer)
--   ▶ admin@test.local  / admin1234   (Admin      · Ada Admin)
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 0) AUFRÄUMEN (Idempotenz). RICHTIGE Reihenfolge wegen FK:
--    token_wallets → public.users → auth.users
-- --------------------------------------------------------------------------
DELETE FROM public.token_wallets
WHERE user_id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid
);

DELETE FROM public.users
WHERE id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid
);

DELETE FROM auth.users
WHERE id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid
);

DELETE FROM auth.users
WHERE email IN ('seller@test.local', 'admin@test.local');

-- --------------------------------------------------------------------------
-- 1) AUTH.USERS · VERKÄUFER zuerst
--    ID: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
-- --------------------------------------------------------------------------
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  invited_at,
  confirmation_token,
  confirmation_sent_at,
  recovery_token,
  email_change_token_new,
  email_change,
  email_change_confirm_status,
  banned_until,
  reauthentication_token,
  reauthentication_sent_at,
  is_sso_user,
  is_super_admin,
  factors,
  raw_app_meta_data,
  raw_user_meta_data,
  is_anonymous,
  created_at,
  updated_at,
  deleted_at,
  last_sign_in_at
) VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'authenticated'::text,
  'authenticated'::text,
  'seller@test.local'::text,
  '$2b$10$HIdjrHD0tfhxgJU0vfw3Wuw33SHMLSs/uGzHh00vgqtqGpVRlxyrO'::text,
  NOW()::timestamptz,
  NULL,
  NULL,
  ''::text,
  NULL,
  ''::text,
  ''::text,
  ''::text,
  0::smallint,
  NULL,
  ''::text,
  NULL,
  FALSE,
  FALSE,
  '[]'::jsonb,
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  FALSE,
  NOW()::timestamptz,
  NOW()::timestamptz,
  NULL,
  NULL
);

-- --------------------------------------------------------------------------
-- 2) AUTH.USERS · ADMIN danach
--    ID: bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
-- --------------------------------------------------------------------------
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  invited_at,
  confirmation_token,
  confirmation_sent_at,
  recovery_token,
  email_change_token_new,
  email_change,
  email_change_confirm_status,
  banned_until,
  reauthentication_token,
  reauthentication_sent_at,
  is_sso_user,
  is_super_admin,
  factors,
  raw_app_meta_data,
  raw_user_meta_data,
  is_anonymous,
  created_at,
  updated_at,
  deleted_at,
  last_sign_in_at
) VALUES (
  '00000000-0000-0000-0000-000000000000'::uuid,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
  'authenticated'::text,
  'authenticated'::text,
  'admin@test.local'::text,
  '$2b$10$8eg.zuhN.30iawqQGFXi2eUJOBWDymucV7idg3XrbgKA9tBVp5xp2'::text,
  NOW()::timestamptz,
  NULL,
  NULL,
  ''::text,
  NULL,
  ''::text,
  ''::text,
  ''::text,
  0::smallint,
  NULL,
  ''::text,
  NULL,
  FALSE,
  FALSE,
  '[]'::jsonb,
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  FALSE,
  NOW()::timestamptz,
  NOW()::timestamptz,
  NULL,
  NULL
);

-- --------------------------------------------------------------------------
-- 3) PUBLIC.USERS · Profile (ERST JETZT – FK verweist auf auth.users!)
-- --------------------------------------------------------------------------
INSERT INTO public.users (id, full_name, role, is_active, created_at, updated_at)
VALUES
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    'Max Verkäufer'::text,
    'seller'::user_role,
    TRUE,
    NOW()::timestamptz,
    NOW()::timestamptz
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    'Ada Admin'::text,
    'admin'::user_role,
    TRUE,
    NOW()::timestamptz,
    NOW()::timestamptz
  )
ON CONFLICT (id) DO UPDATE
SET
  full_name  = EXCLUDED.full_name,
  role       = EXCLUDED.role,
  is_active  = EXCLUDED.is_active,
  updated_at = NOW();

-- --------------------------------------------------------------------------
-- 4) TOKEN_WALLETS · Startguthaben
-- --------------------------------------------------------------------------
INSERT INTO public.token_wallets (user_id, balance, created_at, updated_at)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 100, NOW()::timestamptz, NOW()::timestamptz),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 500, NOW()::timestamptz, NOW()::timestamptz)
ON CONFLICT (user_id) DO UPDATE
SET
  balance    = EXCLUDED.balance,
  updated_at = NOW();

-- --------------------------------------------------------------------------
-- 5) DEMO-LEADS (5 Stück, idempotent per phone)
-- --------------------------------------------------------------------------
INSERT INTO public.leads (
  source, product, first_name, last_name, phone, zip, city, token_cost, status, created_at, updated_at
) VALUES
  ('meta_ads'::lead_source,   'strom'::product_type,  'Tom',  'Müller',    '+4915123456789', '10115', 'Berlin',   1, 'new'::lead_status, NOW(), NOW()),
  ('google_ads'::lead_source, 'gas'::product_type,    'Sara', 'Schmidt',   '+4917612345678', '20095', 'Hamburg',  1, 'new'::lead_status, NOW(), NOW()),
  ('manual'::lead_source,     'beides'::product_type, 'Jonas','Weber',     '+4917011122233', '80331', 'München',  1, 'new'::lead_status, NOW(), NOW()),
  ('meta_ads'::lead_source,   'strom'::product_type,  'Lisa', 'Fischer',   '+4915299887766', '50667', 'Köln',     1, 'new'::lead_status, NOW(), NOW()),
  ('import'::lead_source,     'gas'::product_type,    'Paul', 'Schneider', '+4917255566677', '04109', 'Leipzig',  1, 'new'::lead_status, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------------
-- 6) ERFOLGSKONTROLLE · Alles synchron prüfen
-- --------------------------------------------------------------------------
SELECT
  split_part(u.email, '@', 1)       AS benutzer,
  u.id                              AS auth_user_id,
  u.email                           AS email,
  pu.full_name                      AS name,
  pu.role                           AS rolle,
  pu.is_active                      AS aktiv,
  COALESCE(w.balance, 0)            AS tokens,
  u.email_confirmed_at IS NOT NULL  AS confirmed,
  (u.factors IS NOT NULL)           AS factors_ok,
  u.email_change_confirm_status     AS ec_status
FROM auth.users u
LEFT JOIN public.users pu        ON pu.id = u.id
LEFT JOIN public.token_wallets w ON w.user_id = u.id
WHERE u.email IN ('seller@test.local','admin@test.local')
ORDER BY pu.role DESC;
