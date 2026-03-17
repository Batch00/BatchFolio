'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import AllocationChart from '@/components/AllocationChart'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const fmt = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v ?? 0)

async function fetchQuote(ticker) {
  const res = await fetch(`/api/stock/quote?ticker=${ticker}`)
  if (!res.ok) return null
  return res.json()
}

export default function PortfolioPage() {
  const supabase = createClient()
  const [rows, setRows] = useState([])       // enriched holding rows
  const [accounts, setAccounts] = useState({}) // id -> name
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sortKey, setSortKey] = useState('value')
  const [sortDir, setSortDir] = useState('desc')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data: accs, error: accErr } = await supabase.from('accounts').select('id, name')
    if (accErr) { setError(accErr.message); setLoading(false); return }

    const accMap = {}
    ;(accs ?? []).forEach((a) => (accMap[a.id] = a.name))

    const { data: allHoldings, error: holdErr } = await supabase
      .from('holdings')
      .select('*')
    if (holdErr) { setError(holdErr.message); setLoading(false); return }

    const tickers = [...new Set((allHoldings ?? []).map((h) => h.ticker))]
    const priceResults = await Promise.all(
      tickers.map((t) => fetchQuote(t).then((q) => ({ t, q }))),
    )
    const priceMap = {}
    priceResults.forEach(({ t, q }) => { if (q) priceMap[t] = q })

    const enriched = (allHoldings ?? []).map((h) => {
      const livePrice = priceMap[h.ticker]?.price ?? 0
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
        accountName: accMap[h.account_id] ?? 'Unknown',
      }
    })

    setAccounts(accMap)
    setRows(enriched)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Allocation data for donut chart (by account)
  const allocationData = Object.entries(accounts).map(([id, name]) => ({
    name,
    value: rows.filter((r) => r.account_id === id).reduce((s, r) => s + r.value, 0),
  })).filter((d) => d.value > 0)

  const totalValue = rows.reduce((s, r) => s + r.value, 0)

  function toggleSort(key) {
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
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : (av ?? 0) - (bv ?? 0)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const SortIcon = ({ col }) =>
    sortKey === col ? (sortDir === 'asc' ? ' ^' : ' v') : ''

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-xl font-semibold text-[#e6edf3] mb-6">Portfolio</h1>

      {error && <p className="text-sm text-[#f87171] mb-4">{error}</p>}

      {/* Net worth total */}
      <div className="mb-6">
        {loading ? (
          <Skeleton className="h-12 w-64" />
        ) : (
          <p className="text-4xl font-mono font-semibold text-[#e6edf3]">{fmt(totalValue)}</p>
        )}
        <p className="text-xs text-[#7d8590] mt-1">Total Portfolio Value</p>
      </div>

      {/* Allocation chart */}
      <div className="bg-[#161b22] border border-[#21262d] rounded-md p-4 mb-6">
        <h2 className="text-sm font-medium text-[#7d8590] mb-2">Allocation by Account</h2>
        {loading ? (
          <Skeleton className="h-64" />
        ) : (
          <AllocationChart data={allocationData} />
        )}
      </div>

      {/* Holdings table */}
      <div className="bg-[#161b22] border border-[#21262d] rounded-md">
        <div className="px-4 py-3 border-b border-[#21262d]">
          <h2 className="text-sm font-medium text-[#7d8590]">All Holdings</h2>
        </div>
        {loading ? (
          <div className="p-4 space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-[#7d8590]">No holdings yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('ticker')}>
                  Ticker<SortIcon col="ticker" />
                </TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('shares')}>
                  Shares<SortIcon col="shares" />
                </TableHead>
                <TableHead className="text-right">Avg Cost</TableHead>
                <TableHead className="text-right">Live Price</TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('value')}>
                  Value<SortIcon col="value" />
                </TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('gainLoss')}>
                  Gain/Loss<SortIcon col="gainLoss" />
                </TableHead>
                <TableHead className="text-right cursor-pointer" onClick={() => toggleSort('gainPct')}>
                  Gain/Loss %<SortIcon col="gainPct" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((h) => {
                const positive = h.gainLoss >= 0
                return (
                  <TableRow key={h.id}>
                    <TableCell>
                      <Link
                        href={`/stock/${h.ticker}`}
                        className="font-mono text-[#10b981] hover:text-[#34d399] transition-colors"
                      >
                        {h.ticker}
                      </Link>
                    </TableCell>
                    <TableCell className="text-[#7d8590] text-xs">{h.accountName}</TableCell>
                    <TableCell className="text-right font-mono">{h.shares}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(h.avg_cost_basis)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {h.livePrice ? fmt(h.livePrice) : <span className="text-[#7d8590]">--</span>}
                    </TableCell>
                    <TableCell className="text-right font-mono">{fmt(h.value)}</TableCell>
                    <TableCell className={`text-right font-mono ${positive ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                      {positive ? '+' : ''}{fmt(h.gainLoss)}
                    </TableCell>
                    <TableCell className={`text-right font-mono ${positive ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                      {positive ? '+' : ''}{h.gainPct.toFixed(2)}%
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
