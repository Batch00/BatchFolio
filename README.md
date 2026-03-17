# BatchFolio

**Investment portfolio tracker that aggregates brokerage accounts, tracks holdings at live prices, and visualizes net worth over time.**

[![Live App](https://img.shields.io/badge/Live_App-batchfolio.batch--apps.com-10b981?style=flat-square&logo=vercel&logoColor=white)](https://batchfolio.batch-apps.com)
[![Batch Apps](https://img.shields.io/badge/Part_of-Batch_Apps-7d8590?style=flat-square)](https://batch-apps.com)

---

## Overview

BatchFolio is a personal finance tool for investors who want a single view across multiple brokerage and retirement accounts. It fetches live stock quotes server-side, computes unrealized gain/loss per holding, and tracks net worth over time via manual snapshots.

- **Account and holdings management** - add brokerage and retirement accounts, enter holdings with share count and cost basis
- **Live pricing** - current prices, daily change, and gain/loss pulled from Finnhub on every page load
- **Portfolio view** - total value, allocation donut chart by account, and a sortable full holdings table
- **Watchlist** - track any ticker with live quote and 52-week range data
- **Stock detail** - price chart (30d / 90d / 1y), fundamentals grid (P/E, EPS, market cap, beta, dividend yield)
- **Net worth trend** - manual snapshot entry with an area chart showing balance over time

---

## Tech Stack

| Technology | Purpose |
|---|---|
| Next.js 15 (App Router) | Framework, routing, server components |
| Tailwind CSS | Utility-first styling |
| shadcn/ui | Accessible UI primitives (dialog, table, accordion, etc.) |
| Supabase | Authentication and PostgreSQL database with RLS |
| Recharts | Area charts and donut chart |
| Finnhub API | Real-time stock quotes and fundamentals |
| Vercel | Hosting and CI/CD |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Finnhub](https://finnhub.io) API key (free tier works)

### Install

```bash
git clone https://github.com/Batch00/batchfolio
cd batchfolio
npm install
```

### Environment variables

Create a `.env.local` file in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
FINNHUB_API_KEY=
```

See the [Environment Variables](#environment-variables) section below for where to find each value.

### Database setup

Run the schema against your Supabase project using the Supabase CLI or the SQL editor in the dashboard:

```bash
# Using the Supabase CLI
supabase db push --db-url your-db-url < supabase/schema.sql
```

Or paste the contents of `supabase/schema.sql` directly into the **SQL Editor** in your Supabase project dashboard.

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Unauthenticated requests redirect to `/login`.

---

## Environment Variables

| Variable | Description | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | Supabase dashboard > Project Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key | Supabase dashboard > Project Settings > API |
| `FINNHUB_API_KEY` | Finnhub REST API key | [finnhub.io/dashboard](https://finnhub.io/dashboard) |

`FINNHUB_API_KEY` is server-side only and is never sent to the browser.

---

## Project Structure

```
app/
  (auth)/
    login/page.jsx          # Sign in
    signup/page.jsx         # Create account
  (dashboard)/
    layout.jsx              # Sidebar + BottomNav wrapper, dynamic rendering
    page.jsx                # Dashboard: stat cards, net worth chart, recent accounts
    accounts/page.jsx       # Account list with holdings accordion
    portfolio/page.jsx      # Allocation chart + full holdings table
    watchlist/page.jsx      # Watchlist table with live quotes
    stock/[ticker]/page.jsx # Stock detail: chart, fundamentals grid
  api/
    stock/
      quote/route.js        # GET /api/stock/quote?ticker=
      fundamentals/route.js # GET /api/stock/fundamentals?ticker=
      chart/route.js        # GET /api/stock/chart?ticker=&range=30d
  globals.css
  layout.jsx                # Root layout, Inter font
components/
  ui/                       # shadcn/ui primitives (button, dialog, table, etc.)
  Sidebar.jsx               # Desktop fixed left nav (240px)
  BottomNav.jsx             # Mobile fixed bottom nav
  StatCard.jsx              # Metric card with monospace value
  NetWorthChart.jsx         # Recharts AreaChart for net worth snapshots
  AllocationChart.jsx       # Recharts PieChart donut by account
  StockPriceChart.jsx       # Recharts AreaChart for daily candles
lib/
  supabase.js               # Browser Supabase client (createBrowserClient)
  supabase-server.js        # Server Supabase client (createServerClient + cookies)
  finnhub.js                # Finnhub fetch helper (server-side only)
  utils.js                  # cn() utility (clsx + tailwind-merge)
middleware.js               # Auth redirect: unauthenticated -> /login
supabase/
  schema.sql                # Full schema with RLS policies
```

---

## Database Schema

| Table | Description |
|---|---|
| `accounts` | Brokerage and retirement accounts belonging to a user. Type is `brokerage` or `retirement`. |
| `holdings` | Individual stock positions within an account. Stores ticker, share count, and average cost basis. Cascade-deletes with the parent account. |
| `liabilities` | Debts and loans (credit cards, mortgages, etc.) with balance and interest rate. |
| `net_worth_snapshots` | Manual point-in-time records of total assets, total liabilities, and computed net worth. Used for the trend chart. |
| `watchlist` | Tickers a user wants to monitor. Unique constraint on `(user_id, ticker)`. |

RLS is enabled on all tables. Every policy restricts reads and writes to `auth.uid() = user_id`. For `holdings`, the policy joins to `accounts` to verify ownership since holdings do not have a direct `user_id` column.

---

## Key Design Decisions

- **Finnhub is called server-side only.** All stock data goes through `/api/stock/*` route handlers. The API key is never exposed to the client, and response caching (`next: { revalidate: 60 }`) reduces redundant Finnhub requests.

- **Supabase RLS instead of application-level filtering.** Row-level security policies run in the database, so a misconfigured query cannot accidentally leak another user's data. Application code does not need to append `user_id` filters manually.

- **Slate/emerald design system, distinct from BatchFlow.** BatchFolio uses a data-terminal aesthetic (`#0d1117` background, `#10b981` emerald accent, monospace for all numeric values) rather than the card-grid layout and purple accent used in BatchFlow. The two apps are intentionally visually distinct despite sharing the Batch Apps umbrella.

---

## Deployment

BatchFolio is hosted on Vercel and auto-deploys on every push to `main`.

Before deploying, add the following to your Vercel project's **Environment Variables** settings:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
FINNHUB_API_KEY
```

Live URL: [batchfolio.batch-apps.com](https://batchfolio.batch-apps.com)

---

## Part of Batch Apps

BatchFolio is one app in the [Batch Apps](https://batch-apps.com) suite of personal finance and productivity tools.

**Related apps:**
- [BatchFlow](https://batchflow.batch-apps.com) - budget and cash flow tracker
