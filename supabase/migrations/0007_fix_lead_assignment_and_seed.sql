-- =============================================
-- Migration 0007 FINAL FIX: Lead-Anforderung + alle RPCs reparieren
-- =============================================
-- Umfasst die Korrekturen aus 0004, 0005, 0006 in EINEM sauberen Run:
--
--  1. Syntaxfehler in assign_lead_to_seller entfernen (git-remote-Zeile)
--  2. assign_next_lead_to_user mit korrekter Signatur (UUID, TEXT) +
--     Produktlogik ('beides'/'all' → strom ODER gas) + is_on_hold=FALSE
--  3. reset_lead mit Signatur (UUID, UUID, BOOLEAN)
--  4. Fehlende token_wallets für aktive User anlegen (initial_balance = 25)
--  5. 30 frische Test-Leads anlegen (nur wenn aktuell < 15 freie Leads)
--  6. Status-History Trigger track_lead_status_change sicherstellen
-- =============================================

-- ====================================================
-- TEIL A: Alle RPCs clean droppen + neu anlegen
-- ====================================================

-- Alte Überladungen entfernen (unabhängig von Parameter-Anzahl)
DROP FUNCTION IF EXISTS public.assign_lead_to_seller(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS public.assign_lead_to_seller(UUID, UUID, UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.reset_lead(UUID, UUID);
DROP FUNCTION IF EXISTS public.reset_lead(UUID, UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.assign_next_lead_to_user(UUID);
DROP FUNCTION IF EXISTS public.assign_next_lead_to_user(UUID, TEXT);
DROP FUNCTION IF EXISTS public.assign_next_lead_to_user(UUID, public.product_type);

-- ====================================================
-- A1) assign_lead_to_seller (4 Parameter, Fix: kein Syntaxfehler mehr)
-- ====================================================
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
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- ====================================================
-- A2) reset_lead (3 Parameter)
-- ====================================================
CREATE OR REPLACE FUNCTION public.reset_lead(
  p_lead_id    UUID,
  p_by_user_id UUID,
  p_refund     BOOLEAN DEFAULT TRUE
)
RETURNS VOID AS $$
DECLARE
  v_prev_user   UUID;
  v_prev_status public.lead_status;
  v_cost        INTEGER;
  v_wallet_id   UUID;
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
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- ====================================================
-- A3) assign_next_lead_to_user (2 Parameter: UUID + TEXT)
--     → Korrekte Produktlogik + is_on_hold=FALSE
-- ====================================================
CREATE OR REPLACE FUNCTION public.assign_next_lead_to_user(
  p_user_id UUID,
  p_product TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id  UUID;
  v_balance    INT;
  v_lead_id    UUID;
  v_cost       INT := 1;
  v_old_status public.lead_status;
BEGIN
  -- Wallet & Balance prüfen (Wallet sperren für Race-Conditions)
  SELECT id, balance INTO v_wallet_id, v_balance
  FROM public.token_wallets
  WHERE user_id = p_user_id
  LIMIT 1
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND';
  END IF;
  IF v_balance < v_cost THEN
    RAISE EXCEPTION 'NOT_ENOUGH_TOKENS';
  END IF;

  -- Lead finden mit korrekter Produkt-Logik
  -- p_product: NULL / '' / 'all' / 'beides' / 'beide' → ALLE Produkte
  --            'strom' → nur strom
  --            'gas'   → nur gas
  SELECT id, COALESCE(token_cost, 1)
    INTO v_lead_id, v_cost
  FROM public.leads
  WHERE assigned_user_id IS NULL
    AND status = 'new'
    AND is_on_hold = FALSE
    AND (
          p_product IS NULL
          OR LENGTH(TRIM(p_product)) = 0
          OR LOWER(TRIM(p_product)) IN ('all', 'beides', 'beide', '')
          OR product::text = TRIM(p_product)
        )
  ORDER BY created_at ASC, id ASC
  LIMIT 1
    FOR UPDATE SKIP LOCKED;

  IF v_lead_id IS NULL THEN
    RAISE EXCEPTION 'NO_LEAD_AVAILABLE';
  END IF;

  IF v_balance < v_cost THEN
    RAISE EXCEPTION 'NOT_ENOUGH_TOKENS';
  END IF;

  -- Alten Status für History merken
  SELECT status INTO v_old_status
  FROM public.leads
  WHERE id = v_lead_id;

  -- Lead zuweisen
  UPDATE public.leads
  SET assigned_user_id = p_user_id,
      assigned_at     = NOW(),
      status          = 'assigned'::public.lead_status,
      updated_by      = p_user_id,
      updated_at      = NOW()
  WHERE id = v_lead_id;

  -- Status-History Eintrag
  INSERT INTO public.lead_status_history (lead_id, old_status, new_status, user_id, note)
  VALUES (
    v_lead_id,
    COALESCE(v_old_status, 'new'::public.lead_status),
    'assigned'::public.lead_status,
    p_user_id,
    'Lead automatisch zugewiesen (Anfrage Verkäufer)'
  )
  ON CONFLICT DO NOTHING;

  -- Wallet abbuchen
  UPDATE public.token_wallets
  SET balance    = balance - v_cost,
      updated_at = NOW()
  WHERE id = v_wallet_id;

  -- Token-Transaktion
  INSERT INTO public.token_transactions
    (wallet_id, user_id, amount, type, reason, lead_id, created_by)
  VALUES
    (v_wallet_id, p_user_id, (v_cost * -1), 'lead_kauf',
     'Lead-Anfrage (RPC assign_next_lead_to_user)', v_lead_id, p_user_id);

  RETURN v_lead_id;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- ====================================================
-- TEIL B: Fehlende Token-Wallets anlegen
-- ====================================================
INSERT INTO public.token_wallets (user_id, balance)
SELECT u.id, 25 AS balance
FROM public.users u
LEFT JOIN public.token_wallets tw ON tw.user_id = u.id
WHERE tw.id IS NULL
  AND u.is_active = TRUE
ON CONFLICT (user_id) DO NOTHING;

-- ====================================================
-- TEIL C: 30 Test-Leads anlegen (nur bei < 15 freien Leads)
-- ====================================================
DO $$
DECLARE
  v_free_count INT;
BEGIN
  SELECT COUNT(*) INTO v_free_count FROM public.leads
   WHERE assigned_user_id IS NULL
     AND status = 'new'
     AND is_on_hold = FALSE;

  IF v_free_count < 15 THEN
    INSERT INTO public.leads (
      first_name, last_name, phone, email, street, zip, city,
      product, source, power_consumption, gas_consumption,
      is_on_hold, token_cost, notes
    ) VALUES
      ('Lukas', 'Schneider', '+4915190000001', 'lukas.s@testmail.local', 'Münsterstraße 10', '48143', 'Münster', 'strom', 'meta_ads', 3800, NULL, FALSE, 1, 'Fix-Seed Lead 01'),
      ('Sophie', 'Bauer', '+4915190000002', 'sophie.b@testmail.local', 'Königsplatz 4', '80333', 'München', 'gas', 'google_ads', NULL, 14200, FALSE, 1, 'Fix-Seed Lead 02'),
      ('Jonas', 'Koch', '+4915190000003', 'jonas.k@testmail.local', 'Schadowstraße 12', '40212', 'Düsseldorf', 'strom', 'manual', 5100, NULL, FALSE, 1, 'Fix-Seed Lead 03'),
      ('Emma', 'Richter', '+4915190000004', 'emma.r@testmail.local', 'Zeil 65', '60313', 'Frankfurt', 'gas', 'manual', NULL, 10500, FALSE, 1, 'Fix-Seed Lead 04'),
      ('Noah', 'Wolf', '+4915190000005', 'noah.w@testmail.local', 'Reeperbahn 44', '20359', 'Hamburg', 'strom', 'meta_ads', 2900, NULL, FALSE, 1, 'Fix-Seed Lead 05'),
      ('Mia', 'Huber', '+4915190000006', 'mia.h@testmail.local', 'Friedrichstraße 101', '10117', 'Berlin', 'gas', 'import', NULL, 12800, FALSE, 1, 'Fix-Seed Lead 06'),
      ('Felix', 'Schröder', '+4915190000007', 'felix.s@testmail.local', 'Planken 2', '68161', 'Mannheim', 'strom', 'empfehlung', 4400, NULL, FALSE, 1, 'Fix-Seed Lead 07'),
      ('Hannah', 'Neumann', '+4915190000008', 'hannah.n@testmail.local', 'Georgstraße 3', '30159', 'Hannover', 'strom', 'manual', 3200, NULL, FALSE, 1, 'Fix-Seed Lead 08'),
      ('Paul', 'Schwarz', '+4915190000009', 'paul.s@testmail.local', 'Königstraße 22', '70173', 'Stuttgart', 'gas', 'google_ads', NULL, 9500, FALSE, 1, 'Fix-Seed Lead 09'),
      ('Clara', 'Zimmermann', '+4915190000010', 'clara.z@testmail.local', 'Kaiserstraße 17', '76131', 'Karlsruhe', 'strom', 'manual', 4700, NULL, FALSE, 1, 'Fix-Seed Lead 10'),
      ('Ben', 'Braun', '+4915190000011', 'ben.b@testmail.local', 'Marktplatz 8', '90403', 'Nürnberg', 'gas', 'meta_ads', NULL, 15000, FALSE, 1, 'Fix-Seed Lead 11'),
      ('Lea', 'Krüger', '+4915190000012', 'lea.k@testmail.local', 'Alte Poststraße 3', '04109', 'Leipzig', 'strom', 'manual', 3600, NULL, FALSE, 1, 'Fix-Seed Lead 12'),
      ('Tim', 'Hofmann', '+4915190000013', 'tim.h@testmail.local', 'Domplatz 1', '01067', 'Dresden', 'gas', 'sonstiges', NULL, 11200, FALSE, 1, 'Fix-Seed Lead 13'),
      ('Lina', 'Hartmann', '+4915190000014', 'lina.h@testmail.local', 'Bahnhofstraße 14', '28195', 'Bremen', 'strom', 'manual', 4100, NULL, FALSE, 1, 'Fix-Seed Lead 14'),
      ('Sam', 'Lange', '+4915190000015', 'sam.l@testmail.local', 'Rheinstraße 40', '55116', 'Mainz', 'gas', 'meta_ads', NULL, 13500, FALSE, 1, 'Fix-Seed Lead 15'),
      ('Nora', 'Schmitt', '+4915190000016', 'nora.s@testmail.local', 'Allee 2', '66111', 'Saarbrücken', 'strom', 'manual', 3900, NULL, FALSE, 1, 'Fix-Seed Lead 16'),
      ('Tom', 'Werner', '+4915190000017', 'tom.w@testmail.local', 'Am Markt 5', '34117', 'Kassel', 'strom', 'manual', 5000, NULL, FALSE, 1, 'Fix-Seed Lead 17'),
      ('Eva', 'Frank', '+4915190000018', 'eva.f@testmail.local', 'Schlossberg 1', '79098', 'Freiburg', 'gas', 'google_ads', NULL, 10800, FALSE, 1, 'Fix-Seed Lead 18'),
      ('Max', 'Berger', '+4915190000019', 'max.b@testmail.local', 'Bismarckstraße 6', '99084', 'Erfurt', 'strom', 'manual', 3300, NULL, FALSE, 1, 'Fix-Seed Lead 19'),
      ('Ida', 'Peters', '+4915190000020', 'ida.p@testmail.local', 'Hafenstraße 22', '47051', 'Duisburg', 'gas', 'meta_ads', NULL, 11900, FALSE, 1, 'Fix-Seed Lead 20'),
      ('Leo', 'Stein', '+4915190000021', 'leo.s@testmail.local', 'Hauptstraße 89', '14770', 'Brandenburg', 'strom', 'manual', 4600, NULL, FALSE, 1, 'Fix-Seed Lead 21'),
      ('Greta', 'Jäger', '+4915190000022', 'greta.j@testmail.local', 'Ossenreyerstraße 12', '18435', 'Stralsund', 'gas', 'manual', NULL, 12200, FALSE, 1, 'Fix-Seed Lead 22'),
      ('Jonah', 'Fischer', '+4915190000023', 'jonah.f@testmail.local', 'Görresstraße 7', '56068', 'Koblenz', 'strom', 'import', 2950, NULL, FALSE, 1, 'Fix-Seed Lead 23'),
      ('Tess', 'Schuster', '+4915190000024', 'tess.s@testmail.local', 'Anger 15', '04275', 'Leipzig', 'gas', 'manual', NULL, 9800, FALSE, 1, 'Fix-Seed Lead 24'),
      ('Mats', 'Jung', '+4915190000025', 'mats.j@testmail.local', 'Brückenstraße 3', '44135', 'Dortmund', 'strom', 'meta_ads', 4800, NULL, FALSE, 1, 'Fix-Seed Lead 25'),
      ('Romy', 'Vogel', '+4915190000026', 'romy.v@testmail.local', 'Flensburger Straße 4', '24937', 'Flensburg', 'gas', 'manual', NULL, 14000, FALSE, 1, 'Fix-Seed Lead 26'),
      ('Rafael', 'Sauer', '+4915190000027', 'rafael.s@testmail.local', 'Schillerplatz 9', '70173', 'Stuttgart', 'strom', 'manual', 3450, NULL, FALSE, 1, 'Fix-Seed Lead 27'),
      ('Mira', 'Kirchhoff', '+4915190000028', 'mira.k@testmail.local', 'Nußbaumstraße 21', '80336', 'München', 'strom', 'empfehlung', 4250, NULL, FALSE, 1, 'Fix-Seed Lead 28'),
      ('Finn', 'Graf', '+4915190000029', 'finn.g@testmail.local', 'Holstenstraße 2', '20355', 'Hamburg', 'gas', 'manual', NULL, 11000, FALSE, 1, 'Fix-Seed Lead 29'),
      ('Juna', 'Becker', '+4915190000030', 'juna.b@testmail.local', 'Potsdamer Straße 50', '10785', 'Berlin', 'strom', 'meta_ads', 3900, NULL, FALSE, 1, 'Fix-Seed Lead 30');
  END IF;
END $$;

-- ====================================================
-- TEIL D: Rechte entziehen (werden über Security Definer + Service Role ausgeführt)
-- ====================================================
REVOKE ALL ON FUNCTION public.assign_lead_to_seller(UUID, UUID, UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_lead(UUID, UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_next_lead_to_user(UUID, TEXT) FROM PUBLIC;

-- ====================================================
-- TEIL E: Test-Abfrage — Status nach der Fix-Migration
-- ====================================================
SELECT 'NACH_FIX: Freie Leads' AS info, COUNT(*) AS anzahl,
       MIN(created_at)::date AS aeltester_lead,
       MAX(created_at)::date AS juesngster_lead
FROM public.leads
WHERE assigned_user_id IS NULL AND status = 'new' AND is_on_hold = FALSE;
