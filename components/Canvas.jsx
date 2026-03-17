'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import NetWorthChart from '@/components/NetWorthChart'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const fmt = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v ?? 0)

const fmtCompact = (v) => {
  if (v == null) return '--'
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`
  return fmt(v)
}

function Sparkline({ data, positive }) {
  if (!data || data.length < 2) return <div className="w-[60px] h-[24px]" />
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const W = 60
  const H = 24
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * W
      const y = H - ((v - min) / range) * (H - 2) - 1
      return `${x},${y}`
    })
    .join(' ')
  return (
    <svg width={W} height={H} className="overflow-visible flex-shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={positive ? '#34d399' : '#f87171'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function Canvas({ onOpenDetail }) {
  const supabase = createClient()
  const [snapshots, setSnapshots] = useState([])
  const [holdings, setHoldings] = useState([])
  const [prices, setPrices] = useState({})
  const [sparklines, setSparklines] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Snapshot dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [assets, setAssets] = useState('')
  const [liabilities, setLiabilities] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [snapshotsRes, holdingsRes] = await Promise.all([
      supabase.from('net_worth_snapshots').select('*').order('date', { ascending: true }),
      supabase.from('holdings').select('*'),
    ])

    if (snapshotsRes.error) { setError(snapshotsRes.error.message); setLoading(false); return }

    const allHoldings = holdingsRes.data ?? []
    const tickers = [...new Set(allHoldings.map((h) => h.ticker))]

    const priceResults = await Promise.all(
      tickers.map((t) =>
        fetch(`/api/stock/quote?ticker=${t}`)
          .then((r) => r.json())
          .then((q) => ({ t, q }))
          .catch(() => ({ t, q: null }))
      )
    )
    const priceMap = {}
    priceResults.forEach(({ t, q }) => { if (q) priceMap[t] = q })

    setSnapshots(snapshotsRes.data ?? [])
    setHoldings(allHoldings)
    setPrices(priceMap)
    setLoading(false)

    // Fetch sparklines in the background
    if (tickers.length > 0) {
      Promise.all(
        tickers.map((t) =>
          fetch(`/api/stock/chart?ticker=${t}&range=30d`)
            .then((r) => r.json())
            .then((d) => ({ t, closes: (d.candles ?? []).slice(-7).map((c) => c.close) }))
            .catch(() => ({ t, closes: [] }))
        )
      ).then((results) => {
        const map = {}
        results.forEach(({ t, closes }) => { map[t] = closes })
        setSparklines(map)
      })
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const latest = snapshots[snapshots.length - 1]
  const totalAssets = latest?.total_assets ?? 0
  const totalLiabilities = latest?.total_liabilities ?? 0
  const netWorth = latest?.net_worth ?? 0

  const dayChange = holdings.reduce(
    (sum, h) => sum + h.shares * (prices[h.ticker]?.change ?? 0),
    0
  )
  const portfolioValue = holdings.reduce(
    (sum, h) => sum + h.shares * (prices[h.ticker]?.price ?? 0),
    0
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
      return { ...h, livePrice, value, gainLoss, gainPct, positive: gainLoss >= 0 }
    })
    .sort((a, b) => b.value - a.value)

  const computedNetWorth =
    assets && liabilities
      ? (parseFloat(assets || 0) - parseFloat(liabilities || 0)).toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
        })
      : null

  async function handleAddSnapshot(e) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    const { data: { user } } = await supabase.auth.getUser()
    const assetsVal = parseFloat(assets)
    const liabVal = parseFloat(liabilities)
    const { error: err } = await supabase.from('net_worth_snapshots').insert({
      user_id: user.id,
      date: new Date().toISOString().split('T')[0],
      total_assets: assetsVal,
      total_liabilities: liabVal,
      net_worth: assetsVal - liabVal,
    })
    if (err) {
      setSaveError(err.message)
    } else {
      setDialogOpen(false)
      setAssets(''); setLiabilities('')
      await loadData()
    }
    setSaving(false)
  }

  return (
    <div className="p-6">
      {error && <p className="text-xs text-[#f87171] mb-4">{error}</p>}

      {/* Net worth header */}
      <div className="mb-6">
        <p className="text-xs text-[#7d8590] uppercase tracking-widest mb-2">Net Worth</p>
        {loading ? (
          <>
            <Skeleton className="h-12 w-52 mb-2" />
            <Skeleton className="h-5 w-36" />
          </>
        ) : (
          <>
            <p className="font-mono text-5xl font-semibold text-[#e6edf3] leading-none">
              {fmt(netWorth)}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`font-mono text-sm ${dayPositive ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                {dayPositive ? '+' : ''}{fmt(dayChange)}
              </span>
              <span className={`font-mono text-sm ${dayPositive ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                ({dayPositive ? '+' : ''}{dayChangePct.toFixed(2)}%)
              </span>
              <span className="text-xs text-[#7d8590]">today</span>
              <button
                onClick={() => setDialogOpen(true)}
                className="ml-auto text-xs text-[#7d8590] hover:text-[#10b981] transition-colors"
              >
                + Snapshot
              </button>
            </div>
          </>
        )}
      </div>

      {/* Stat chips */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {loading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)
        ) : (
          <>
            <div className="bg-[#161b22] border border-[#21262d] rounded-md px-3 py-2.5">
              <p className="text-xs text-[#7d8590] mb-1">Total Assets</p>
              <p className="font-mono text-sm text-[#e6edf3]">{fmtCompact(totalAssets)}</p>
            </div>
            <div className="bg-[#161b22] border border-[#21262d] rounded-md px-3 py-2.5">
              <p className="text-xs text-[#7d8590] mb-1">Liabilities</p>
              <p className="font-mono text-sm text-[#f87171]">{fmtCompact(totalLiabilities)}</p>
            </div>
            <div className="bg-[#161b22] border border-[#21262d] rounded-md px-3 py-2.5">
              <p className="text-xs text-[#7d8590] mb-1">Day Change</p>
              <p className={`font-mono text-sm ${dayPositive ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                {dayPositive ? '+' : ''}{fmtCompact(dayChange)}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Net worth chart */}
      <div className="bg-[#161b22] border border-[#21262d] rounded-md p-4 mb-6">
        <p className="text-xs text-[#7d8590] uppercase tracking-wider mb-4">Net Worth Over Time</p>
        {loading ? <Skeleton className="h-48" /> : <NetWorthChart data={snapshots} />}
      </div>

      {/* Holdings grid */}
      <div>
        <p className="text-xs text-[#7d8590] uppercase tracking-wider mb-3">Holdings</p>
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : enrichedHoldings.length === 0 ? (
          <p className="text-sm text-[#7d8590]">
            No holdings yet. Add accounts and holdings to get started.
          </p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {enrichedHoldings.map((h) => (
              <button
                key={h.id}
                onClick={() => onOpenDetail({ type: 'stock', ticker: h.ticker })}
                className="bg-[#161b22] border border-[#21262d] rounded-md p-3 text-left hover:border-[#10b981]/40 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 mr-2">
                    <p className="font-mono text-sm text-[#10b981]">{h.ticker}</p>
                    <p className="font-mono text-sm text-[#e6edf3]">{fmt(h.livePrice)}</p>
                  </div>
                  <Sparkline data={sparklines[h.ticker]} positive={h.positive} />
                </div>
                <p className={`font-mono text-xs ${h.positive ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                  {h.positive ? '+' : ''}{h.gainPct.toFixed(2)}%
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Add Snapshot Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Net Worth Snapshot</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddSnapshot} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Total Assets</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={assets}
                onChange={(e) => setAssets(e.target.value)}
                placeholder="0.00"
                className="font-mono"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Total Liabilities</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={liabilities}
                onChange={(e) => setLiabilities(e.target.value)}
                placeholder="0.00"
                className="font-mono"
                required
              />
            </div>
            {computedNetWorth && (
              <p className="text-xs text-[#7d8590]">
                Net Worth: <span className="font-mono text-[#e6edf3]">{computedNetWorth}</span>
              </p>
            )}
            {saveError && <p className="text-sm text-[#f87171]">{saveError}</p>}
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? 'Saving...' : 'Save Snapshot'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
