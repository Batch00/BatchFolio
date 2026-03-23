-- Demo seed data for BatchFolio
-- IMPORTANT: Replace '08e77304-19bd-4a47-9338-29bc2e052360' with the real demo user's UUID
-- from Supabase Auth (Settings > Users) before running this script.
-- The demo user must already exist with email demo@batchfolio.app / password demo1234.

-- ============================================================
-- Accounts
-- ============================================================
INSERT INTO accounts (id, user_id, name, type, provider, created_at) VALUES
  ('aaaaaaaa-0001-0000-0000-000000000001', '08e77304-19bd-4a47-9338-29bc2e052360', 'Fidelity Brokerage', 'brokerage', 'Fidelity', now() - interval '180 days'),
  ('aaaaaaaa-0001-0000-0000-000000000002', '08e77304-19bd-4a47-9338-29bc2e052360', 'Vanguard 401k', 'retirement', 'Vanguard', now() - interval '180 days'),
  ('aaaaaaaa-0001-0000-0000-000000000003', '08e77304-19bd-4a47-9338-29bc2e052360', 'Robinhood', 'brokerage', 'Robinhood', now() - interval '180 days');

-- ============================================================
-- Holdings - Fidelity Brokerage
-- ============================================================
INSERT INTO holdings (account_id, ticker, shares, avg_cost_basis, updated_at) VALUES
  ('aaaaaaaa-0001-0000-0000-000000000001', 'AAPL',  45,  142.50, now()),
  ('aaaaaaaa-0001-0000-0000-000000000001', 'MSFT',  28,  285.00, now()),
  ('aaaaaaaa-0001-0000-0000-000000000001', 'NVDA',  12,  410.00, now()),
  ('aaaaaaaa-0001-0000-0000-000000000001', 'VTI',   60,  195.00, now());

-- Holdings - Vanguard 401k
INSERT INTO holdings (account_id, ticker, shares, avg_cost_basis, updated_at) VALUES
  ('aaaaaaaa-0001-0000-0000-000000000002', 'VTSAX', 180,  88.00, now()),
  ('aaaaaaaa-0001-0000-0000-000000000002', 'VTIAX',  90,  62.00, now()),
  ('aaaaaaaa-0001-0000-0000-000000000002', 'VBTLX',  45,   9.80, now());

-- Holdings - Robinhood
INSERT INTO holdings (account_id, ticker, shares, avg_cost_basis, updated_at) VALUES
  ('aaaaaaaa-0001-0000-0000-000000000003', 'TSLA',   8, 220.00, now()),
  ('aaaaaaaa-0001-0000-0000-000000000003', 'AMZN',  15, 148.00, now()),
  ('aaaaaaaa-0001-0000-0000-000000000003', 'SPY',   20, 410.00, now());

-- ============================================================
-- Liabilities
-- ============================================================
INSERT INTO liabilities (user_id, name, type, balance, interest_rate, created_at) VALUES
  ('08e77304-19bd-4a47-9338-29bc2e052360', 'Student Loan', 'loan', 18400.00, 4.5,  now() - interval '365 days'),
  ('08e77304-19bd-4a47-9338-29bc2e052360', 'Car Loan',     'loan',  9200.00, 6.2,  now() - interval '365 days');

-- ============================================================
-- Net worth snapshots (12 months, realistic variance)
-- ============================================================
INSERT INTO net_worth_snapshots (user_id, date, total_assets, total_liabilities, net_worth) VALUES
  ('08e77304-19bd-4a47-9338-29bc2e052360', (current_date - interval '11 months')::date, 207600,  27600, 180000),
  ('08e77304-19bd-4a47-9338-29bc2e052360', (current_date - interval '10 months')::date, 219800,  27300, 192500),
  ('08e77304-19bd-4a47-9338-29bc2e052360', (current_date - interval '9 months')::date,  215200,  27000, 188200),
  ('08e77304-19bd-4a47-9338-29bc2e052360', (current_date - interval '8 months')::date,  232400,  26700, 205700),
  ('08e77304-19bd-4a47-9338-29bc2e052360', (current_date - interval '7 months')::date,  242000,  26500, 215500),
  ('08e77304-19bd-4a47-9338-29bc2e052360', (current_date - interval '6 months')::date,  236800,  26200, 210600),
  ('08e77304-19bd-4a47-9338-29bc2e052360', (current_date - interval '5 months')::date,  254200,  25900, 228300),
  ('08e77304-19bd-4a47-9338-29bc2e052360', (current_date - interval '4 months')::date,  266000,  25600, 240400),
  ('08e77304-19bd-4a47-9338-29bc2e052360', (current_date - interval '3 months')::date,  277800,  25300, 252500),
  ('08e77304-19bd-4a47-9338-29bc2e052360', (current_date - interval '2 months')::date,  283500,  25000, 258500),
  ('08e77304-19bd-4a47-9338-29bc2e052360', (current_date - interval '1 month')::date,   295400,  24700, 270700),
  ('08e77304-19bd-4a47-9338-29bc2e052360', current_date,                                 309200,  24400, 284800);

-- ============================================================
-- Watchlist
-- ============================================================
INSERT INTO watchlist (user_id, ticker, added_at) VALUES
  ('08e77304-19bd-4a47-9338-29bc2e052360', 'QQQ',  now() - interval '60 days'),
  ('08e77304-19bd-4a47-9338-29bc2e052360', 'GLD',  now() - interval '45 days'),
  ('08e77304-19bd-4a47-9338-29bc2e052360', 'AMD',  now() - interval '30 days'),
  ('08e77304-19bd-4a47-9338-29bc2e052360', 'PLTR', now() - interval '15 days');
