'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import StockPriceChart from '@/components/StockPriceChart'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

const RANGES = ['30d', '90d', '1y']

function StatItem({ label, value }) {
  return (
    <div className="bg-[#0d1117] border border-[#21262d] rounded-md p-3">
      <p className="text-xs text-[#7d8590] mb-1">{label}</p>
      <p className="text-sm font-mono text-[#e6edf3]">{value ?? '--'}</p>
    </div>
  )
}

function fmtNum(v, opts = {}) {
  if (v == null) return '--'
  return new Intl.NumberFormat('en-US', opts).format(v)
}

function fmtCurrency(v) {
  if (v == null) return '--'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(v)
}

function fmtMarketCap(v) {
  if (v == null) return '--'
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}T`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(2)}B`
  return `$${v.toFixed(2)}M`
}

export default function StockDetailPage() {
  const { ticker } = useParams()
  const symbol = ticker?.toUpperCase()

  const [quote, setQuote] = useState(null)
  const [fundamentals, setFundamentals] = useState(null)
  const [candles, setCandles] = useState([])
  const [range, setRange] = useState('30d')
  const [loading, setLoading] = useState(true)
  const [chartLoading, setChartLoading] = useState(false)
  const [error, setError] = useState(null)

  // Fetch quote + fundamentals on mount
  useEffect(() => {
    if (!symbol) return
    setLoading(true)
    setError(null)

    Promise.all([
      fetch(`/api/stock/quote?ticker=${symbol}`).then((r) => r.json()),
      fetch(`/api/stock/fundamentals?ticker=${symbol}`).then((r) => r.json()),
    ])
      .then(([q, f]) => {
        if (q.error) throw new Error(q.error)
        setQuote(q)
        setFundamentals(f)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [symbol])

  // Fetch chart data when range changes
  const loadChart = useCallback(async () => {
    if (!symbol) return
    setChartLoading(true)

    try {
      const res = await fetch(`/api/stock/chart?ticker=${symbol}&range=${range}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setCandles(data.candles ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setChartLoading(false)
    }
  }, [symbol, range])

  useEffect(() => { loadChart() }, [loadChart])

  const positive = (quote?.change ?? 0) >= 0

  return (
    <div className="p-6 max-w-4xl">
      {error && <p className="text-sm text-[#f87171] mb-4">{error}</p>}

      {/* Header */}
      {loading ? (
        <div className="mb-6 space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-6 w-24" />
        </div>
      ) : (
        <div className="mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-[#e6edf3]">
              {quote?.name ?? symbol}
            </h1>
            <span className="font-mono text-sm text-[#7d8590]">{symbol}</span>
          </div>
          <p className="text-4xl font-mono font-semibold text-[#e6edf3] mt-2">
            {fmtCurrency(quote?.price)}
          </p>
          <div className="mt-2">
            <Badge variant={positive ? 'positive' : 'negative'}>
              <span className="font-mono">
                {positive ? '+' : ''}{fmtCurrency(quote?.change)}{' '}
                ({positive ? '+' : ''}{fmtNum(quote?.changePercent, { maximumFractionDigits: 2 })}%)
              </span>
            </Badge>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-[#161b22] border border-[#21262d] rounded-md p-4 mb-6">
        {/* Range toggle */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm text-[#7d8590]">Price Chart</h2>
          <div className="flex gap-1 bg-[#21262d] rounded-md p-0.5">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 text-xs rounded-sm font-mono transition-colors ${
                  range === r
                    ? 'bg-[#10b981] text-white'
                    : 'text-[#7d8590] hover:text-[#e6edf3]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        {chartLoading ? (
          <Skeleton className="h-64" />
        ) : (
          <StockPriceChart candles={candles} />
        )}
      </div>

      {/* Stats grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatItem label="Market Cap" value={fmtMarketCap(fundamentals?.marketCap)} />
          <StatItem
            label="P/E Ratio"
            value={fundamentals?.peRatio != null ? fmtNum(fundamentals.peRatio, { maximumFractionDigits: 2 }) : null}
          />
          <StatItem
            label="EPS"
            value={fundamentals?.eps != null ? fmtCurrency(fundamentals.eps) : null}
          />
          <StatItem label="52w High" value={fmtCurrency(fundamentals?.high52w)} />
          <StatItem label="52w Low" value={fmtCurrency(fundamentals?.low52w)} />
          <StatItem
            label="Dividend Yield"
            value={
              fundamentals?.dividendYield != null
                ? `${fmtNum(fundamentals.dividendYield, { maximumFractionDigits: 2 })}%`
                : null
            }
          />
          <StatItem
            label="Beta"
            value={fundamentals?.beta != null ? fmtNum(fundamentals.beta, { maximumFractionDigits: 3 }) : null}
          />
          <StatItem label="Open" value={fmtCurrency(quote?.open)} />
        </div>
      )}
    </div>
  )
}
