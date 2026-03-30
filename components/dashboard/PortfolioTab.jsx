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
  '#10b981', '#059669', '#34d399', '#047857',
  '#6ee7b7', '#065f46', '#a7f3d0', '#064e3b',
]

const COLS = [
  { key: 'ticker', label: 'Ticker' },
  { key: 'account', label: 'Account' },
  { key: 'shares', label: 'Shares', numeric: true },
  { key: 'avgCost', label: 'Avg Cost', numeric: true },
  { key: 'livePrice', label: 'Live Price', numeric: true },
  { key: 'sparkline', label: '7D', numeric: true, noSort: true },
  { key: 'value', label: 'Value', numeric: true },
  { key: 'gainLoss', label: 'Gain/Loss $', numeric: true },
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

    const tickers = [...new Set((allHoldings ?? []).map((h) => h.ticker))]
    const priceResults = await Promise.all(
      tickers.map((t) =>
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

    const enriched = (allHoldings ?? []).map((h) => {
      const livePrice = priceMap[h.ticker]?.price ?? 0
      const value = h.shares * livePrice
      const costBasis = h.shares * h.avg_cost_basis
      const gainLoss = value - costBasis
      const gainPct = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0
      return {
        ...h,
        account: h.accounts?.name ?? '--',
        avgCost: h.avg_cost_basis,
        livePrice,
        value,
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
        <p className="text-xs text-[#7d8590] uppercase tracking-wider">Total Portfolio</p>
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
                    } ${col.numeric ? 'text-right' : 'text-left'}`}
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
                      <td key={col.key} className="px-3 py-2.5">
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
                sorted.map((h) => {
                  const positive = h.gainLoss >= 0
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
                      <td className="px-3 py-2.5 font-mono text-[#e6edf3] text-right">
                        {h.shares}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[#7d8590] text-right">
                        {fmt(h.avgCost)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[#e6edf3] text-right">
                        {fmt(h.livePrice)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {sparklines[h.ticker] ? (
                          <div className="inline-flex justify-end">
                            <Sparkline
                              prices={sparklines[h.ticker]}
                              positive={h.gainLoss >= 0}
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
                        {fmt(h.value)}
                      </td>
                      <td
                        className={`px-3 py-2.5 font-mono text-right ${positive ? 'text-[#34d399]' : 'text-[#f87171]'}`}
                      >
                        {positive ? '+' : ''}
                        {fmt(h.gainLoss)}
                      </td>
                      <td
                        className={`px-3 py-2.5 font-mono text-right ${positive ? 'text-[#34d399]' : 'text-[#f87171]'}`}
                      >
                        {positive ? '+' : ''}
                        {h.gainPct.toFixed(2)}%
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
