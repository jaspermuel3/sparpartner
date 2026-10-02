-- =============================================
-- Migration 0022: Doppelte credit_tokens / debit_tokens Overloads entfernen
--
-- Problem: Zwei überladene Funktionen mit identischem Param-Set,
-- nur p_type unterscheidet sich (TEXT vs public.token_transaction_type).
-- Bei Named-Param-aufruf via Supabase RPC kann Postgres nicht
-- disambiguieren → 42723 too_many_functions.
--
-- Fix: Alle alten Signaturen droppen, nur die kanonische
-- ENUM-basierte Fassung behalten (aus 0002_status_history_rpc_fixes).
-- =============================================

-- ----------------------------------------------------------------------
-- 1) ALLE credit_tokens / debit_tokens Varianten droppen (ungeachtet der Signatur)
--    Postgres unterstützt DROP FUNCTION ... CASCADE nicht mit Wildcard,
--    also droppen wir jede bekannte alte Signatur explizit.
-- ----------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.credit_tokens(UUID, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.credit_tokens(UUID, INTEGER, TEXT, UUID);
DROP FUNCTION IF EXISTS public.credit_tokens(UUID, INTEGER, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.credit_tokens(UUID, INTEGER, TEXT, public.token_transaction_type, UUID);

DROP FUNCTION IF EXISTS public.debit_tokens(UUID, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.debit_tokens(UUID, INTEGER, TEXT, UUID);
DROP FUNCTION IF EXISTS public.debit_tokens(UUID, INTEGER, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.debit_tokens(UUID, INTEGER, TEXT, public.token_transaction_type, UUID);

-- ----------------------------------------------------------------------
-- 2) credit_tokens — kanonische Fassung (p_type = ENUM)
-- ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.credit_tokens(
  p_target_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_type public.token_transaction_type DEFAULT 'aufladung'::public.token_transaction_type,
  p_created_by UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_wallet_id UUID;
  v_old_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'AMOUNT_MUST_BE_POSITIVE';
  END IF;

  SELECT id, balance INTO v_wallet_id, v_old_balance
  FROM public.token_wallets
  WHERE user_id = p_target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND';
  END IF;

  v_new_balance := v_old_balance + p_amount;

  UPDATE public.token_wallets
  SET balance = v_new_balance
  WHERE id = v_wallet_id;

  INSERT INTO public.token_transactions (wallet_id, user_id, amount, type, reason, created_by)
  VALUES (v_wallet_id, p_target_user_id, p_amount, p_type, p_reason, p_created_by);

  RETURN v_new_balance;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- ----------------------------------------------------------------------
-- 3) debit_tokens — kanonische Fassung (p_type = ENUM)
-- ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.debit_tokens(
  p_target_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_type public.token_transaction_type DEFAULT 'korrektur_minus'::public.token_transaction_type,
  p_created_by UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_wallet_id UUID;
  v_old_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'AMOUNT_MUST_BE_POSITIVE';
  END IF;

  SELECT id, balance INTO v_wallet_id, v_old_balance
  FROM public.token_wallets
  WHERE user_id = p_target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND';
  END IF;
  IF v_old_balance < p_amount THEN
    RAISE EXCEPTION 'NOT_ENOUGH_TOKENS';
  END IF;

  v_new_balance := v_old_balance - p_amount;

  UPDATE public.token_wallets
  SET balance = v_new_balance
  WHERE id = v_wallet_id;

  INSERT INTO public.token_transactions (wallet_id, user_id, amount, type, reason, created_by)
  VALUES (v_wallet_id, p_target_user_id, -p_amount, p_type, p_reason, p_created_by);

  RETURN v_new_balance;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- ----------------------------------------------------------------------
-- 4) Grants (sicherstellen, dass authenticated User die RPCs nutzen dürfen)
-- ----------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.credit_tokens(UUID, INTEGER, TEXT, public.token_transaction_type, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.debit_tokens(UUID, INTEGER, TEXT, public.token_transaction_type, UUID) TO authenticated, service_role;
