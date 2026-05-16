# AlphaTrace

Solana trader PNL leaderboard + smart-money movement intelligence powered by Birdeye.

**Which Solana wallets are actually profitable, and what are those wallets doing now?**

## Features

- **Trader Leaderboard** - Ranked wallets by Alpha Score (PNL, ROI, consistency, wallet age)
- **Wallet Profile** - Deep dive into any wallet: PNL breakdown, holdings, net worth chart, archetype
- **Smart Money Feed** - Tokens with attention from profitable wallets, with auditable participants
- **Wallet Search** - Analyze any Solana wallet and get a shareable trader card

## Architecture

```
Frontend (Next.js/React)
  -> API Routes
    -> Application Services (Leaderboard, WalletProfile, SmartMoneyFeed)
      -> Birdeye Client + Supabase Cache
        -> Birdeye API
```

## Birdeye Endpoints Used

- `/trader/gainers-losers` - Candidate wallet discovery
- `/wallet/v2/pnl/summary` - Wallet PNL summary
- `/wallet/v2/pnl/details` - Token-level PNL
- `/wallet/v2/net-worth` - Net worth history
- `/v1/wallet/token_list` - Current holdings
- `/wallet/v2/tx/first-funded` - Wallet age
- `/defi/v3/token/meta-data/multiple` - Token metadata
- `/defi/v3/token/market-data` - Token market data
- `/defi/token_security` - Token security checks

## Scoring Model

### Alpha Score (0-100)
- Realized PNL: 25%
- ROI: 20%
- Win Rate: 15%
- Consistency: 15%
- Wallet Age: 10%
- Recency: 10%
- Risk Penalty: -5%

### Token Signal Score (0-100)
- Smart Wallet Count: 25%
- Average Alpha Score: 20%
- Combined Wallet PNL: 20%
- Portfolio Exposure: 10%
- Liquidity: 10%
- Security: 10%
- Freshness: 5%

## Setup

1. Copy `.env.example` to `.env` and fill in your Birdeye API key
2. `npm install`
3. `npm run dev`

## Environment

- `SUPABASE_SERVICE_ROLE_KEY` is recommended for server routes so leaderboard and signal snapshots can be cached without RLS failures.
- `BIRDEYE_REQUESTS_PER_SECOND` controls the Birdeye client throttle. The default is `3` requests per second.

## API Routes

| Route | Description |
|-------|-------------|
| `GET /api/leaderboard?window=7d&limit=50` | Trader leaderboard |
| `GET /api/wallets/:address/profile?window=7d` | Wallet profile |
| `GET /api/wallets/:address/analyze?window=30d` | Wallet analysis + trader card |
| `GET /api/smart-money/feed?window=7d&limit=30` | Smart money token signals |
| `GET /api/health` | Health check |
| `GET /api/debug/wallet-pnl?wallet=X&window=7d` | Debug PNL data |
| `POST /api/admin/refresh-leaderboard` | Refresh leaderboard snapshot |
| `POST /api/admin/refresh-smart-money` | Refresh smart money feed |

## Limitations

- AlphaTrace is an analytics product, not financial advice
- Scores are deterministic but depend on data availability
- Smart money signals indicate wallet attention, not price predictions
- Data freshness depends on Birdeye API and refresh schedule
