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

function fmtNewsDate(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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

export default function StockDrawer({ ticker, onClose }) {
  const supabase = createClient()
  const symbol = ticker?.toUpperCase()

  const [quote, setQuote] = useState(null)
  const [fundamentals, setFundamentals] = useState(null)
  const [news, setNews] = useState([])
  const [newsLoading, setNewsLoading] = useState(true)
  const [candles, setCandles] = useState([])
  const [range, setRange] = useState('30d')
  const [loading, setLoading] = useState(true)
  const [chartLoading, setChartLoading] = useState(false)
  const [error, setError] = useState(null)
  const [position, setPosition] = useState(null)
  // null = unknown, true = synced fund (SimpleFIN), false = normal Finnhub
  const [isSyncedFund, setIsSyncedFund] = useState(null)
  const [syncedData, setSyncedData] = useState(null)

  useEffect(() => {
    if (!symbol) return
    setLoading(true)
    setNewsLoading(true)
    setError(null)
    setQuote(null)
    setFundamentals(null)
    setNews([])
    setPosition(null)
    setSyncedData(null)
    setIsSyncedFund(null)
    setCandles([])

    supabase
      .from('holdings')
      .select('*')
      .eq('ticker', symbol)
      .then(({ data: holds }) => {
        const holdingsArr = holds ?? []
        const allSynced =
          holdingsArr.length > 0 &&
          holdingsArr.every((h) => h.is_synced && h.last_synced_price > 0)

        if (allSynced) {
          // SimpleFIN mode — no Finnhub calls
          const totalShares = holdingsArr.reduce((s, h) => s + h.shares, 0)
          const costBasisTotal = holdingsArr.reduce(
            (s, h) => s + (h.cost_basis_total || h.shares * h.avg_cost_basis),
            0,
          )
          const avgCost = totalShares > 0 ? costBasisTotal / totalShares : 0
          const lastSyncedPrice = holdingsArr[0].last_synced_price
          const totalValue = totalShares * lastSyncedPrice
          const gainLoss = totalValue - costBasisTotal
          const gainPct = costBasisTotal > 0 ? (gainLoss / costBasisTotal) * 100 : 0

          setSyncedData({
            price: lastSyncedPrice,
            description: holdingsArr[0].description || null,
          })
          setPosition({ totalShares, avgCost, totalValue, totalCost: costBasisTotal, gainLoss, gainPct })
          setIsSyncedFund(true)
          setLoading(false)
          setNewsLoading(false)
        } else {
          // Normal Finnhub mode
          setIsSyncedFund(false)
          Promise.all([
            fetch(`/api/stock/quote?ticker=${symbol}`).then((r) => r.json()),
            fetch(`/api/stock/fundamentals?ticker=${symbol}`).then((r) => r.json()),
            fetch(`/api/stock/news?ticker=${symbol}`).then((r) => r.json()),
          ])
            .then(([q, f, n]) => {
              if (q.error) throw new Error(q.error)
              setQuote(q)
              setFundamentals(f)
              setNews(n.news ?? [])
              setNewsLoading(false)
              if (holdingsArr.length > 0) {
                const totalShares = holdingsArr.reduce((s, h) => s + h.shares, 0)
                const totalCost = holdingsArr.reduce((s, h) => s + h.shares * h.avg_cost_basis, 0)
                const avgCost = totalShares > 0 ? totalCost / totalShares : 0
                const totalValue = totalShares * (q.price ?? 0)
                const gainLoss = totalValue - totalCost
                const gainPct = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0
                setPosition({ totalShares, avgCost, totalValue, totalCost, gainLoss, gainPct })
              }
            })
            .catch((err) => {
              setError(err.message)
              setNewsLoading(false)
            })
            .finally(() => setLoading(false))
        }
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
        setNewsLoading(false)
      })
  }, [symbol])

  const loadChart = useCallback(async () => {
    // Only load chart for non-synced holdings — wait until isSyncedFund is resolved
    if (!symbol || isSyncedFund !== false) return
    setChartLoading(true)
    try {
      const url = `/api/stock/chart?ticker=${symbol}&range=${range}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setCandles(data.candles ?? [])
    } catch {
      // chart errors are non-fatal
    } finally {
      setChartLoading(false)
    }
  }, [symbol, range, isSyncedFund])

  useEffect(() => {
    loadChart()
  }, [loadChart])

  const positive = (quote?.change ?? 0) >= 0

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
      />

      {/* Drawer - mobile: bottom sheet, desktop: right panel (via .stock-drawer CSS class) */}
      <div className="stock-drawer">
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0 sm:hidden">
          <div style={{ width: 32, height: 4, borderRadius: 2, background: '#3d4451' }} />
        </div>

        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-[#21262d] flex-shrink-0">
          <div className="flex items-start justify-between mb-3">
            <div>
              {loading ? (
                <>
                  <Skeleton className="h-5 w-16 mb-1" />
                  <Skeleton className="h-3 w-28" />
                </>
              ) : (
                <>
                  <p className="font-mono text-base text-[#10b981] font-semibold">{symbol}</p>
                  <p className="text-xs text-[#7d8590] mt-0.5">
                    {isSyncedFund ? (syncedData?.description ?? symbol) : (quote?.name ?? '--')}
                  </p>
                </>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-[#7d8590] hover:text-[#e6edf3] transition-colors ml-4 flex items-center justify-center"
              style={{ minWidth: 44, minHeight: 44 }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {loading ? (
            <>
              <Skeleton className="h-8 w-28 mb-1" />
              <Skeleton className="h-5 w-24" />
            </>
          ) : isSyncedFund ? (
            <>
              <p className="font-mono text-2xl font-semibold text-[#e6edf3]">
                {fmtCurrency(syncedData?.price)}
              </p>
              <p className="text-[10px] text-[#7d8590] mt-1">
                Price sourced from SimpleFIN — updated daily
              </p>
            </>
          ) : (
            <>
              <p className="font-mono text-2xl font-semibold text-[#e6edf3]">
                {fmtCurrency(quote?.price)}
              </p>
              <div className="mt-1">
                <Badge variant={positive ? 'positive' : 'negative'}>
                  <span className="font-mono text-xs">
                    {positive ? '+' : ''}
                    {fmtCurrency(quote?.change)}{' '}
                    ({positive ? '+' : ''}
                    {fmtNum(quote?.changePercent, { maximumFractionDigits: 2 })}%)
                  </span>
                </Badge>
              </div>
            </>
          )}

          {error && <p className="text-xs text-[#f87171] mt-2">{error}</p>}
        </div>

        <div className="stock-drawer-body">
          {/* Chart — hidden for synced mutual funds */}
          {isSyncedFund === false && (
            <div className="px-5 pt-3">
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
                <Skeleton className="h-[120px]" />
              ) : (
                <StockPriceChart candles={candles} />
              )}
            </div>
          )}

          {/* Your position */}
          {!loading && position && (
            <div className="px-5 pt-4 border-t border-[#21262d]">
              <p className="text-[10px] uppercase tracking-[0.08em] text-[#7d8590] mb-[10px]">Your Position</p>
              <div className="bg-[#0d1117] border border-[#21262d] rounded-md px-3 py-1">
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

          {/* Key stats — Finnhub only */}
          {!loading && isSyncedFund === false && (
            <div className="px-5 pt-4">
              <p className="text-[10px] uppercase tracking-[0.08em] text-[#7d8590] mb-[10px]">Key Stats</p>
              <div className="bg-[#0d1117] border border-[#21262d] rounded-md px-3 py-1">
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

          {/* News — Finnhub only */}
          {!loading && isSyncedFund === false && (
            <div className="px-5 pt-4 pb-6">
              <div className="border-t border-[#21262d] my-4" />
              <p
                className="font-mono text-[10px] uppercase text-[#7d8590] mb-[10px]"
                style={{ letterSpacing: '0.08em' }}
              >
                News
              </p>

              {newsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : news.length === 0 ? (
                <p className="text-xs text-[#7d8590] text-center py-4">
                  No recent news available
                </p>
              ) : (
                <div>
                  {news.map((item, i) => (
                    <a
                      key={i}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block py-[10px] transition-colors hover:bg-[rgba(255,255,255,0.02)]"
                      style={{
                        borderBottom: i < news.length - 1 ? '1px solid #21262d' : 'none',
                      }}
                    >
                      <p
                        className="text-xs text-[#e6edf3] leading-snug"
                        style={{
                          fontWeight: 500,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {item.headline}
                      </p>
                      <p className="text-[10px] mt-1">
                        <span className="text-[#10b981]">{item.source}</span>
                        <span className="text-[#7d8590] ml-2">{fmtNewsDate(item.datetime)}</span>
                      </p>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
