-- Run this in Supabase SQL editor
-- Replace '47c88099-a0b4-424e-a056-1ac108cefb48' with actual demo user UUID
-- Also update reset-demo edge function with these same values

-- Ensure unique constraint exists for snapshot upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'snapshots_user_date_unique'
  ) THEN
    ALTER TABLE batchfolio.net_worth_snapshots
      ADD CONSTRAINT snapshots_user_date_unique UNIQUE (user_id, date);
  END IF;
END $$;

-- ============================================================
-- Clear old demo data (cascade handles holdings via accounts)
-- ============================================================
DELETE FROM batchfolio.watchlist WHERE user_id = '47c88099-a0b4-424e-a056-1ac108cefb48';
DELETE FROM batchfolio.net_worth_snapshots WHERE user_id = '47c88099-a0b4-424e-a056-1ac108cefb48';
DELETE FROM batchfolio.liabilities WHERE user_id = '47c88099-a0b4-424e-a056-1ac108cefb48';
DELETE FROM batchfolio.accounts WHERE user_id = '47c88099-a0b4-424e-a056-1ac108cefb48';

-- ============================================================
-- Accounts
-- ============================================================
INSERT INTO batchfolio.accounts (id, user_id, name, type, provider, created_at) VALUES
  ('aaaaaaaa-0001-0000-0000-000000000001', '47c88099-a0b4-424e-a056-1ac108cefb48', 'Fidelity Brokerage', 'brokerage', 'Fidelity', now() - interval '180 days'),
  ('aaaaaaaa-0001-0000-0000-000000000002', '47c88099-a0b4-424e-a056-1ac108cefb48', 'Vanguard Retirement', 'retirement', 'Vanguard', now() - interval '180 days'),
  ('aaaaaaaa-0001-0000-0000-000000000003', '47c88099-a0b4-424e-a056-1ac108cefb48', 'Robinhood', 'brokerage', 'Robinhood', now() - interval '180 days');

-- ============================================================
-- Holdings
-- ============================================================
INSERT INTO batchfolio.holdings (account_id, ticker, shares, avg_cost_basis, updated_at) VALUES
  ('aaaaaaaa-0001-0000-0000-000000000001', 'AAPL',  22, 142.50, now()),
  ('aaaaaaaa-0001-0000-0000-000000000001', 'MSFT',  14, 285.00, now()),
  ('aaaaaaaa-0001-0000-0000-000000000001', 'VTI',   30, 195.00, now()),
  ('aaaaaaaa-0001-0000-0000-000000000001', 'SPY',   10, 410.00, now()),
  ('aaaaaaaa-0001-0000-0000-000000000002', 'VTI',   40, 185.00, now()),
  ('aaaaaaaa-0001-0000-0000-000000000002', 'VXUS',  35,  52.00, now()),
  ('aaaaaaaa-0001-0000-0000-000000000002', 'BND',   50,  72.00, now()),
  ('aaaaaaaa-0001-0000-0000-000000000003', 'TSLA',   5, 220.00, now()),
  ('aaaaaaaa-0001-0000-0000-000000000003', 'AMZN',   8, 148.00, now()),
  ('aaaaaaaa-0001-0000-0000-000000000003', 'NVDA',   4, 410.00, now());

-- ============================================================
-- Liabilities
-- ============================================================
INSERT INTO batchfolio.liabilities (user_id, name, type, balance, interest_rate, created_at) VALUES
  ('47c88099-a0b4-424e-a056-1ac108cefb48', 'Student Loan', 'loan', 18400.00, 4.5, now() - interval '365 days'),
  ('47c88099-a0b4-424e-a056-1ac108cefb48', 'Car Loan',     'loan',  9200.00, 6.2, now() - interval '365 days');

-- ============================================================
-- Net Worth Snapshots (12 months)
-- ============================================================
INSERT INTO batchfolio.net_worth_snapshots (user_id, date, total_assets, total_liabilities, net_worth) VALUES
  ('47c88099-a0b4-424e-a056-1ac108cefb48', (current_date - interval '12 months')::date, 48000, 29000, 19000),
  ('47c88099-a0b4-424e-a056-1ac108cefb48', (current_date - interval '11 months')::date, 49200, 28600, 20600),
  ('47c88099-a0b4-424e-a056-1ac108cefb48', (current_date - interval '10 months')::date, 51000, 28200, 22800),
  ('47c88099-a0b4-424e-a056-1ac108cefb48', (current_date - interval '9 months')::date,  50400, 27800, 22600),
  ('47c88099-a0b4-424e-a056-1ac108cefb48', (current_date - interval '8 months')::date,  53000, 27400, 25600),
  ('47c88099-a0b4-424e-a056-1ac108cefb48', (current_date - interval '7 months')::date,  55500, 27000, 28500),
  ('47c88099-a0b4-424e-a056-1ac108cefb48', (current_date - interval '6 months')::date,  54200, 26800, 27400),
  ('47c88099-a0b4-424e-a056-1ac108cefb48', (current_date - interval '5 months')::date,  57000, 26600, 30400),
  ('47c88099-a0b4-424e-a056-1ac108cefb48', (current_date - interval '4 months')::date,  59500, 26400, 33100),
  ('47c88099-a0b4-424e-a056-1ac108cefb48', (current_date - interval '3 months')::date,  61000, 26200, 34800),
  ('47c88099-a0b4-424e-a056-1ac108cefb48', (current_date - interval '2 months')::date,  63500, 26000, 37500),
  ('47c88099-a0b4-424e-a056-1ac108cefb48', (current_date - interval '1 month')::date,   66000, 27600, 38400);

-- ============================================================
-- Watchlist
-- ============================================================
INSERT INTO batchfolio.watchlist (user_id, ticker, added_at) VALUES
  ('47c88099-a0b4-424e-a056-1ac108cefb48', 'QQQ',  now() - interval '60 days'),
  ('47c88099-a0b4-424e-a056-1ac108cefb48', 'GLD',  now() - interval '45 days'),
  ('47c88099-a0b4-424e-a056-1ac108cefb48', 'AMD',  now() - interval '30 days'),
  ('47c88099-a0b4-424e-a056-1ac108cefb48', 'PLTR', now() - interval '15 days');
