'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import NetWorthWidget from '@/components/dashboard/NetWorthWidget'
import TrendChart from '@/components/dashboard/TrendChart'
import AllocationWidget from '@/components/dashboard/AllocationWidget'
import HoldingsWidget from '@/components/dashboard/HoldingsWidget'
import MoversWidget from '@/components/dashboard/MoversWidget'
import WatchlistWidget from '@/components/dashboard/WatchlistWidget'

export default function OverviewTab({ onOpenDrawer, onDataLoaded }) {
  const supabase = createClient()
  const [snapshots, setSnapshots] = useState([])
  const [holdings, setHoldings] = useState([])
  const [prices, setPrices] = useState({})
  const [sparklines, setSparklines] = useState({})
  const [watchlist, setWatchlist] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [snapshotsRes, holdingsRes, watchlistRes] = await Promise.all([
      supabase.from('net_worth_snapshots').select('*').order('date', { ascending: true }),
      supabase.from('holdings').select('*'),
      supabase.from('watchlist').select('*').order('added_at', { ascending: false }),
    ])

    if (snapshotsRes.error) {
      setError(snapshotsRes.error.message)
      setLoading(false)
      return
    }

    const allHoldings = holdingsRes.data ?? []
    const holdingTickers = [...new Set(allHoldings.map((h) => h.ticker))]
    const wlItems = watchlistRes.data ?? []
    const wlTickers = wlItems.map((w) => w.ticker)
    const allTickers = [...new Set([...holdingTickers, ...wlTickers])]

    const priceResults = await Promise.all(
      allTickers.map((t) =>
        fetch(`/api/stock/quote?ticker=${t}`)
          .then((r) => r.json())
          .then((q) => ({ t, q }))
          .catch(() => ({ t, q: null })),
      ),
    )
    const priceMap = {}
    priceResults.forEach(({ t, q }) => {
      if (q) priceMap[t] = q
    })

    setSnapshots(snapshotsRes.data ?? [])
    setHoldings(allHoldings)
    setPrices(priceMap)
    setWatchlist(wlItems)
    setLoading(false)

    // Update top bar net worth
    const latest = (snapshotsRes.data ?? []).slice(-1)[0]
    const netWorth = latest?.net_worth ?? null
    const dayChange = allHoldings.reduce(
      (sum, h) => sum + h.shares * (priceMap[h.ticker]?.change ?? 0),
      0,
    )
    onDataLoaded?.({ value: netWorth, change: dayChange, changePositive: dayChange >= 0 })

    // Fetch sparklines in background
    if (holdingTickers.length > 0) {
      Promise.all(
        holdingTickers.map((t) =>
          fetch(`/api/stock/chart?ticker=${t}&range=30d`)
            .then((r) => r.json())
            .then((d) => ({ t, closes: (d.candles ?? []).slice(-7).map((c) => c.close) }))
            .catch(() => ({ t, closes: [] })),
        ),
      ).then((results) => {
        const map = {}
        results.forEach(({ t, closes }) => {
          map[t] = closes
        })
        setSparklines(map)
      })
    }
  }, [onDataLoaded])

  useEffect(() => {
    loadData()
  }, [loadData])

  const latest = snapshots[snapshots.length - 1]
  const totalAssets = latest?.total_assets ?? 0
  const totalLiabilities = latest?.total_liabilities ?? 0
  const netWorth = latest?.net_worth ?? 0

  const dayChange = holdings.reduce(
    (sum, h) => sum + h.shares * (prices[h.ticker]?.change ?? 0),
    0,
  )
  const portfolioValue = holdings.reduce(
    (sum, h) => sum + h.shares * (prices[h.ticker]?.price ?? 0),
    0,
  )
  const portfolioYesterday = portfolioValue - dayChange
  const dayChangePct = portfolioYesterday > 0 ? (dayChange / portfolioYesterday) * 100 : 0
  const dayPositive = dayChange >= 0

  const enrichedHoldings = holdings
    .map((h) => {
      const livePrice = prices[h.ticker]?.price ?? 0
      const value = h.shares * livePrice
      const costBasis = h.shares * h.avg_cost_basis
      const gainLoss = value - costBasis
      const gainPct = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0
      return {
        ...h,
        livePrice,
        value,
        gainLoss,
        gainPct,
        positive: gainLoss >= 0,
        name: prices[h.ticker]?.name ?? '',
      }
    })
    .sort((a, b) => b.value - a.value)

  const enrichedWatchlist = watchlist.map((w) => ({
    ...w,
    quote: prices[w.ticker] ?? null,
  }))

  return (
    <div className="p-4 space-y-4">
      {error && <p className="text-xs text-[#f87171]">{error}</p>}

      {/* Hero row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <NetWorthWidget
          loading={loading}
          netWorth={netWorth}
          totalAssets={totalAssets}
          totalLiabilities={totalLiabilities}
          dayChange={dayChange}
          dayChangePct={dayChangePct}
          dayPositive={dayPositive}
        />
        <TrendChart loading={loading} snapshots={snapshots} />
        <AllocationWidget loading={loading} holdings={enrichedHoldings} />
      </div>

      {/* Bottom widget grid */}
      <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr] gap-4">
        <HoldingsWidget
          loading={loading}
          holdings={enrichedHoldings.slice(0, 8)}
          sparklines={sparklines}
          onOpenDrawer={onOpenDrawer}
        />
        <MoversWidget
          loading={loading}
          holdings={enrichedHoldings}
          prices={prices}
          onOpenDrawer={onOpenDrawer}
        />
        <WatchlistWidget
          loading={loading}
          watchlist={enrichedWatchlist.slice(0, 5)}
          onOpenDrawer={onOpenDrawer}
        />
      </div>
    </div>
  )
}
