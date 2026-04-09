'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Skeleton } from '@/components/ui/skeleton'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { ChevronUp, ChevronDown } from 'lucide-react'
import Sparkline from '@/components/dashboard/Sparkline'

const fmt = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v ?? 0)

const COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ef4444', // red
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
]

const COLS = [
  { key: 'ticker', label: 'Ticker' },
  { key: 'account', label: 'Account' },
  { key: 'shares', label: 'Shares', numeric: true, hideMobile: true },
  { key: 'avgCost', label: 'Avg Cost', numeric: true, hideMobile: true },
  { key: 'livePrice', label: 'Price', numeric: true },
  { key: 'sparkline', label: '7D', numeric: true, noSort: true, hideMobile: true },
  { key: 'value', label: 'Value', numeric: true },
  { key: 'gainLoss', label: 'Gain/Loss $', numeric: true, hideMobile: true },
  { key: 'gainPct', label: 'Gain/Loss %', numeric: true },
]

function SortIcon({ dir }) {
  if (!dir) return <span className="inline-block w-3" />
  return dir === 'asc' ? (
    <ChevronUp className="inline h-3 w-3 ml-0.5" />
  ) : (
    <ChevronDown className="inline h-3 w-3 ml-0.5" />
  )
}

export default function PortfolioTab({ onOpenDrawer }) {
  const supabase = createClient()
  const [rows, setRows] = useState([])
  const [sparklines, setSparklines] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sortKey, setSortKey] = useState('value')
  const [sortDir, setSortDir] = useState('desc')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data: allHoldings, error: holdErr } = await supabase
      .from('holdings')
      .select('*, accounts(name)')

    if (holdErr) {
      setError(holdErr.message)
      setLoading(false)
      return
    }

    const manualHoldings = (allHoldings ?? []).filter((h) => !h.is_synced)
    const syncedHoldings = (allHoldings ?? []).filter((h) => h.is_synced)

    // Build price map directly from last_synced_price — no API call needed
    const syncedPriceMap = {}
    syncedHoldings.forEach((h) => {
      if (h.last_synced_price > 0) syncedPriceMap[h.ticker] = { price: h.last_synced_price }
    })

    // Only call Finnhub for manual holdings and synced holdings with no price
    const tickersNeedingQuotes = [
      ...new Set([
        ...manualHoldings.map((h) => h.ticker),
        ...syncedHoldings
          .filter((h) => !h.last_synced_price || h.last_synced_price <= 0)
          .map((h) => h.ticker),
      ]),
    ].filter((t) => t !== 'CASH')

    const priceResults = await Promise.all(
      tickersNeedingQuotes.map((t) =>
        fetch(`/api/stock/quote?ticker=${t}`)
          .then((r) => r.json())
          .then((q) => ({ t, q }))
          .catch(() => ({ t, q: null })),
      ),
    )
    const liveQuoteMap = {}
    priceResults.forEach(({ t, q }) => {
      if (q) liveQuoteMap[t] = q
    })
    const priceMap = { ...syncedPriceMap, ...liveQuoteMap }

    const enriched = (allHoldings ?? []).map((h) => {
      if (h.ticker === 'CASH') {
        return {
          ...h,
          account: h.accounts?.name ?? '--',
          avgCost: h.avg_cost_basis,
          livePrice: h.avg_cost_basis,
          hasPrice: true,
          value: h.avg_cost_basis,
          gainLoss: 0,
          gainPct: 0,
        }
      }
      const hasPrice = priceMap[h.ticker]?.price != null && priceMap[h.ticker].price > 0
      const livePrice = hasPrice ? priceMap[h.ticker].price : null
      const value = hasPrice ? h.shares * livePrice : null
      const costBasis = h.shares * h.avg_cost_basis
      const gainLoss = value != null ? value - costBasis : null
      const gainPct = value != null && costBasis > 0 ? (gainLoss / costBasis) * 100 : null
      return {
        ...h,
        account: h.accounts?.name ?? '--',
        avgCost: h.avg_cost_basis,
        livePrice,
        hasPrice,
        value: value ?? 0,
        gainLoss,
        gainPct,
      }
    })

    setRows(enriched)
    setLoading(false)

    // Fetch sparklines in background
    if (tickers.length > 0) {
      Promise.all(
        tickers.map((t) =>
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
      })
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey]
    const bv = b[sortKey]
    if (typeof av === 'string') {
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    }
    return sortDir === 'asc' ? av - bv : bv - av
  })

  const totalValue = rows.reduce((s, r) => s + r.value, 0)

  const allocationData = rows
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
    .map((r) => ({
      ticker: r.ticker,
      value: r.value,
      pct: totalValue > 0 ? (r.value / totalValue) * 100 : 0,
    }))

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-baseline gap-3">
        <p className="text-[10px] text-[#7d8590] uppercase font-mono" style={{ letterSpacing: '0.08em' }}>Total Portfolio</p>
        {loading ? (
          <Skeleton className="h-8 w-36 inline-block" />
        ) : (
          <p className="font-mono text-2xl font-semibold text-[#e6edf3]">{fmt(totalValue)}</p>
        )}
      </div>

      {error && <p className="text-xs text-[#f87171]">{error}</p>}

      {/* Allocation donut */}
      {!loading && allocationData.length > 0 && (
        <div className="bg-[#161b22] border border-[#21262d] rounded-md p-4">
          <p className="text-[10px] uppercase tracking-widest text-[#7d8590] font-mono mb-3">
            Allocation
          </p>
          <div className="flex items-center gap-6 flex-wrap">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie
                  data={allocationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={72}
                  paddingAngle={2}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {allocationData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload
                    return (
                      <div className="bg-[#161b22] border border-[#21262d] rounded px-2 py-1">
                        <p className="font-mono text-xs text-[#10b981]">{d.ticker}</p>
                        <p className="font-mono text-xs text-[#e6edf3]">{d.pct.toFixed(1)}%</p>
                      </div>
                    )
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              {allocationData.map((d, i) => (
                <div key={d.ticker} className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  <span className="font-mono text-xs text-[#10b981] w-12">{d.ticker}</span>
                  <span className="font-mono text-xs text-[#7d8590]">{d.pct.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Holdings table */}
      <div className="bg-[#161b22] border border-[#21262d] rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#21262d]">
                {COLS.map((col) => (
                  <th
                    key={col.key}
                    onClick={col.noSort ? undefined : () => handleSort(col.key)}
                    className={`px-3 py-2.5 text-[10px] uppercase tracking-wider text-[#7d8590] whitespace-nowrap font-mono ${
                      col.noSort ? '' : 'cursor-pointer hover:text-[#e6edf3] select-none'
                    } ${col.numeric ? 'text-right' : 'text-left'} ${col.hideMobile ? 'hidden md:table-cell' : ''}`}
                  >
                    {col.label}
                    {!col.noSort && <SortIcon dir={sortKey === col.key ? sortDir : null} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-[#21262d]">
                    {COLS.map((col) => (
                      <td key={col.key} className={`px-3 py-2.5 ${col.hideMobile ? 'hidden md:table-cell' : ''}`}>
                        <Skeleton className="h-4 w-16" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={COLS.length} className="px-3 py-8 text-center text-[#7d8590]">
                    No holdings yet.
                  </td>
                </tr>
              ) : (
                <>
                {sorted.map((h) => {
                  const positive = h.gainLoss != null ? h.gainLoss >= 0 : true
                  return (
                    <tr
                      key={h.id}
                      className="border-b border-[#21262d] hover:bg-[#0d1117] transition-colors cursor-pointer"
                      onClick={() => onOpenDrawer(h.ticker)}
                    >
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-[#10b981]">{h.ticker}</span>
                      </td>
                      <td className="px-3 py-2.5 text-[#7d8590] max-w-[140px] truncate">
                        {h.account}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[#e6edf3] text-right hidden md:table-cell">
                        {h.shares}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[#e6edf3] text-right hidden md:table-cell">
                        {fmt(h.avgCost)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[#e6edf3] text-right">
                        {h.hasPrice ? fmt(h.livePrice) : '--'}
                      </td>
                      <td className="px-3 py-2.5 text-right hidden md:table-cell">
                        {sparklines[h.ticker] ? (
                          <div className="inline-flex justify-end">
                            <Sparkline
                              prices={sparklines[h.ticker]}
                              positive={positive}
                              width={60}
                              height={28}
                            />
                          </div>
                        ) : (
                          <div
                            style={{
                              display: 'inline-block',
                              width: 60,
                              height: 28,
                              background: '#21262d',
                              borderRadius: 2,
                            }}
                          />
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[#e6edf3] text-right">
                        {h.hasPrice ? fmt(h.value) : '--'}
                      </td>
                      <td
                        className={`px-3 py-2.5 font-mono text-right hidden md:table-cell ${positive ? 'text-[#34d399]' : 'text-[#f87171]'}`}
                      >
                        {h.gainLoss == null ? '--' : `${positive ? '+' : ''}${fmt(h.gainLoss)}`}
                      </td>
                      <td
                        className={`px-3 py-2.5 font-mono text-right ${positive ? 'text-[#34d399]' : 'text-[#f87171]'}`}
                      >
                        {h.gainPct == null ? 'N/A' : `${positive ? '+' : ''}${h.gainPct.toFixed(2)}%`}
                      </td>
                    </tr>
                  )
                })}
                {/* Total row */}
                {sorted.length > 0 && (() => {
                  const totalGainLoss = sorted.reduce((s, r) => s + (r.gainLoss ?? 0), 0)
                  const totalPositive = totalGainLoss >= 0
                  return (
                    <tr className="border-t-2 border-[#21262d] bg-[#0d1117]">
                      <td className="px-3 py-2.5 font-mono text-xs font-semibold text-[#7d8590] uppercase tracking-wider">TOTAL</td>
                      <td className="px-3 py-2.5" />
                      <td className="px-3 py-2.5 hidden md:table-cell" />
                      <td className="px-3 py-2.5 hidden md:table-cell" />
                      <td className="px-3 py-2.5" />
                      <td className="px-3 py-2.5 hidden md:table-cell" />
                      <td className="px-3 py-2.5 font-mono text-sm font-semibold text-[#e6edf3] text-right">{fmt(totalValue)}</td>
                      <td className={`px-3 py-2.5 font-mono text-sm font-semibold text-right hidden md:table-cell ${totalPositive ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                        {totalPositive ? '+' : ''}{fmt(totalGainLoss)}
                      </td>
                      <td className="px-3 py-2.5" />
                    </tr>
                  )
                })()}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
