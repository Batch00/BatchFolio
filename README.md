# BatchFolio

**Investment portfolio tracker and net worth dashboard with automatic bank sync via SimpleFIN.**

[![Live App](https://img.shields.io/badge/Live_App-batchfolio.batch--apps.com-10b981?style=flat-square&logo=vercel&logoColor=white)](https://batchfolio.batch-apps.com)
[![Batch Apps](https://img.shields.io/badge/Part_of-Batch_Apps-7d8590?style=flat-square)](https://batch-apps.com)
[![Invite Only](https://img.shields.io/badge/Access-Invite_Only-21262d?style=flat-square)](#getting-started)

---

## Overview

BatchFolio connects to 16,000+ financial institutions via SimpleFIN Bridge and automatically syncs account balances, investment holdings, and transaction history every night. It supports manual accounts alongside synced ones and tracks net worth over time with a nightly auto-snapshot via Supabase Edge Function.

The app uses a data-terminal aesthetic -- dark slate background (`#0d1117`) with emerald accents -- and is intentionally distinct from BatchFlow, the companion budgeting app.

---

## Features

### Bank Sync (SimpleFIN Bridge)
- Connect any of 16,000+ financial institutions using a SimpleFIN Setup Token
- Automatic nightly sync of account balances, investment holdings, and transactions
- Credit cards auto-detected and routed to the liabilities section
- Mutual funds display NAV from SimpleFIN -- no Finnhub fallback needed

### Dashboard (Overview Tab)
- Net worth widget with assets, liabilities, and time-range change (today / 30d / 90d / 1y)
- Trend chart showing net worth history from snapshots
- Holdings table with sparklines (top 8 by value)
- Allocation donut chart by ticker or asset class
- Top movers -- holdings with live daily change from Finnhub
- Watchlist preview with live prices

### Portfolio Tab
- Sortable full holdings table (ticker, shares, price, value, return)
- Allocation view with account filter pills
- Account summary panel

### Accounts Tab
- Synced accounts (SimpleFIN) and manual accounts in one view
- Drag-to-reorder, inline name editing, exclude/hide toggle
- Per-account holdings table with add/edit/delete

### Transactions Tab
- Full transaction history from synced accounts and credit cards
- Category auto-detection
- Filters by account, credit card, and date range
- Spending summary panel

### Liabilities
- Manual liability entry (loans, mortgages, etc.)
- Credit cards auto-imported from SimpleFIN sync

### Watchlist
- Live quotes with daily change
- 52-week range bars
- Fundamentals on hover

### Stock Drawer
- Opens from any ticker click across all tabs
- Price chart (30d / 90d / 1y) via Polygon.io
- Key stats grid (market cap, P/E, EPS, 52w high/low, dividend, beta)
- Recent news via Finnhub
- Your position summary (shares, avg cost, total value, gain/loss)
- Synced mutual funds show SimpleFIN NAV data instead of Finnhub

### Other
- Nightly net worth snapshot via Edge Function (runs 6AM UTC)
- Invite-only access with admin invite management
- Demo mode with pre-loaded read-only data (resets nightly)
- Installable PWA for mobile
- Mobile responsive with bottom navigation

---

## Tech Stack

| Technology | Purpose |
|---|---|
| Next.js 15 (App Router) | Framework, routing, server components |
| Tailwind CSS | Utility-first styling |
| shadcn/ui | UI primitives (dialog, table, accordion, select, etc.) |
| Supabase | Auth, PostgreSQL, Edge Functions, RLS |
| Recharts | Area charts, donut chart, sparklines |
| Finnhub API | Live quotes, fundamentals, news (server-side only) |
| Polygon.io | Historical price charts, sparklines (server-side only) |
| SimpleFIN Bridge | Bank and investment account sync |
| @dnd-kit/core + @dnd-kit/sortable | Drag-to-reorder accounts |
| Vercel | Hosting, CI/CD |

---

## Environment Variables

| Variable | Where to get it | Client-side? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard > Project Settings > API | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard > Project Settings > API | Yes |
| `FINNHUB_API_KEY` | [finnhub.io/dashboard](https://finnhub.io/dashboard) | No |
| `POLYGON_API_KEY` | [polygon.io/dashboard](https://polygon.io/dashboard/keys) | No |
| `SERVICE_ROLE_KEY` | Supabase dashboard > Project Settings > API | No |
| `NEXT_PUBLIC_ADMIN_EMAIL` | Your admin email address | Yes |
| `DEMO_USER_ID` | Supabase auth.users UUID for the demo account | No |

`FINNHUB_API_KEY`, `POLYGON_API_KEY`, and `SERVICE_ROLE_KEY` are server-side only and are never exposed to the browser.

---

## Getting Started

> BatchFolio is invite-only in production. The admin must insert a row into the `invites` table before new users can sign up.

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Finnhub](https://finnhub.io) API key (free tier works)
- A [Polygon.io](https://polygon.io) API key (free tier works)

### Install

```bash
git clone https://github.com/Batch00/batchfolio
cd batchfolio
npm install
```

### Configure

Create `.env.local` in the project root with all variables listed above.

### Database setup

Run the schema SQL in the Supabase SQL editor. The schema file is at `supabase/schema.sql`. It creates all tables, RLS policies, and required indexes inside the `batchfolio` schema.

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Unauthenticated requests redirect to `/login`.

---

## Database Schema

All tables live in the `batchfolio` schema. RLS is enabled on every table.

| Table | Key columns |
|---|---|
| `accounts` | `user_id`, `name`, `type`, `provider`, `is_synced`, `is_excluded`, `is_hidden`, `sort_order`, `balance`, `simplefin_id`, `provider_url` |
| `holdings` | `account_id`, `ticker`, `shares`, `avg_cost_basis`, `is_synced`, `last_synced_price`, `description`, `cost_basis_total`, `simplefin_id` |
| `liabilities` | `user_id`, `name`, `type`, `balance`, `interest_rate`, `is_synced`, `simplefin_id` |
| `net_worth_snapshots` | `user_id`, `date`, `total_assets`, `total_liabilities`, `net_worth` |
| `watchlist` | `user_id`, `ticker`, `added_at` -- unique on `(user_id, ticker)` |
| `transactions` | `account_id`, `user_id`, `simplefin_id`, `amount`, `description`, `posted_at`, `tx_type`, `category`, `liability_id` |
| `simplefin_connections` | `user_id`, `access_url`, `last_synced_at` |

RLS policies restrict all reads and writes to `auth.uid() = user_id`. Holdings join to `accounts` to verify ownership since they do not have a direct `user_id` column.

---

## SimpleFIN Integration

SimpleFIN Bridge is a privacy-focused financial data aggregator. It costs $15/year and connects to most US financial institutions.

**Setup flow:**

1. User signs up at [beta-bridge.simplefin.org](https://beta-bridge.simplefin.org)
2. Connects their financial institutions inside SimpleFIN
3. Generates a one-time Setup Token
4. Pastes the token into BatchFolio under Settings > Bank Sync
5. BatchFolio exchanges the token for a persistent Access URL and stores it server-side
6. The nightly Edge Function syncs accounts, balances, holdings, and 90 days of transactions
7. Credit card accounts are auto-detected and moved to Liabilities

The Access URL is never exposed to the client. All SimpleFIN requests go through the server-side `/api/simplefin/sync` route using `SERVICE_ROLE_KEY`.

---

## Edge Functions

### nightly-snapshot

Runs at 6AM UTC (midnight CST) via pg_cron.

1. Syncs SimpleFIN for all connected users
2. Fetches live prices from Finnhub for manual holdings
3. Calculates net worth = synced account balances + manual holdings value - liabilities
4. Upserts a `net_worth_snapshots` row for each user
5. Skips the demo user

| | |
|---|---|
| **Schedule** | `0 6 * * *` (6AM UTC) |
| **Required secrets** | `FINNHUB_API_KEY`, `APP_SUPABASE_URL`, `SERVICE_ROLE_KEY`, `DEMO_USER_ID` |

### reset-demo

Resets demo user data nightly. Currently unscheduled -- demo writes are blocked at the component level.

### Deploy

```bash
supabase functions deploy nightly-snapshot
```

Set secrets in **Supabase dashboard > Edge Functions > Secrets**:

```
FINNHUB_API_KEY=your_finnhub_key
APP_SUPABASE_URL=https://your-project.supabase.co
SERVICE_ROLE_KEY=your_service_role_key
DEMO_USER_ID=uuid-of-demo-user
```

Schedule `nightly-snapshot` in **Supabase dashboard > Edge Functions > select function > Schedule**: `0 6 * * *`

---

## Key Design Decisions

**All external API calls are server-side only.** Finnhub and Polygon requests go through `/api/stock/*` route handlers. API keys are never sent to the browser.

**Synced vs manual accounts use different price sources.** Synced accounts (SimpleFIN) use the account balance directly as the source of truth. Manual accounts compute value from live Finnhub prices. Synced mutual funds use SimpleFIN NAV data and skip Finnhub entirely.

**Supabase RLS as primary data isolation.** Row-level security policies enforce user scoping at the database layer. Application code does not rely on appending `user_id` filters as the primary guard.

**Demo mode is enforced at the component level.** The demo account (`demo@batchfolio.app`) is identified by email. All write operations (add account, add holding, sync, etc.) check `isDemo` and block the action with an inline notice.

**Invite-only access.** The signup flow checks for a matching row in the `invites` table before creating an account. Invites are managed by the admin via a dedicated page.

---

## Deployment

BatchFolio auto-deploys to Vercel on every push to `main`.

**Required Vercel environment variables:**

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
FINNHUB_API_KEY
POLYGON_API_KEY
SERVICE_ROLE_KEY
NEXT_PUBLIC_ADMIN_EMAIL
DEMO_USER_ID
```

Live URL: [batchfolio.batch-apps.com](https://batchfolio.batch-apps.com)

---

## Part of Batch Apps

BatchFolio is one app in the [Batch Apps](https://batch-apps.com) suite of personal finance and productivity tools.

**Related apps:**
- [BatchFlow](https://batchflow.batch-apps.com) - budget and cash flow tracker
