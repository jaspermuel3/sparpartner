-- =============================================
-- CRM Datenbankschema V1
-- =============================================

-- ---------------------------------------------
-- Erweiterungen
-- ---------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------
-- Typen
-- ---------------------------------------------
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'seller');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE lead_status AS ENUM (
    'new', 'assigned', 'contacted', 'callback', 'offer',
    'closed', 'no_interest', 'wrong_data', 'canceled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE product_type AS ENUM ('strom', 'gas', 'beides');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE lead_source AS ENUM (
    'meta_ads', 'google_ads', 'manual', 'import', 'empfehlung', 'sonstiges'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE contact_result AS ENUM (
    'keine_antwort', 'besetzt', 'rueckruf', 'interessiert',
    'kein_interesse', 'falsche_daten', 'sonstiges'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE callback_status AS ENUM ('offen', 'erledigt', 'storniert');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE token_transaction_type AS ENUM (
    'aufladung', 'lead_kauf', 'rueckerstattung',
    'korrektur_plus', 'korrektur_minus'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE audit_action_type AS ENUM (
    'LEAD_ASSIGNED', 'LEAD_RESET', 'STATUS_CHANGED',
    'TOKEN_DEBIT', 'TOKEN_CREDIT',
    'SELLER_CREATED', 'SELLER_UPDATED',
    'SELLER_DEACTIVATED', 'SELLER_ACTIVATED',
    'ADMIN_CHANGE', 'CONTACT_ATTEMPT',
    'CALLBACK_CREATED', 'CALLBACK_UPDATED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------
-- Trigger-Funktion: updated_at automatisch setzen
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------
-- users (Profile-Tabelle ergänzend zu auth.users)
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role user_role NOT NULL DEFAULT 'seller',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS users_updated_at ON public.users;
CREATE TRIGGER users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------
-- campaigns
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  source lead_source,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS campaigns_updated_at ON public.campaigns;
CREATE TRIGGER campaigns_updated_at
BEFORE UPDATE ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------
-- leads
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  street TEXT,
  zip TEXT,
  city TEXT,
  product product_type NOT NULL DEFAULT 'strom',
  power_consumption INTEGER,
  gas_consumption INTEGER,
  source lead_source NOT NULL DEFAULT 'manual',
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  status lead_status NOT NULL DEFAULT 'new',
  assigned_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  notes TEXT,
  token_cost INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS leads_updated_at ON public.leads;
CREATE TRIGGER leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indizes
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_user ON public.leads(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_status_assigned ON public.leads(status, assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads(phone);

-- ---------------------------------------------
-- lead_status_history
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  old_status lead_status,
  new_status lead_status NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_status_history_lead ON public.lead_status_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_status_history_user ON public.lead_status_history(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_status_history_created ON public.lead_status_history(created_at);

-- ---------------------------------------------
-- Trigger: Status-Änderung protokollieren
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION log_lead_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.lead_status_history (lead_id, old_status, new_status, user_id, created_at)
    VALUES (NEW.id, NULL, NEW.status, NEW.assigned_user_id, NOW());
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.lead_status_history (lead_id, old_status, new_status, user_id, created_at)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid()::uuid, NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_log_status ON public.leads;
CREATE TRIGGER leads_log_status
AFTER INSERT OR UPDATE OF status ON public.leads
FOR EACH ROW EXECUTE FUNCTION log_lead_status_change();

-- ---------------------------------------------
-- contact_attempts
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.contact_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  attempt_date TIMESTAMPTZ NOT NULL,
  result contact_result NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_attempts_lead ON public.contact_attempts(lead_id);
CREATE INDEX IF NOT EXISTS idx_contact_attempts_user ON public.contact_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_attempts_date ON public.contact_attempts(attempt_date DESC);

-- ---------------------------------------------
-- callbacks
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.callbacks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  callback_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  status callback_status NOT NULL DEFAULT 'offen',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS callbacks_updated_at ON public.callbacks;
CREATE TRIGGER callbacks_updated_at
BEFORE UPDATE ON public.callbacks
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_callbacks_user_status ON public.callbacks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_callbacks_callback_at ON public.callbacks(callback_at);
CREATE INDEX IF NOT EXISTS idx_callbacks_lead ON public.callbacks(lead_id);

-- ---------------------------------------------
-- token_wallets
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.token_wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS token_wallets_updated_at ON public.token_wallets;
CREATE TRIGGER token_wallets_updated_at
BEFORE UPDATE ON public.token_wallets
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_token_wallets_user ON public.token_wallets(user_id);

-- ---------------------------------------------
-- Trigger: Automatisch Wallet für neuen User anlegen
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION create_wallet_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.token_wallets (user_id, balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_create_wallet ON public.users;
CREATE TRIGGER users_create_wallet
AFTER INSERT ON public.users
FOR EACH ROW EXECUTE FUNCTION create_wallet_for_new_user();

-- ---------------------------------------------
-- token_transactions
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.token_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID NOT NULL REFERENCES public.token_wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type token_transaction_type NOT NULL,
  reason TEXT,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_transactions_wallet ON public.token_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_user ON public.token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_created ON public.token_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_transactions_lead ON public.token_transactions(lead_id);

-- ---------------------------------------------
-- audit_logs
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action audit_action_type NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);

-- ---------------------------------------------
-- RLS (Row-Level-Security) aktivieren
-- ---------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.callbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------
-- Helper-Funktionen für Policies
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_active_seller()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
DECLARE
  r user_role;
BEGIN
  SELECT role INTO r FROM public.users WHERE id = auth.uid();
  RETURN COALESCE(r, 'seller');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ---------------------------------------------
-- RLS Policies: users
-- ---------------------------------------------
-- Admin: alles sehen und ändern; User: eigenes Profil lesen/ändern
DROP POLICY IF EXISTS users_select ON public.users;
CREATE POLICY users_select ON public.users FOR SELECT
USING (auth.uid() = id OR is_admin());

DROP POLICY IF EXISTS users_update ON public.users;
CREATE POLICY users_update ON public.users FOR UPDATE
USING (auth.uid() = id OR is_admin());

-- Nur Service Role / Trigger darf Insert
DROP POLICY IF EXISTS users_insert ON public.users;
CREATE POLICY users_insert ON public.users FOR INSERT
WITH CHECK (is_admin() OR auth.uid() = id);

-- ---------------------------------------------
-- RLS Policies: campaigns
-- ---------------------------------------------
DROP POLICY IF EXISTS campaigns_select ON public.campaigns;
CREATE POLICY campaigns_select ON public.campaigns FOR SELECT
USING (is_active_seller() OR is_admin());

DROP POLICY IF EXISTS campaigns_all ON public.campaigns;
CREATE POLICY campaigns_all ON public.campaigns FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- ---------------------------------------------
-- RLS Policies: leads
-- ---------------------------------------------
-- Lesen: Admin alles; Seller nur eigene zugewiesene
DROP POLICY IF EXISTS leads_select ON public.leads;
CREATE POLICY leads_select ON public.leads FOR SELECT
USING (is_admin() OR assigned_user_id = auth.uid());

-- Insert: Admin
DROP POLICY IF EXISTS leads_insert ON public.leads;
CREATE POLICY leads_insert ON public.leads FOR INSERT
WITH CHECK (is_admin());

-- Update: Admin (alles); Seller (nur eigene, und nur bestimmte Felder - restlich in App geprüft)
DROP POLICY IF EXISTS leads_update ON public.leads;
CREATE POLICY leads_update ON public.leads FOR UPDATE
USING (is_admin() OR assigned_user_id = auth.uid())
WITH CHECK (is_admin() OR assigned_user_id = auth.uid());

-- Delete: Admin
DROP POLICY IF EXISTS leads_delete ON public.leads;
CREATE POLICY leads_delete ON public.leads FOR DELETE
USING (is_admin());

-- ---------------------------------------------
-- RLS Policies: lead_status_history
-- ---------------------------------------------
DROP POLICY IF EXISTS lead_status_history_select ON public.lead_status_history;
CREATE POLICY lead_status_history_select ON public.lead_status_history FOR SELECT
USING (
  is_admin() OR
  EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_status_history.lead_id
      AND l.assigned_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS lead_status_history_insert ON public.lead_status_history;
CREATE POLICY lead_status_history_insert ON public.lead_status_history FOR INSERT
WITH CHECK (TRUE);

-- ---------------------------------------------
-- RLS Policies: contact_attempts
-- ---------------------------------------------
DROP POLICY IF EXISTS contact_attempts_select ON public.contact_attempts;
CREATE POLICY contact_attempts_select ON public.contact_attempts FOR SELECT
USING (
  is_admin() OR user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = contact_attempts.lead_id AND l.assigned_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS contact_attempts_insert ON public.contact_attempts;
CREATE POLICY contact_attempts_insert ON public.contact_attempts FOR INSERT
WITH CHECK (
  is_admin() OR user_id = auth.uid()
);

-- ---------------------------------------------
-- RLS Policies: callbacks
-- ---------------------------------------------
DROP POLICY IF EXISTS callbacks_select ON public.callbacks;
CREATE POLICY callbacks_select ON public.callbacks FOR SELECT
USING (is_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS callbacks_insert ON public.callbacks;
CREATE POLICY callbacks_insert ON public.callbacks FOR INSERT
WITH CHECK (is_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS callbacks_update ON public.callbacks;
CREATE POLICY callbacks_update ON public.callbacks FOR UPDATE
USING (is_admin() OR user_id = auth.uid())
WITH CHECK (is_admin() OR user_id = auth.uid());

-- ---------------------------------------------
-- RLS Policies: token_wallets
-- ---------------------------------------------
DROP POLICY IF EXISTS token_wallets_select ON public.token_wallets;
CREATE POLICY token_wallets_select ON public.token_wallets FOR SELECT
USING (is_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS token_wallets_update ON public.token_wallets;
CREATE POLICY token_wallets_update ON public.token_wallets FOR UPDATE
USING (is_admin())
WITH CHECK (is_admin());

-- ---------------------------------------------
-- RLS Policies: token_transactions
-- ---------------------------------------------
DROP POLICY IF EXISTS token_transactions_select ON public.token_transactions;
CREATE POLICY token_transactions_select ON public.token_transactions FOR SELECT
USING (is_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS token_transactions_insert ON public.token_transactions;
CREATE POLICY token_transactions_insert ON public.token_transactions FOR INSERT
WITH CHECK (is_admin() OR user_id = auth.uid());

-- ---------------------------------------------
-- RLS Policies: audit_logs
-- ---------------------------------------------
DROP POLICY IF EXISTS audit_logs_select ON public.audit_logs;
CREATE POLICY audit_logs_select ON public.audit_logs FOR SELECT
USING (is_admin());

DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;
CREATE POLICY audit_logs_insert ON public.audit_logs FOR INSERT
WITH CHECK (TRUE);

-- ---------------------------------------------
-- Atomare Lead-Vergabe (aufgerufen via Service-Role RPC sicher)
-- ---------------------------------------------
-- Diese Funktion wird NICHT direkt via RPC im User-Context aufgerufen,
-- sondern in einer Transaktion über den Service Role Client.
-- Hier nur konsistente Hilfsfunktionen.

-- ---------------------------------------------
-- Supabase Auth erlauben, public.users Eintrag bei Signup zu erstellen
-- (Annahme: Signup erfolgt per Service Role oder manuell im Admin-Bereich)
-- ---------------------------------------------

-- ---------------------------------------------
-- RPC: Atomare Lead-Vergabe (FIFO)
-- Wird ausschliesslich via Service-Role aufgerufen
-- Sperrt den ältesten verfügbaren Lead, weist ihn zu und bucht Token.
-- Gibt die lead_id zurück, oder NULL falls kein Lead verfügbar.
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION assign_next_lead_to_user(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_lead_id UUID;
  v_cost INTEGER;
  v_wallet_id UUID;
  v_balance INTEGER;
BEGIN
  -- Wallet des Users laden und sperren
  SELECT id, balance INTO v_wallet_id, v_balance
  FROM public.token_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_WALLET';
  END IF;

  -- Ältesten verfügbaren Lead holen und sperren (FIFO)
  SELECT id, COALESCE(token_cost, 1) INTO v_lead_id, v_cost
  FROM public.leads
  WHERE status = 'new' AND assigned_user_id IS NULL
  ORDER BY created_at ASC, id ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_lead_id IS NULL THEN
    RAISE EXCEPTION 'NO_LEAD';
  END IF;

  IF v_balance < v_cost THEN
    RAISE EXCEPTION 'NOT_ENOUGH_TOKENS';
  END IF;

  -- Lead zuweisen
  UPDATE public.leads
  SET assigned_user_id = p_user_id,
      status = 'assigned'
  WHERE id = v_lead_id;

  -- Wallet abbuchen
  UPDATE public.token_wallets
  SET balance = balance - v_cost
  WHERE id = v_wallet_id;

  -- Token-Transaktion erstellen (Lead-Kauf)
  INSERT INTO public.token_transactions (wallet_id, user_id, amount, type, reason, lead_id, created_by)
  VALUES (v_wallet_id, p_user_id, -v_cost, 'lead_kauf', 'Lead angefordert', v_lead_id, p_user_id);

  -- Audit Log (via SECURITY DEFINER oder Service-Role geschrieben)
  -- Da wir im DB-Context keine auth.uid() gesetzt haben,
  -- wird der zusätzliche Audit-Eintrag von der Business-Logic nachgetragen.

  RETURN v_lead_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;
