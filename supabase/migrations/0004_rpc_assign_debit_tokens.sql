-- =============================================
-- Migration 0004: assign_lead_to_seller um p_debit_tokens Parameter erweitern
-- =============================================
-- Hintergrund: Die App ruft assign_lead_to_seller mit 4 Parametern auf:
--   p_lead_id, p_seller_id, p_by_user_id, p_debit_tokens
-- Bisher existierte die Funktion nur mit 3 Parametern (ohne Debit-Steuerung).
-- p_debit_tokens = FALSE → Admin kann einen Lead "kostenlos" zuweisen,
--                      z. B. bei Korrekturen nach Rücksprache.
-- =============================================

DROP FUNCTION IF EXISTS public.assign_lead_to_seller(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS public.assign_lead_to_seller(UUID, UUID, UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION public.assign_lead_to_seller(
  p_lead_id       UUID,
  p_seller_id     UUID,
  p_by_user_id    UUID,
  p_debit_tokens  BOOLEAN DEFAULT TRUE
)
RETURNS VOID AS $$
DECLARE
  v_lead_status   public.lead_status;
  v_assigned      UUID;
  v_cost          INTEGER;
  v_wallet_id     UUID;
  v_balance       INTEGER;
  v_seller_active BOOLEAN;
BEGIN
  -- Lead sperren + Metadaten lesen
  SELECT status, assigned_user_id, COALESCE(token_cost, 1)
    INTO v_lead_status, v_assigned, v_cost
  FROM public.leads
  WHERE id = p_lead_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEAD_NOT_FOUND';
  END IF;
  IF v_assigned IS NOT NULL THEN
    RAISE EXCEPTION 'ALREADY_ASSIGNED';
  END IF;

  -- Verkäufer aktiv?
  SELECT is_active INTO v_seller_active
  FROM public.users
  WHERE id = p_seller_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SELLER_NOT_FOUND';
  END IF;
  IF NOT v_seller_active THEN
    RAISE EXCEPTION 'SELLER_INACTIVE';
  END IF;

  -- Nur wenn Token abgebucht werden sollen: Wallet prüfen + abbuchen
  IF p_debit_tokens THEN
    SELECT id, balance INTO v_wallet_id, v_balance
    FROM public.token_wallets
    WHERE user_id = p_seller_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'WALLET_NOT_FOUND';
    END IF;
    IF v_balance < v_cost THEN
      RAISE EXCEPTION 'NOT_ENOUGH_TOKENS';
    END IF;
  END IF;

  -- Lead zuweisen
  UPDATE public.leads
  SET assigned_user_id = p_seller_id,
      assigned_at     = NOW(),
      status          = 'assigned'::public.lead_status,
      updated_by      = p_by_user_id
  WHERE id = p_lead_id;

  -- Status-History Eintrag
  INSERT INTO public.lead_status_history (lead_id, old_status, new_status, user_id, note)
  VALUES (
    p_lead_id,
    v_lead_status,
    'assigned'::public.lead_status,
    p_by_user_id,
    CASE WHEN p_debit_tokens THEN 'Manuell zugewiesen (Admin)' ELSE 'Manuell zugewiesen (Admin, keine Token-Belastung)' END
  );

  -- Token abbuchen + Transaktion loggen
  IF p_debit_tokens THEN
    UPDATE public.token_wallets
    SET balance = balance - v_cost
    WHERE id = v_wallet_id;

    INSERT INTO public.token_transactions (wallet_id, user_id, amount, type, reason, lead_id, created_by)
    VALUES (
      v_wallet_id,
      p_seller_id,
      -v_cost,
      'lead_kauf'::public.token_transaction_type,
      'Manuelle Zuweisung durch Admin',
      p_lead_id,
      p_by_user_id
    );
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- Auch reset_lead sicherheitshalber auf korrekte Signatur bringen (3 Parameter)
-- Die App ruft reset_lead mit p_lead_id, p_by_user_id, p_refund auf.
DROP FUNCTION IF EXISTS public.reset_lead(UUID, UUID);
DROP FUNCTION IF EXISTS public.reset_lead(UUID, UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION public.reset_lead(
  p_lead_id    UUID,
  p_by_user_id UUID,
  p_refund     BOOLEAN DEFAULT TRUE
)
RETURNS VOID AS $$
DECLARE
  v_prev_user  UUID;
  v_prev_status public.lead_status;
  v_cost       INTEGER;
  v_wallet_id  UUID;
BEGIN
  SELECT assigned_user_id, status, COALESCE(token_cost, 1)
    INTO v_prev_user, v_prev_status, v_cost
  FROM public.leads
  WHERE id = p_lead_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEAD_NOT_FOUND';
  END IF;

  -- Token erstatten, falls gefordert und vorher zugewiesen
  IF p_refund AND v_prev_user IS NOT NULL THEN
    SELECT id INTO v_wallet_id
    FROM public.token_wallets
    WHERE user_id = v_prev_user
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.token_wallets
      SET balance = balance + v_cost
      WHERE id = v_wallet_id;

      INSERT INTO public.token_transactions (wallet_id, user_id, amount, type, reason, lead_id, created_by)
      VALUES (
        v_wallet_id,
        v_prev_user,
        v_cost,
        'rueckerstattung'::public.token_transaction_type,
        'Lead zurückgesetzt durch Admin',
        p_lead_id,
        p_by_user_id
      );
    END IF;
  END IF;

  -- Lead zurücksetzen
  UPDATE public.leads
  SET assigned_user_id = NULL,
      assigned_at     = NULL,
      status          = 'new'::public.lead_status,
      updated_by      = p_by_user_id
  WHERE id = p_lead_id;

  -- Status-History
  INSERT INTO public.lead_status_history (lead_id, old_status, new_status, user_id, note)
  VALUES (
    p_lead_id,
    v_prev_status,
    'new'::public.lead_status,
    p_by_user_id,
    CASE WHEN p_refund THEN 'Zurückgesetzt + Token erstattet' ELSE 'Zurückgesetzt (ohne Erstattung)' END
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- =============================================
-- REVOKE / GRANT — Aufruf nur für authentifizierte User
-- (über Admin-Client = service_role wird über Security Definer ausgeführt)
-- =============================================
REVOKE ALL ON FUNCTION public.assign_lead_to_seller(UUID, UUID, UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_lead(UUID, UUID, BOOLEAN) FROM PUBLIC;
