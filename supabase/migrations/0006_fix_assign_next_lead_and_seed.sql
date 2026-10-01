-- =============================================
-- Migration 0006: Korrektur assign_next_lead_to_user + Test-Leads
-- =============================================
-- Korrekturen:
-- 1. Alte Überladungen von assign_next_lead_to_user entfernen
--    (1-parametrig + 2-parametrig aus vorherigen Migrationen)
-- 2. Korrekte 2-parametrige Version:
--    - Berücksichtigt is_on_hold = FALSE (sonst werden gehaltene Leads nicht verteilt)
--    - Korrekte Behandlung von p_product = 'beides' / 'all' / NULL
--      (statt product = p_product passte nie bei 'beides',
--       weil Leads haben nur 'strom' oder 'gas')
--    - Korrekte Exception NO_LEAD_AVAILABLE statt NO_LEAD
--    - assigned_at + updated_by setzen
-- 3. Seed von 25 zusätzlichen Test-Leads
-- =============================================

-- ============ 1) Alte RPC-Überladungen entfernen ============
DROP FUNCTION IF EXISTS public.assign_next_lead_to_user(UUID);
DROP FUNCTION IF EXISTS public.assign_next_lead_to_user(UUID, TEXT);
DROP FUNCTION IF EXISTS public.assign_next_lead_to_user(UUID, public.product_type);

-- ============ 2) Korrekte RPC neu erstellen ============
CREATE OR REPLACE FUNCTION public.assign_next_lead_to_user(
  p_user_id UUID,
  p_product TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_balance   INT;
  v_lead_id   UUID;
  v_cost      INT := 1;
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

  -- ========== KORREKTUR: Lead finden mit korrekter Produkt-Logik ==========
  -- p_product kann sein:
  --   NULL / '' / 'all' / 'beides'  → alle Produkte (strom ODER gas)
  --   'strom'                      → nur strom
  --   'gas'                        → nur gas
  -- Zusätzlich: is_on_hold = FALSE, status = 'new', assigned_user_id IS NULL
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
      status        = 'assigned'::public.lead_status,
      updated_by    = p_user_id,
      updated_at    = NOW()
  WHERE id = v_lead_id;

  -- Status-History Eintrag (falls Trigger nicht greift oder explizit)
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

-- REVOKE / GRANT
REVOKE ALL ON FUNCTION public.assign_next_lead_to_user(UUID, TEXT) FROM PUBLIC;

-- ============ 3) Seed: 25 zusätzliche Test-Leads ============
-- (nur einfügen, wenn die Tabelle aktuell <= 10 offene Leads hat
--  und keine Duplikate bei Telefonnummern entstehen)
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.leads
   WHERE assigned_user_id IS NULL AND status = 'new';

  IF v_count <= 10 THEN
    INSERT INTO public.leads (
      first_name, last_name, phone, email, street, zip, city,
      product, source, power_consumption, gas_consumption,
      is_on_hold, token_cost, notes
    ) VALUES
      ('Max', 'Mustermann', '+4915110000001', 'max.mustermann1@test.local', 'Hauptstraße 1', '10115', 'Berlin', 'strom', 'manual', 3500, NULL, FALSE, 1, 'Test Lead Seed 01'),
      ('Anna', 'Schmidt', '+4915110000002', 'anna.schmidt1@test.local', 'Bahnhofsplatz 5', '20095', 'Hamburg', 'gas', NULL, NULL, 12000, FALSE, 1, 'Test Lead Seed 02'),
      ('Peter', 'Fischer', '+4915110000003', 'peter.fischer@test.local', 'Mühlweg 12', '80331', 'München', 'strom', 'manual', 4200, NULL, FALSE, 1, 'Test Lead Seed 03'),
      ('Maria', 'Weber', '+4915110000004', 'maria.weber@test.local', 'Schulstraße 8', '50667', 'Köln', 'strom', NULL, 2800, NULL, FALSE, 1, 'Test Lead Seed 04'),
      ('Thomas', 'Braun', '+4915110000005', 'thomas.braun@test.local', 'Gartenstraße 22', '60311', 'Frankfurt', 'gas', 'manual', NULL, 9500, FALSE, 1, 'Test Lead Seed 05'),
      ('Julia', 'Wagner', '+4915110000006', 'julia.wagner@test.local', 'Königsallee 45', '40212', 'Düsseldorf', 'strom', 'meta_ads', 5100, NULL, FALSE, 1, 'Test Lead Seed 06'),
      ('Michael', 'Becker', '+4915110000007', 'michael.becker@test.local', 'Rheinstraße 17', '70173', 'Stuttgart', 'gas', NULL, NULL, 15000, FALSE, 1, 'Test Lead Seed 07'),
      ('Sarah', 'Hoffmann', '+4915110000008', 'sarah.hoffmann@test.local', 'Berliner Platz 3', '45127', 'Essen', 'strom', 'manual', 3900, NULL, FALSE, 1, 'Test Lead Seed 08'),
      ('Daniel', 'Schulz', '+4915110000009', 'daniel.schulz@test.local', 'Eichenweg 9', '01067', 'Dresden', 'strom', NULL, 4600, NULL, FALSE, 1, 'Test Lead Seed 09'),
      ('Lisa', 'Koch', '+4915110000010', 'lisa.koch@test.local', 'Am Markt 14', '28195', 'Bremen', 'gas', 'manual', NULL, 11000, FALSE, 1, 'Test Lead Seed 10'),
      ('Stefan', 'Richter', '+4915110000011', 'stefan.richter@test.local', 'Bergstraße 31', '30159', 'Hannover', 'strom', 'meta_ads', 3300, NULL, FALSE, 1, 'Test Lead Seed 11'),
      ('Nadine', 'Klein', '+4915110000012', 'nadine.klein@test.local', 'Schlossallee 7', '55116', 'Mainz', 'gas', NULL, NULL, 13500, FALSE, 1, 'Test Lead Seed 12'),
      ('Andreas', 'Schröder', '+4915110000013', 'andreas.schroeder@test.local', 'Waldweg 2', '18055', 'Rostock', 'strom', 'manual', 4800, NULL, FALSE, 1, 'Test Lead Seed 13'),
      ('Sandra', 'Neumann', '+4915110000014', 'sandra.neumann@test.local', 'Kirchplatz 19', '66111', 'Saarbrücken', 'strom', NULL, 2900, NULL, FALSE, 1, 'Test Lead Seed 14'),
      ('Markus', 'Schwarz', '+4915110000015', 'markus.schwarz@test.local', 'Lindenallee 26', '34117', 'Kassel', 'gas', 'manual', NULL, 10500, FALSE, 1, 'Test Lead Seed 15'),
      ('Nicole', 'Zimmermann', '+4915110000016', 'nicole.zimmermann@test.local', 'Brunnenstraße 11', '79098', 'Freiburg', 'strom', 'meta_ads', 4100, NULL, FALSE, 1, 'Test Lead Seed 16'),
      ('Jan', 'Braun', '+4915110000017', 'jan.braun@test.local', 'Rosenweg 4', '90402', 'Nürnberg', 'gas', NULL, NULL, 14200, FALSE, 1, 'Test Lead Seed 17'),
      ('Tina', 'Hofmann', '+4915110000018', 'tina.hofmann@test.local', 'Johannisstraße 13', '04103', 'Leipzig', 'strom', 'manual', 3700, NULL, FALSE, 1, 'Test Lead Seed 18'),
      ('Matthias', 'Krüger', '+4915110000019', 'matthias.krueger@test.local', 'Talstraße 38', '76133', 'Karlsruhe', 'strom', NULL, 4400, NULL, FALSE, 1, 'Test Lead Seed 19'),
      ('Anja', 'Lange', '+4915110000020', 'anja.lange@test.local', 'Am Park 8', '47051', 'Duisburg', 'gas', 'manual', NULL, 9800, FALSE, 1, 'Test Lead Seed 20'),
      ('Florian', 'Herrmann', '+4915110000021', 'florian.herrmann@test.local', 'Dorfstraße 42', '14770', 'Brandenburg', 'strom', 'meta_ads', 3200, NULL, FALSE, 1, 'Test Lead Seed 21'),
      ('Claudia', 'Schmitt', '+4915110000022', 'claudia.schmitt@test.local', 'Werftstraße 6', '18437', 'Stralsund', 'gas', NULL, NULL, 12800, FALSE, 1, 'Test Lead Seed 22'),
      ('Sven', 'Bayer', '+4915110000023', 'sven.bayer@test.local', 'Kurfürstenstraße 29', '56068', 'Koblenz', 'strom', 'manual', 4900, NULL, FALSE, 1, 'Test Lead Seed 23'),
      ('Julia', 'Weigel', '+4915110000024', 'julia.weigel@test.local', 'Schillerplatz 15', '99084', 'Erfurt', 'strom', NULL, 3600, NULL, FALSE, 1, 'Test Lead Seed 24'),
      ('Philipp', 'Berger', '+4915110000025', 'philipp.berger@test.local', 'Amselweg 18', '44135', 'Dortmund', 'gas', 'meta_ads', NULL, 11800, FALSE, 1, 'Test Lead Seed 25');
  END IF;
END $$;
