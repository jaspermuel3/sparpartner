-- =====================================================================
-- REPARATUR: Fehlende public.users Profile für auth.users anlegen
-- =====================================================================
-- Problem nach Migration 0015: Auth-User existieren in auth.users,
-- aber KEIN passender Eintrag in public.users mit role + is_active.
-- Ergebnis: Login → "Benutzerprofil nicht gefunden."
--
-- Dieses Skript prüft JEDEM auth.user, ob ein public.users-Eintrag
-- mit gleicher ID existiert. Falls NEIN → automatisch anlegen.
-- Rollen-Logik:
--   E-Mail enthält "admin"                → role = 'admin'
--   Sonst                                → role = 'seller'
-- =====================================================================

DO $$
DECLARE
  v_auth RECORD;
  v_exists INT;
  v_role   TEXT;
  v_name   TEXT;
  v_created INT := 0;
  v_skipped INT := 0;
BEGIN
  FOR v_auth IN
    SELECT
      id,
      email,
      raw_user_meta_data,
      created_at
    FROM auth.users
    ORDER BY created_at ASC
  LOOP
    SELECT COUNT(*) INTO v_exists
    FROM public.users WHERE id = v_auth.id;

    IF v_exists = 0 THEN
      -- Role bestimmen
      IF v_auth.email ILIKE '%admin%' THEN
        v_role := 'admin';
      ELSE
        v_role := 'seller';
      END IF;

      -- Vollständigen Name aus auth.users Meta rausfischen (falls vorhanden)
      v_name := COALESCE(
        NULLIF(v_auth.raw_user_meta_data->>'full_name', ''),
        NULLIF(v_auth.raw_user_meta_data->>'name', ''),
        SPLIT_PART(COALESCE(v_auth.email::text, 'user@unknown'), '@', 1)
      );

      -- public.users Eintrag anlegen
      -- WICHTIG: Spalte users.role hat Typ public.user_role (ENUM),
      -- also muss der Text-String v_role per ::public.user_role gecastet
      -- werden. Sonst Fehler 42804: column "role" is of type user_role
      -- but expression is of type text.
      INSERT INTO public.users (id, full_name, role, is_active, created_at, updated_at)
      VALUES (v_auth.id, v_name, v_role::public.user_role, TRUE, COALESCE(v_auth.created_at, NOW()), NOW())
      ON CONFLICT (id) DO NOTHING;

      RAISE NOTICE '✅ Angelegt: public.users id=% email=% role=%',
        v_auth.id::text, COALESCE(v_auth.email::text, '-'), v_role;
      v_created := v_created + 1;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;

    -- (2) Falls User existiert, aber is_active = FALSE oder role=NULL, reparieren:
    UPDATE public.users u SET
      is_active = TRUE,
      role      = COALESCE(u.role,
                    CASE WHEN v_auth.email ILIKE '%admin%'
                      THEN 'admin'::public.user_role
                      ELSE 'seller'::public.user_role
                    END),
      full_name = COALESCE(NULLIF(u.full_name, ''),
                    COALESCE(v_auth.raw_user_meta_data->>'full_name',
                             v_auth.raw_user_meta_data->>'name',
                             SPLIT_PART(COALESCE(v_auth.email::text,'user@unknown'),'@',1))),
      updated_at = NOW()
    WHERE u.id = v_auth.id
      AND ( u.is_active = FALSE
         OR u.role IS NULL
         OR u.full_name IS NULL
         OR u.full_name = '' );

    -- (3) Sicherstellen, dass eine Token-Wallet existiert (0 Token → reicht als Platzhalter)
    INSERT INTO public.token_wallets (user_id, balance, created_at, updated_at)
    VALUES (v_auth.id, 0, NOW(), NOW())
    ON CONFLICT (user_id) DO NOTHING;

  END LOOP;

  RAISE NOTICE '=========================================';
  RAISE NOTICE 'FERTIG – public.users Konsistenz-Herstellung';
  RAISE NOTICE '=========================================';
  RAISE NOTICE 'auth.users gesamt (abgearbeitet): %', v_created + v_skipped;
  RAISE NOTICE 'Neu angelegt in public.users  : %', v_created;
  RAISE NOTICE 'Bereits vorhanden (skip)       : %', v_skipped;
  RAISE NOTICE '=========================================';
END $$;

-- =====================================================================
-- KONTROLLE: Anzeige der aktuellen public.users + Wallets
-- =====================================================================
SELECT
  u.id,
  COALESCE(a.email, '(kein auth-user!)')::TEXT AS email,
  u.full_name,
  u.role,
  u.is_active,
  u.last_login_at,
  COALESCE(tw.balance, 0) AS balance,
  a.email_confirmed_at IS NOT NULL AS email_bestaetigt
FROM public.users u
LEFT JOIN auth.users a ON a.id = u.id
LEFT JOIN public.token_wallets tw ON tw.user_id = u.id
ORDER BY u.role DESC, u.created_at ASC;
