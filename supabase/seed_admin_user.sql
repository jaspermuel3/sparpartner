-- =====================================================================
-- SEED: Admin-Benutzer anlegen (NUR AUSFÜHREN, WENN KEIN ADMIN EXISTIERT)
-- =====================================================================
-- Ausführen im Supabase Dashboard → SQL Editor
-- Nach dem Ausführen mit unten genannten Credentials einloggen.
-- =====================================================================

DO $$
DECLARE
  v_admin_email TEXT := 'admin@sparpartner24.de';
  v_admin_password TEXT := 'Admin123!Sicher2026';
  v_admin_fullname TEXT := 'CRM Administrator';
  v_initial_balance INT := 100;

  v_user_id UUID;
  v_exists_auth INT;
  v_exists_public INT;
BEGIN
  -- (1) Prüfen, ob die E-Mail bereits in auth.users existiert
  SELECT COUNT(*) INTO v_exists_auth
  FROM auth.users WHERE email = v_admin_email::citext;

  IF v_exists_auth > 0 THEN
    RAISE NOTICE 'Admin % existiert bereits in auth.users – überspringe Auth-Anlage.', v_admin_email;

    -- ID des bestehenden Users holen
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_admin_email::citext;
  ELSE
    -- Neuen Auth-User anlegen (pgcrypto Extension nötig – ist in 0001_init_schema aktiviert)
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      invited_at,
      confirmation_token,
      confirmation_sent_at,
      recovery_token,
      recovery_sent_at,
      email_change_token_new,
      email_change,
      email_change_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      created_at,
      updated_at,
      phone,
      phone_confirmed_at,
      phone_change,
      phone_change_token,
      phone_change_sent_at,
      notification_token,
      notification_token_sent_at
    ) VALUES (
      v_user_id,
      NULL,                               -- instance_id
      'authenticated',                    -- aud (NOT NULL)
      'authenticated',                    -- role (Supabase auth.role)
      v_admin_email::citext,              -- email (NOT NULL)
      crypt(v_admin_password, gen_salt('bf')),  -- encrypted_password (NOT NULL, bcrypt)
      NOW(),                              -- email_confirmed_at (sofort bestätigt)
      NULL,                               -- invited_at
      '',                                 -- confirmation_token
      NULL,                               -- confirmation_sent_at
      '',                                 -- recovery_token
      NULL,                               -- recovery_sent_at
      '',                                 -- email_change_token_new
      NULL,                               -- email_change
      NULL,                               -- email_change_sent_at
      NULL,                               -- last_sign_in_at
      '{"provider":"email","providers":["email"]}'::jsonb,   -- raw_app_meta_data (NOT NULL)
      '{"full_name":"CRM Administrator"}'::jsonb,             -- raw_user_meta_data (NOT NULL)
      FALSE,                              -- is_super_admin
      NOW(),                              -- created_at (NOT NULL)
      NOW(),                              -- updated_at (NOT NULL)
      NULL,                               -- phone
      NULL,                               -- phone_confirmed_at
      '',                                 -- phone_change
      '',                                 -- phone_change_token
      NULL,                               -- phone_change_sent_at
      '',                                 -- notification_token
      NULL                                -- notification_token_sent_at
    );

    RAISE NOTICE 'Auth-User für % angelegt (UUID: %).', v_admin_email, v_user_id;
  END IF;

  -- (2) public.users Profil-Eintrag prüfen + ggf. anlegen (mit role = 'admin')
  IF v_user_id IS NOT NULL THEN

    SELECT COUNT(*) INTO v_exists_public
    FROM public.users WHERE id = v_user_id;

    IF v_exists_public = 0 THEN
      INSERT INTO public.users (id, full_name, role, is_active, created_at, updated_at)
      VALUES (v_user_id, v_admin_fullname, 'admin', TRUE, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING;

      RAISE NOTICE 'public.users Profil mit role=admin angelegt.';
    ELSE
      -- Sicherstellen, dass role = 'admin' und is_active = TRUE
      UPDATE public.users
      SET role = 'admin',
          is_active = TRUE,
          full_name = COALESCE(NULLIF(full_name,''), v_admin_fullname),
          updated_at = NOW()
      WHERE id = v_user_id;

      RAISE NOTICE 'Bestehendes public.users Profil auf role=admin + is_active=TRUE aktualisiert.';
    END IF;

    -- (3) Token-Wallet (Trigger in 0001_init_schema legt es an – falls nicht, explizit nachziehen)
    INSERT INTO public.token_wallets (user_id, balance, created_at, updated_at)
    VALUES (v_user_id, v_initial_balance, NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE
      SET balance = GREATEST(public.token_wallets.balance, v_initial_balance),
          updated_at = NOW();

    -- Wenn Wallet neu angelegt wurde, noch die Token-Aufladung als Transaktion loggen
    IF (SELECT balance FROM public.token_wallets WHERE user_id = v_user_id) = v_initial_balance THEN
      INSERT INTO public.token_transactions
        (wallet_id, user_id, amount, type, reason, lead_id, created_by, created_at)
      SELECT
        id, v_user_id, v_initial_balance, 'aufladung',
        'Initiales Admin-Startguthaben', NULL, v_user_id, NOW()
      FROM public.token_wallets WHERE user_id = v_user_id
      ON CONFLICT DO NOTHING;
    END IF;

    RAISE NOTICE 'Wallet mit Startguthaben % Token sichergestellt.', v_initial_balance;
  END IF;
END $$;

-- =====================================================================
-- TEST: Anzeige, ob der Admin korrekt angelegt wurde
-- =====================================================================
SELECT
  u.id,
  u.full_name,
  u.role,
  u.is_active,
  a.email AS auth_email,
  a.email_confirmed_at,
  tw.balance AS token_balance
FROM public.users u
LEFT JOIN auth.users a ON a.id = u.id
LEFT JOIN public.token_wallets tw ON tw.user_id = u.id
WHERE u.role = 'admin'
ORDER BY u.created_at ASC;
