-- BatchFolio Database Schema
-- Run this in the Supabase SQL Editor (supabase.com > your project > SQL Editor)
-- Safe to run on a fresh project. Drop tables first if re-running.

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE accounts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  type        text NOT NULL CHECK (type IN ('brokerage', 'retirement')),
  provider    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE holdings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  ticker          text NOT NULL,
  shares          numeric NOT NULL CHECK (shares > 0),
  avg_cost_basis  numeric NOT NULL CHECK (avg_cost_basis >= 0),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE liabilities (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           text NOT NULL,
  type           text NOT NULL,
  balance        numeric NOT NULL DEFAULT 0,
  interest_rate  numeric,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE net_worth_snapshots (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date              date NOT NULL,
  total_assets      numeric NOT NULL,
  total_liabilities numeric NOT NULL,
  net_worth         numeric NOT NULL
);

CREATE TABLE watchlist (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker    text NOT NULL,
  added_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ticker)
);

-- ============================================================
-- Enable Row Level Security
-- ============================================================

ALTER TABLE accounts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE holdings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE liabilities         ENABLE ROW LEVEL SECURITY;
ALTER TABLE net_worth_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist           ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies
-- ============================================================

-- accounts
CREATE POLICY "accounts: owner full access"
  ON accounts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- holdings (ownership verified via parent account)
CREATE POLICY "holdings: owner full access"
  ON holdings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.id = holdings.account_id
        AND accounts.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.id = holdings.account_id
        AND accounts.user_id = auth.uid()
    )
  );

-- liabilities
CREATE POLICY "liabilities: owner full access"
  ON liabilities FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- net_worth_snapshots
CREATE POLICY "snapshots: owner full access"
  ON net_worth_snapshots FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- watchlist
CREATE POLICY "watchlist: owner full access"
  ON watchlist FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
