'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Search } from 'lucide-react'

const fmt = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v ?? 0)

export default function PortfolioPanel({ onOpenDetail }) {
  const supabase = createClient()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data: allHoldings, error: holdErr } = await supabase
      .from('holdings')
      .select('*')

    if (holdErr) { setError(holdErr.message); setLoading(false); return }

    const tickers = [...new Set((allHoldings ?? []).map((h) => h.ticker))]
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

    const enriched = (allHoldings ?? []).map((h) => {
      const livePrice = priceMap[h.ticker]?.price ?? 0
      const value = h.shares * livePrice
      const costBasis = h.shares * h.avg_cost_basis
      const gainLoss = value - costBasis
      const gainPct = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0
      return { ...h, livePrice, value, gainLoss, gainPct, name: priceMap[h.ticker]?.name ?? '' }
    })

    enriched.sort((a, b) => b.value - a.value)
    setRows(enriched)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const totalValue = rows.reduce((s, r) => s + r.value, 0)

  const filtered = search
    ? rows.filter(
        (r) =>
          r.ticker.includes(search.toUpperCase()) ||
          r.name.toLowerCase().includes(search.toLowerCase())
      )
    : rows

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[#21262d] flex-shrink-0">
        <p className="text-xs text-[#7d8590] uppercase tracking-wider mb-1">Portfolio</p>
        {loading ? (
          <Skeleton className="h-6 w-32" />
        ) : (
          <p className="font-mono text-lg font-semibold text-[#e6edf3]">{fmt(totalValue)}</p>
        )}
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-[#21262d] flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#7d8590] pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search holdings..."
            className="pl-8 h-8 text-xs bg-[#161b22] border-[#21262d]"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {error && <p className="p-3 text-xs text-[#f87171]">{error}</p>}
        {loading ? (
          <div className="p-3 space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-sm text-[#7d8590]">
            {search ? 'No matches.' : 'No holdings yet.'}
          </p>
        ) : (
          <div className="divide-y divide-[#21262d]">
            {filtered.map((h) => {
              const positive = h.gainLoss >= 0
              return (
                <button
                  key={h.id}
                  onClick={() => onOpenDetail({ type: 'stock', ticker: h.ticker })}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#161b22] transition-colors text-left"
                >
                  <div className="min-w-0 mr-3">
                    <p className="font-mono text-sm text-[#10b981]">{h.ticker}</p>
                    <p className="text-xs text-[#7d8590] truncate">{h.name || h.ticker}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-mono text-sm text-[#e6edf3]">{fmt(h.value)}</p>
                    <p className={`font-mono text-xs ${positive ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                      {positive ? '+' : ''}{h.gainPct.toFixed(2)}%
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
