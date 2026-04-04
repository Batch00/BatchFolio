-- BatchFolio Database Schema
-- Run this in the Supabase SQL Editor (supabase.com > your project > SQL Editor)
-- Safe to run on a fresh project. Drop tables first if re-running.

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE batchfolio.accounts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  type        text NOT NULL CHECK (type IN ('brokerage', 'retirement')),
  provider    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE batchfolio.holdings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL REFERENCES batchfolio.accounts(id) ON DELETE CASCADE,
  ticker          text NOT NULL,
  shares          numeric NOT NULL CHECK (shares > 0),
  avg_cost_basis  numeric NOT NULL CHECK (avg_cost_basis >= 0),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE batchfolio.liabilities (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           text NOT NULL,
  type           text NOT NULL,
  balance        numeric NOT NULL DEFAULT 0,
  interest_rate  numeric,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE batchfolio.net_worth_snapshots (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date              date NOT NULL,
  total_assets      numeric NOT NULL,
  total_liabilities numeric NOT NULL,
  net_worth         numeric NOT NULL
);

CREATE TABLE batchfolio.watchlist (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker    text NOT NULL,
  added_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ticker)
);

ALTER TABLE batchfolio.accounts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE batchfolio.holdings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE batchfolio.liabilities         ENABLE ROW LEVEL SECURITY;
ALTER TABLE batchfolio.net_worth_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE batchfolio.watchlist           ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounts: owner full access"
  ON batchfolio.accounts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "holdings: owner full access"
  ON batchfolio.holdings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM batchfolio.accounts
      WHERE batchfolio.accounts.id = holdings.account_id
        AND batchfolio.accounts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM batchfolio.accounts
      WHERE batchfolio.accounts.id = holdings.account_id
        AND batchfolio.accounts.user_id = auth.uid()
    )
  );

CREATE POLICY "liabilities: owner full access"
  ON batchfolio.liabilities FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "snapshots: owner full access"
  ON batchfolio.net_worth_snapshots FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "watchlist: owner full access"
  ON batchfolio.watchlist FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
