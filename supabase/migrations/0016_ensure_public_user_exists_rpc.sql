-- =====================================================================
-- Mini-RPC: Sicherstellen, dass public.users für einen auth.user
-- existiert (Enum-safe, keine 42804 Fehler wegen user_role vs. TEXT).
-- Aufgerufen aus /api/auth/login/route.ts (Auto-Login Fallback).
-- Kann auch manuell im SQL Editor für einzelne User verwendet werden.
-- =====================================================================

DROP FUNCTION IF EXISTS public.ensure_public_user_exists(UUID, TEXT, TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.ensure_public_user_exists(
  p_auth_id      UUID,     -- auth.users.id des Users (MUSS existieren!)
  p_fallback_name TEXT DEFAULT NULL,
  p_fallback_role TEXT DEFAULT 'seller'   -- 'admin' ODER 'seller'
) RETURNS TABLE (
  id UUID,
  full_name TEXT,
  role public.user_role,
  is_active BOOLEAN,
  last_login_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_auth_email  CITEXT;
  v_auth_meta   JSONB;
  v_insert_role public.user_role;
  v_name        TEXT;
  v_created     BOOLEAN := FALSE;
BEGIN
  -- Auth-User Infos holen (wir nehmen E-Mail + Meta um Namen/Rolle zu bestimmen)
  SELECT email, raw_user_meta_data
    INTO v_auth_email, v_auth_meta
  FROM auth.users
  WHERE id = p_auth_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'AUTH_USER_NOT_FOUND';
  END IF;

  -- Fallback-Rolle casten (ENUM-safe! → löst 42804)
  IF LOWER(COALESCE(p_fallback_role,'')) = 'admin'
     OR v_auth_email::text ILIKE '%admin%' THEN
    v_insert_role := 'admin'::public.user_role;
  ELSE
    v_insert_role := 'seller'::public.user_role;
  END IF;

  -- Name zusammenbasteln
  v_name := COALESCE(
    NULLIF(p_fallback_name, ''),
    NULLIF(v_auth_meta->>'full_name', ''),
    NULLIF(v_auth_meta->>'name', ''),
    SPLIT_PART(COALESCE(v_auth_email::text,'user@unknown'), '@', 1)
  );

  -- Neu anlegen falls nicht da (mit Enum-safe Rolle)
  INSERT INTO public.users (id, full_name, role, is_active, created_at, updated_at)
  VALUES (p_auth_id, v_name, v_insert_role, TRUE, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET
    full_name  = COALESCE(NULLIF(public.users.full_name,''), EXCLUDED.full_name),
    role       = COALESCE(public.users.role, EXCLUDED.role),
    is_active  = TRUE,
    updated_at = NOW()
  RETURNING TRUE INTO v_created;

  -- Wallet sicherlegen
  INSERT INTO public.token_wallets (user_id, balance, created_at, updated_at)
  VALUES (
    p_auth_id,
    CASE WHEN v_insert_role = 'admin' THEN 100 ELSE 0 END,
    NOW(), NOW()
  ) ON CONFLICT (user_id) DO UPDATE SET balance = GREATEST(COALESCE(public.token_wallets.balance,0),
    CASE WHEN v_insert_role = 'admin' THEN 100 ELSE 0 END);

  RETURN QUERY
  SELECT u.id, u.full_name, u.role, u.is_active, u.last_login_at
  FROM public.users u WHERE u.id = p_auth_id
  LIMIT 1;
END $$;

REVOKE ALL ON FUNCTION public.ensure_public_user_exists(UUID,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_public_user_exists(UUID,TEXT,TEXT) TO service_role;
-- (Darf NUR service_role aufrufen – wird im Backend via createAdminClient verwendet)

COMMENT ON FUNCTION public.ensure_public_user_exists(UUID,TEXT,TEXT) IS 'Login-Utility: legt missing public.users + Wallet enum-safe an.';
