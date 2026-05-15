/*
  # AlphaTrace Core Schema

  1. New Tables
    - `wallets` - Tracks all encountered wallets with discovery metadata
    - `wallet_metric_snapshots` - Periodic snapshots of wallet performance metrics
    - `wallet_token_pnl` - Per-token PNL records for each wallet
    - `wallet_holdings` - Current token holdings for each wallet
    - `tokens` - Token metadata cache to avoid repeated API calls
    - `leaderboard_snapshots` - Leaderboard generation snapshots
    - `leaderboard_entries` - Individual wallet entries within a leaderboard snapshot
    - `token_signal_snapshots` - Smart money token signal snapshots
    - `token_signal_participants` - Wallets participating in each token signal

  2. Security
    - RLS enabled on all tables
    - All tables restricted to authenticated users for read
    - Only service role can insert/update (via backend API routes)

  3. Notes
    - Using `time_window` instead of `window` to avoid Postgres reserved word conflict
*/

-- Wallets table
CREATE TABLE IF NOT EXISTS wallets (
  address text PRIMARY KEY,
  first_seen_at timestamptz DEFAULT now(),
  first_funded_at timestamptz,
  source text DEFAULT 'trader_gainers_losers',
  last_refreshed_at timestamptz DEFAULT now()
);

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read wallets"
  ON wallets FOR SELECT
  TO authenticated
  USING (true);

-- Wallet metric snapshots
CREATE TABLE IF NOT EXISTS wallet_metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text REFERENCES wallets(address),
  time_window text NOT NULL DEFAULT '7d',
  pnl_usd numeric DEFAULT 0,
  roi_percent numeric DEFAULT 0,
  win_rate numeric DEFAULT 0,
  trade_count integer DEFAULT 0,
  volume_usd numeric DEFAULT 0,
  wallet_age_days integer,
  alpha_score integer DEFAULT 0,
  alpha_class text DEFAULT 'Moderate',
  confidence text DEFAULT 'medium',
  generated_at timestamptz DEFAULT now()
);

ALTER TABLE wallet_metric_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read wallet metrics"
  ON wallet_metric_snapshots FOR SELECT
  TO authenticated
  USING (true);

-- Wallet token PNL
CREATE TABLE IF NOT EXISTS wallet_token_pnl (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text REFERENCES wallets(address),
  token_address text NOT NULL,
  time_window text NOT NULL DEFAULT '7d',
  realized_pnl_usd numeric DEFAULT 0,
  unrealized_pnl_usd numeric DEFAULT 0,
  roi_percent numeric DEFAULT 0,
  buy_count integer DEFAULT 0,
  sell_count integer DEFAULT 0,
  volume_usd numeric DEFAULT 0,
  last_activity_at timestamptz,
  generated_at timestamptz DEFAULT now()
);

ALTER TABLE wallet_token_pnl ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read wallet token PNL"
  ON wallet_token_pnl FOR SELECT
  TO authenticated
  USING (true);

-- Wallet holdings
CREATE TABLE IF NOT EXISTS wallet_holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text REFERENCES wallets(address),
  token_address text NOT NULL,
  balance numeric DEFAULT 0,
  value_usd numeric DEFAULT 0,
  portfolio_weight numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE wallet_holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read wallet holdings"
  ON wallet_holdings FOR SELECT
  TO authenticated
  USING (true);

-- Tokens metadata
CREATE TABLE IF NOT EXISTS tokens (
  address text PRIMARY KEY,
  symbol text DEFAULT '',
  name text DEFAULT '',
  logo_uri text DEFAULT '',
  decimals integer DEFAULT 0,
  chain text DEFAULT 'solana',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tokens"
  ON tokens FOR SELECT
  TO authenticated
  USING (true);

-- Leaderboard snapshots
CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_window text NOT NULL DEFAULT '7d',
  generated_at timestamptz DEFAULT now(),
  wallet_count integer DEFAULT 0
);

ALTER TABLE leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read leaderboard snapshots"
  ON leaderboard_snapshots FOR SELECT
  TO authenticated
  USING (true);

-- Leaderboard entries
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid REFERENCES leaderboard_snapshots(id) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  rank integer NOT NULL,
  pnl_usd numeric DEFAULT 0,
  roi_percent numeric DEFAULT 0,
  alpha_score integer DEFAULT 0,
  confidence text DEFAULT 'medium',
  archetype text DEFAULT 'Moderate',
  wallet_age_days integer,
  win_rate numeric DEFAULT 0,
  trade_count integer DEFAULT 0,
  volume_usd numeric DEFAULT 0
);

ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read leaderboard entries"
  ON leaderboard_entries FOR SELECT
  TO authenticated
  USING (true);

-- Token signal snapshots
CREATE TABLE IF NOT EXISTS token_signal_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address text NOT NULL,
  signal_score integer DEFAULT 0,
  signal_label text DEFAULT '',
  smart_wallet_count integer DEFAULT 0,
  average_alpha_score numeric DEFAULT 0,
  combined_wallet_pnl numeric DEFAULT 0,
  liquidity_usd numeric DEFAULT 0,
  volume_24h numeric DEFAULT 0,
  security_status text DEFAULT 'unknown',
  generated_at timestamptz DEFAULT now()
);

ALTER TABLE token_signal_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read token signal snapshots"
  ON token_signal_snapshots FOR SELECT
  TO authenticated
  USING (true);

-- Token signal participants
CREATE TABLE IF NOT EXISTS token_signal_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_snapshot_id uuid REFERENCES token_signal_snapshots(id) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  wallet_alpha_score integer DEFAULT 0,
  wallet_pnl_usd numeric DEFAULT 0,
  holding_value_usd numeric DEFAULT 0,
  portfolio_weight numeric DEFAULT 0,
  reason text DEFAULT 'holding'
);

ALTER TABLE token_signal_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read token signal participants"
  ON token_signal_participants FOR SELECT
  TO authenticated
  USING (true);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_wallet_metric_snapshots_wallet ON wallet_metric_snapshots(wallet_address, time_window);
CREATE INDEX IF NOT EXISTS idx_wallet_token_pnl_wallet ON wallet_token_pnl(wallet_address, time_window);
CREATE INDEX IF NOT EXISTS idx_wallet_holdings_wallet ON wallet_holdings(wallet_address);
CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_window ON leaderboard_snapshots(time_window, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_snapshot ON leaderboard_entries(snapshot_id, rank);
CREATE INDEX IF NOT EXISTS idx_token_signal_snapshots_token ON token_signal_snapshots(token_address, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_signal_participants_signal ON token_signal_participants(signal_snapshot_id);
