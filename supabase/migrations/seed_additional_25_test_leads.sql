-- =============================================
-- Seed-Skript: Zusätzliche 25 Test-Leads
-- =============================================
-- Dieses Skript fügt IMMER 25 neue Leads hinzu (ohne Bedingung).
-- Ausführen im Supabase SQL Editor → Run
-- Bei Bedarf mehrfach ausführen (je 25 weitere Leads).
-- =============================================

INSERT INTO public.leads (
  first_name, last_name, phone, email, street, zip, city,
  product, source, power_consumption, gas_consumption,
  is_on_hold, token_cost, notes, status
) VALUES
  ('Lukas', 'Peters', '+4915120000101', 'lukas.peters@test.local', 'Goethestraße 10', '28203', 'Bremen', 'strom', 'manual', 4700, NULL, FALSE, 1, 'Manuell erstellter Test Lead 01', 'new'),
  ('Henriette', 'Thomsen', '+4915120000102', 'henriette.thomsen@test.local', 'Friesenwall 15', '26122', 'Oldenburg', 'gas', 'manual', NULL, 16500, FALSE, 1, 'Manuell erstellter Test Lead 02', 'new'),
  ('Jonas', 'Behrens', '+4915120000103', 'jonas.behrens@test.local', 'Am Wall 89', '28195', 'Bremen', 'strom', 'meta_ads', 3100, NULL, FALSE, 1, 'Manuell erstellter Test Lead 03', 'new'),
  ('Maren', 'Albers', '+4915120000104', 'maren.albers@test.local', 'Hafenstraße 44', '27568', 'Bremerhaven', 'gas', 'manual', NULL, 13200, FALSE, 1, 'Manuell erstellter Test Lead 04', 'new'),
  ('Tom', 'Rademacher', '+4915120000105', 'tom.rademacher@test.local', 'Bahnhofsstraße 12', '49074', 'Osnabrück', 'strom', 'manual', 5400, NULL, FALSE, 1, 'Manuell erstellter Test Lead 05', 'new'),
  ('Greta', 'Sievert', '+4915120000106', 'greta.sievert@test.local', 'Kreuzstraße 7', '30419', 'Hannover', 'strom', 'meta_ads', 3900, NULL, FALSE, 1, 'Manuell erstellter Test Lead 06', 'new'),
  ('Ben', 'Diedrich', '+4915120000107', 'ben.diedrich@test.local', 'Langgarten 23', '26789', 'Leer', 'gas', 'manual', NULL, 10900, FALSE, 1, 'Manuell erstellter Test Lead 07', 'new'),
  ('Paula', 'Harms', '+4915120000108', 'paula.harms@test.local', 'Schützenstraße 31', '21335', 'Lüneburg', 'strom', 'manual', 4300, NULL, FALSE, 1, 'Manuell erstellter Test Lead 08', 'new'),
  ('Finn', 'Oestmann', '+4915120000109', 'finn.oestmann@test.local', 'Ritterstraße 16', '21244', 'Buchholz', 'gas', 'meta_ads', NULL, 14800, FALSE, 1, 'Manuell erstellter Test Lead 09', 'new'),
  ('Lina', 'Buchholz', '+4915120000110', 'lina.buchholz@test.local', 'Theodor-Heuss-Platz 4', '31134', 'Hildesheim', 'strom', 'manual', 2700, NULL, FALSE, 1, 'Manuell erstellter Test Lead 10', 'new'),
  ('Til', 'Möller', '+4915120000111', 'til.moeller@test.local', 'Kurt-Schumacher-Straße 58', '49084', 'Osnabrück', 'strom', 'manual', 5200, NULL, FALSE, 1, 'Manuell erstellter Test Lead 11', 'new'),
  ('Mira', 'Lührs', '+4915120000112', 'mira.luehrs@test.local', 'Am Schloß 9', '31785', 'Hameln', 'gas', 'meta_ads', NULL, 11700, FALSE, 1, 'Manuell erstellter Test Lead 12', 'new'),
  ('Janne', 'Sierig', '+4915120000113', 'janne.sierig@test.local', 'Brunnenstraße 28', '27472', 'Cuxhaven', 'strom', 'manual', 3400, NULL, FALSE, 1, 'Manuell erstellter Test Lead 13', 'new'),
  ('Matteo', 'Wolfgramm', '+4915120000114', 'matteo.wolfgramm@test.local', 'Willy-Brandt-Allee 120', '28215', 'Bremen', 'gas', 'manual', NULL, 9300, FALSE, 1, 'Manuell erstellter Test Lead 14', 'new'),
  ('Thea', 'Wichmann', '+4915120000115', 'thea.wichmann@test.local', 'Holzstraße 41', '49377', 'Vechta', 'strom', 'meta_ads', 4600, NULL, FALSE, 1, 'Manuell erstellter Test Lead 15', 'new'),
  ('Luc', 'Voss', '+4915120000116', 'luc.voss@test.local', 'Hauptstraße 112', '26871', 'Papenburg', 'strom', 'manual', 5100, NULL, FALSE, 1, 'Manuell erstellter Test Lead 16', 'new'),
  ('Helen', 'Focke', '+4915120000117', 'helen.focke@test.local', 'Breite Straße 55', '33602', 'Bielefeld', 'gas', 'manual', NULL, 12900, FALSE, 1, 'Manuell erstellter Test Lead 17', 'new'),
  ('Mats', 'Gehlen', '+4915120000118', 'mats.gehlen@test.local', 'Rheinallee 13', '55545', 'Bad Kreuznach', 'strom', 'meta_ads', 3800, NULL, FALSE, 1, 'Manuell erstellter Test Lead 18', 'new'),
  ('Emely', 'Brockmann', '+4915120000119', 'emely.brockmann@test.local', 'Schillerstraße 33', '25813', 'Husum', 'gas', 'manual', NULL, 15600, FALSE, 1, 'Manuell erstellter Test Lead 19', 'new'),
  ('Lasse', 'Sturm', '+4915120000120', 'lasse.sturm@test.local', 'Domplatz 18', '48143', 'Münster', 'strom', 'manual', 4500, NULL, FALSE, 1, 'Manuell erstellter Test Lead 20', 'new'),
  ('Frieda', 'Kamp', '+4915120000121', 'frieda.kamp@test.local', 'Marktstraße 77', '26316', 'Varel', 'gas', 'meta_ads', NULL, 10100, FALSE, 1, 'Manuell erstellter Test Lead 21', 'new'),
  ('Hanno', 'Roth', '+4915120000122', 'hanno.roth@test.local', 'Am Tiergarten 4', '10557', 'Berlin', 'strom', 'manual', 2900, NULL, FALSE, 1, 'Manuell erstellter Test Lead 22', 'new'),
  ('Milla', 'Schotte', '+4915120000123', 'milla.schotte@test.local', 'Augustenstraße 82', '70197', 'Stuttgart', 'strom', 'manual', 4900, NULL, FALSE, 1, 'Manuell erstellter Test Lead 23', 'new'),
  ('Juri', 'Karge', '+4915120000124', 'juri.karge@test.local', 'Westendstraße 101', '80339', 'München', 'gas', 'meta_ads', NULL, 13800, FALSE, 1, 'Manuell erstellter Test Lead 24', 'new'),
  ('Nela', 'Thiele', '+4915120000125', 'nela.thiele@test.local', 'Taunusanlage 16', '60329', 'Frankfurt', 'strom', 'manual', 3600, NULL, FALSE, 1, 'Manuell erstellter Test Lead 25', 'new');
