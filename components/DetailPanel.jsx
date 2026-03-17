'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import StockPriceChart from '@/components/StockPriceChart'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'

const RANGES = ['30d', '90d', '1y']

function fmtCurrency(v) {
  if (v == null) return '--'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(v)
}

function fmtNum(v, opts = {}) {
  if (v == null) return '--'
  return new Intl.NumberFormat('en-US', opts).format(v)
}

function fmtMarketCap(v) {
  if (v == null) return '--'
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}T`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(2)}B`
  return `$${v.toFixed(2)}M`
}

function StatRow({ label, value, colored }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#21262d] last:border-0">
      <span className="text-xs text-[#7d8590]">{label}</span>
      <span className={`font-mono text-xs ${colored ?? 'text-[#e6edf3]'}`}>
        {value ?? '--'}
      </span>
    </div>
  )
}

function StockDetail({ ticker, onClose }) {
  const supabase = createClient()
  const symbol = ticker?.toUpperCase()

  const [quote, setQuote] = useState(null)
  const [fundamentals, setFundamentals] = useState(null)
  const [candles, setCandles] = useState([])
  const [range, setRange] = useState('30d')
  const [loading, setLoading] = useState(true)
  const [chartLoading, setChartLoading] = useState(false)
  const [error, setError] = useState(null)
  const [position, setPosition] = useState(null)

  useEffect(() => {
    if (!symbol) return
    setLoading(true)
    setError(null)

    Promise.all([
      fetch(`/api/stock/quote?ticker=${symbol}`).then((r) => r.json()),
      fetch(`/api/stock/fundamentals?ticker=${symbol}`).then((r) => r.json()),
      supabase.from('holdings').select('*').eq('ticker', symbol),
    ])
      .then(([q, f, holdRes]) => {
        if (q.error) throw new Error(q.error)
        setQuote(q)
        setFundamentals(f)
        const holds = holdRes.data ?? []
        if (holds.length > 0) {
          const totalShares = holds.reduce((s, h) => s + h.shares, 0)
          const totalCost = holds.reduce((s, h) => s + h.shares * h.avg_cost_basis, 0)
          const avgCost = totalShares > 0 ? totalCost / totalShares : 0
          const totalValue = totalShares * (q.price ?? 0)
          const gainLoss = totalValue - totalCost
          const gainPct = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0
          setPosition({ totalShares, avgCost, totalValue, totalCost, gainLoss, gainPct })
        } else {
          setPosition(null)
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [symbol])

  const loadChart = useCallback(async () => {
    if (!symbol) return
    setChartLoading(true)
    try {
      const res = await fetch(`/api/stock/chart?ticker=${symbol}&range=${range}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setCandles(data.candles ?? [])
    } catch {
      // chart errors are non-fatal
    } finally {
      setChartLoading(false)
    }
  }, [symbol, range])

  useEffect(() => { loadChart() }, [loadChart])

  const positive = (quote?.change ?? 0) >= 0

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[#21262d] flex-shrink-0">
        <div className="flex items-start justify-between mb-3">
          <div>
            {loading ? (
              <>
                <Skeleton className="h-4 w-16 mb-1" />
                <Skeleton className="h-3 w-28" />
              </>
            ) : (
              <>
                <p className="font-mono text-sm text-[#10b981]">{symbol}</p>
                <p className="text-xs text-[#7d8590] mt-0.5">{quote?.name ?? '--'}</p>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-[#7d8590] hover:text-[#e6edf3] transition-colors ml-4 mt-0.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <>
            <Skeleton className="h-8 w-28 mb-1" />
            <Skeleton className="h-5 w-20" />
          </>
        ) : (
          <>
            <p className="font-mono text-2xl font-semibold text-[#e6edf3]">
              {fmtCurrency(quote?.price)}
            </p>
            <div className="mt-1">
              <Badge variant={positive ? 'positive' : 'negative'}>
                <span className="font-mono text-xs">
                  {positive ? '+' : ''}{fmtCurrency(quote?.change)}{' '}
                  ({positive ? '+' : ''}{fmtNum(quote?.changePercent, { maximumFractionDigits: 2 })}%)
                </span>
              </Badge>
            </div>
          </>
        )}

        {error && <p className="text-xs text-[#f87171] mt-2">{error}</p>}
      </div>

      {/* Chart */}
      <div className="px-4 pt-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-[#7d8590]">Price</p>
          <div className="flex gap-0.5 bg-[#21262d] rounded p-0.5">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2 py-0.5 text-xs rounded font-mono transition-colors ${
                  range === r ? 'bg-[#10b981] text-white' : 'text-[#7d8590] hover:text-[#e6edf3]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        {chartLoading ? (
          <Skeleton className="h-36" />
        ) : (
          <StockPriceChart candles={candles} />
        )}
      </div>

      {/* Your position */}
      {!loading && position && (
        <div className="px-4 pt-4">
          <p className="text-xs text-[#7d8590] uppercase tracking-wider mb-2">Your Position</p>
          <div className="bg-[#161b22] border border-[#21262d] rounded-md px-3 py-1">
            <StatRow
              label="Shares"
              value={fmtNum(position.totalShares, { maximumFractionDigits: 4 })}
            />
            <StatRow label="Avg Cost" value={fmtCurrency(position.avgCost)} />
            <StatRow label="Total Value" value={fmtCurrency(position.totalValue)} />
            <StatRow
              label="Gain/Loss"
              value={`${position.gainLoss >= 0 ? '+' : ''}${fmtCurrency(position.gainLoss)}`}
              colored={position.gainLoss >= 0 ? 'text-[#34d399]' : 'text-[#f87171]'}
            />
            <StatRow
              label="Gain/Loss %"
              value={`${position.gainLoss >= 0 ? '+' : ''}${position.gainPct.toFixed(2)}%`}
              colored={position.gainLoss >= 0 ? 'text-[#34d399]' : 'text-[#f87171]'}
            />
          </div>
        </div>
      )}

      {/* Key stats */}
      {!loading && (
        <div className="px-4 pt-4 pb-4">
          <p className="text-xs text-[#7d8590] uppercase tracking-wider mb-2">Key Stats</p>
          <div className="bg-[#161b22] border border-[#21262d] rounded-md px-3 py-1">
            <StatRow label="Market Cap" value={fmtMarketCap(fundamentals?.marketCap)} />
            <StatRow
              label="P/E Ratio"
              value={
                fundamentals?.peRatio != null
                  ? fmtNum(fundamentals.peRatio, { maximumFractionDigits: 2 })
                  : null
              }
            />
            <StatRow label="EPS" value={fmtCurrency(fundamentals?.eps)} />
            <StatRow label="52w High" value={fmtCurrency(fundamentals?.high52w)} />
            <StatRow label="52w Low" value={fmtCurrency(fundamentals?.low52w)} />
            <StatRow
              label="Dividend"
              value={
                fundamentals?.dividendYield != null
                  ? `${fmtNum(fundamentals.dividendYield, { maximumFractionDigits: 2 })}%`
                  : null
              }
            />
            <StatRow
              label="Beta"
              value={
                fundamentals?.beta != null
                  ? fmtNum(fundamentals.beta, { maximumFractionDigits: 3 })
                  : null
              }
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default function DetailPanel({ panel, onClose }) {
  return (
    <>
      {/* Mobile: full-screen backdrop (panel covers everything, no extra backdrop needed) */}
      {/* Desktop: panel slides in from right over canvas */}
      <div
        className="fixed z-40 inset-0 md:inset-auto md:right-0 md:top-0 md:w-[280px] md:h-full flex flex-col"
        style={{
          background: '#161b22',
          borderLeft: '1px solid #10b981',
        }}
      >
        {panel.type === 'stock' && (
          <StockDetail ticker={panel.ticker} onClose={onClose} />
        )}
      </div>
    </>
  )
}
