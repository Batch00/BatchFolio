'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import NetWorthWidget from '@/components/dashboard/NetWorthWidget'
import TrendChart from '@/components/dashboard/TrendChart'
import AllocationWidget from '@/components/dashboard/AllocationWidget'
import HoldingsWidget from '@/components/dashboard/HoldingsWidget'
import MoversWidget from '@/components/dashboard/MoversWidget'
import WatchlistWidget from '@/components/dashboard/WatchlistWidget'

const fmtLarge = (v) =>
  v == null
    ? '--'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)

export default function OverviewTab({ onOpenDrawer, onDataLoaded }) {
  const supabase = createClient()
  const [snapshots, setSnapshots] = useState([])
  const [holdings, setHoldings] = useState([])
  const [prices, setPrices] = useState({})
  const [sparklines, setSparklines] = useState({})
  const [wlFundamentals, setWlFundamentals] = useState({})
  const [watchlist, setWatchlist] = useState([])
  const [liveLiabilities, setLiveLiabilities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [range, setRange] = useState('today')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [snapshotsRes, holdingsRes, watchlistRes, liabRes] = await Promise.all([
      supabase.from('net_worth_snapshots').select('*').order('date', { ascending: true }),
      supabase.from('holdings').select('*'),
      supabase.from('watchlist').select('*').order('added_at', { ascending: false }),
      supabase.from('liabilities').select('balance'),
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
    setLiveLiabilities(liabRes.data ?? [])
    setLoading(false)

    // Update top bar net worth using live liabilities total
    const latestSnap = (snapshotsRes.data ?? []).slice(-1)[0]
    const liveLiabTotal = (liabRes.data ?? []).reduce((sum, l) => sum + l.balance, 0)
    const topBarNetWorth = latestSnap != null ? (latestSnap.total_assets - liveLiabTotal) : null
    const dayChange = allHoldings.reduce(
      (sum, h) => sum + h.shares * (priceMap[h.ticker]?.change ?? 0),
      0,
    )
    onDataLoaded?.({
      value: topBarNetWorth,
      change: dayChange,
      changePositive: dayChange >= 0,
      liveLiabilitiesTotal: liveLiabTotal,
    })

    // Fetch sparklines and watchlist fundamentals in background
    const bgFetches = []

    if (holdingTickers.length > 0) {
      bgFetches.push(
        Promise.all(
          holdingTickers.map((t) =>
            fetch(`/api/stock/sparkline?ticker=${t}`)
              .then((r) => r.json())
              .then((d) => ({ t, prices: d.prices ?? [] }))
              .catch(() => ({ t, prices: [] })),
          ),
        ).then((results) => {
          const map = {}
          results.forEach(({ t, prices }) => {
            map[t] = prices
          })
          setSparklines(map)
        }),
      )
    }

    if (wlTickers.length > 0) {
      bgFetches.push(
        Promise.all(
          wlTickers.map((t) =>
            fetch(`/api/stock/fundamentals?ticker=${t}`)
              .then((r) => r.json())
              .then((f) => ({ t, f }))
              .catch(() => ({ t, f: null })),
          ),
        ).then((results) => {
          const map = {}
          results.forEach(({ t, f }) => {
            if (f) map[t] = f
          })
          setWlFundamentals(map)
        }),
      )
    }
  }, [onDataLoaded])

  useEffect(() => {
    loadData()
  }, [loadData])

  const latest = snapshots[snapshots.length - 1]
  const totalAssets = latest?.total_assets ?? 0
  const liveLiabilitiesTotal = liveLiabilities.reduce((sum, l) => sum + l.balance, 0)
  const netWorth = latest != null ? totalAssets - liveLiabilitiesTotal : 0

  const dayChange = holdings.reduce(
    (sum, h) => sum + h.shares * (prices[h.ticker]?.change ?? 0),
    0,
  )
  const portfolioValue = holdings.reduce(
    (sum, h) => sum + h.shares * (prices[h.ticker]?.price ?? 0),
    0,
  )

  // Total cost basis (invested)
  const totalInvested = holdings.reduce(
    (sum, h) => sum + h.shares * h.avg_cost_basis,
    0,
  )

  // Calculate change based on selected range
  function getChangeForRange() {
    if (snapshots.length === 0) return { changeDollar: 0, changePct: 0 }
    const latestNw = latest?.net_worth ?? 0

    if (range === 'today') {
      const portfolioYesterday = portfolioValue - dayChange
      const pct = portfolioYesterday > 0 ? (dayChange / portfolioYesterday) * 100 : 0
      return { changeDollar: dayChange, changePct: pct }
    }

    const daysBack = range === '30d' ? 30 : range === '90d' ? 90 : 365
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - daysBack)
    const cutoffStr = cutoff.toISOString().split('T')[0]

    // Find snapshot closest to cutoff date
    let closest = snapshots[0]
    let closestDist = Infinity
    for (const s of snapshots) {
      const dist = Math.abs(new Date(s.date).getTime() - cutoff.getTime())
      if (dist < closestDist) {
        closestDist = dist
        closest = s
      }
    }

    const oldNw = closest?.net_worth ?? 0
    const changeDollar = latestNw - oldNw
    const changePct = oldNw > 0 ? (changeDollar / oldNw) * 100 : 0
    return { changeDollar, changePct }
  }

  const { changeDollar, changePct } = getChangeForRange()
  const changePositive = changeDollar >= 0

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
        costBasis,
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

  const rangeLabel =
    range === 'today' ? 'today' : range === '30d' ? 'past 30 days' : range === '90d' ? 'past 90 days' : 'past year'

  return (
    <div className="px-4 md:px-6 py-4 min-h-[calc(100vh-48px)] flex flex-col gap-4">
      {error && <p className="text-xs text-[#f87171]">{error}</p>}

      {/* Row 1: Hero - Net Worth (40%) + Trend Chart (60%) */}
      <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-4">
        <NetWorthWidget
          loading={loading}
          netWorth={netWorth}
          totalAssets={totalAssets}
          totalLiabilities={liveLiabilitiesTotal}
          totalInvested={totalInvested}
          changeDollar={changeDollar}
          changePct={changePct}
          changePositive={changePositive}
          rangeLabel={rangeLabel}
          range={range}
          onRangeChange={setRange}
        />
        <TrendChart loading={loading} snapshots={snapshots} range={range} />
      </div>

      {/* Row 2: Full width holdings */}
      <HoldingsWidget
        loading={loading}
        holdings={enrichedHoldings}
        sparklines={sparklines}
        onOpenDrawer={onOpenDrawer}
      />

      {/* Row 3: Movers + Watchlist */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MoversWidget
          loading={loading}
          holdings={enrichedHoldings}
          prices={prices}
          onOpenDrawer={onOpenDrawer}
        />
        <WatchlistWidget
          loading={loading}
          watchlist={enrichedWatchlist.slice(0, 5)}
          fundamentals={wlFundamentals}
          onOpenDrawer={onOpenDrawer}
        />
      </div>

      {/* Row 4: Full width allocation */}
      <AllocationWidget loading={loading} holdings={enrichedHoldings} />
    </div>
  )
}
