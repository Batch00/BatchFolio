'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Search } from 'lucide-react'
import Sparkline from '@/components/dashboard/Sparkline'
import { fmt, fmtShares } from '@/lib/format'

const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }
const RANGE_BADGE = { '7d': '7D', '30d': '30D', '90d': '90D', '1y': '1Y' }

export default function HoldingsWidget({ loading, holdings, sparklines, onOpenDrawer, range = '7d' }) {
  const [search, setSearch] = useState('')
  const [mobileExpanded, setMobileExpanded] = useState(false)
  const [historyMap, setHistoryMap] = useState({})

  useEffect(() => {
    if (loading || holdings.length === 0) return
    const tickers = [...new Set(holdings.filter((h) => h.ticker !== 'CASH').map((h) => h.ticker))]
    if (tickers.length === 0) return
    const days = RANGE_DAYS[range] ?? 7
    const map = {}
    Promise.all(
      tickers.map((ticker) =>
        fetch(`/api/holdings/history?ticker=${ticker}&days=${days}`)
          .then((r) => r.json())
          .then((d) => { map[ticker] = d.history || [] })
          .catch(() => { map[ticker] = [] }),
      ),
    ).then(() => setHistoryMap({ ...map }))
  }, [holdings, range, loading])

  function getHistoricalReturn(ticker) {
    const history = historyMap[ticker] || []
    if (history.length < 2) return null
    const oldest = history[0]
    const latest = history[history.length - 1]
    if (!oldest.price || oldest.price === 0) return null
    return ((latest.price - oldest.price) / oldest.price) * 100
  }

  const filtered = search
    ? holdings.filter(
        (h) =>
          h.ticker.includes(search.toUpperCase()) ||
          (h.name || '').toLowerCase().includes(search.toLowerCase()) ||
          (h.description || '').toLowerCase().includes(search.toLowerCase()),
      )
    : holdings

  const headers = [
    { label: 'Ticker / Name', align: 'text-left', width: 'flex-1 min-w-0' },
    { label: '', align: '', width: 'w-[50px] flex-shrink-0' },
    { label: 'Shares', align: 'text-right', width: 'w-[60px] flex-shrink-0' },
    { label: 'Price', align: 'text-right', width: 'w-[72px] flex-shrink-0' },
    { label: 'Value', align: 'text-right', width: 'w-[80px] flex-shrink-0' },
    { label: `Return (${RANGE_BADGE[range] ?? '7D'})`, align: 'text-right', width: 'w-[70px] flex-shrink-0', title: 'Historical return for the selected range, daily change if no history yet, -- if unavailable' },
  ]

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-md p-4">
      <div className="flex items-center justify-between mb-[10px]">
        <p
          className="text-[10px] uppercase text-[#7d8590] font-mono"
          style={{ letterSpacing: '0.08em' }}
        >
          Holdings
        </p>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-[#7d8590] pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="pl-6 h-6 text-[10px] bg-[#0d1117] border-[#21262d] w-28"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="min-h-[80px] flex items-center justify-center">
          <p className="text-xs text-[#7d8590]">{search ? 'No matches.' : 'No holdings yet.'}</p>
        </div>
      ) : (
        <>
          {/* Column headers - desktop only */}
          <div className="hidden md:flex items-center gap-2 mb-1" style={{ paddingRight: 14 }}>
            {headers.map((h, i) => (
              <span
                key={i}
                className={`text-[#7d8590] font-mono ${h.align} ${h.width} flex-shrink-0`}
                style={{ fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase' }}
                title={h.title}
              >
                {h.label}
              </span>
            ))}
          </div>

          {/* Scrollable list */}
          <div
            className="divide-y divide-[#21262d] overflow-x-hidden overflow-y-auto"
            style={{
              maxHeight: 320,
              scrollbarWidth: 'thin',
              scrollbarColor: '#21262d #0d1117',
              scrollbarGutter: 'stable',
              paddingRight: 14,
            }}
          >
            {filtered.map((h, i) => {
              const hasDescription = h.description && h.description.trim().length > 0

              return (
                <button
                  key={h.id}
                  onClick={h.ticker === 'CASH' ? undefined : () => onOpenDrawer(h.ticker)}
                  className={`w-full flex items-center gap-2 py-0 text-left transition-colors rounded ${
                    h.ticker === 'CASH' ? 'cursor-default' : 'hover:bg-[#0d1117] cursor-pointer'
                  } ${i >= 6 && !mobileExpanded ? 'hidden sm:flex' : ''}`}
                  style={{ height: 36 }}
                >
                  {/* Ticker / Name */}
                  <div className="flex-1 min-w-0">
                    {hasDescription ? (
                      <>
                        <p
                          className="text-xs text-[#e6edf3] leading-tight"
                          title={h.description}
                          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {h.description}
                        </p>
                        <p className="font-mono text-[#7d8590] leading-tight" style={{ fontSize: 10 }}>
                          {h.ticker}
                        </p>
                      </>
                    ) : (
                      <span className="font-mono text-xs text-[#10b981]">{h.ticker}</span>
                    )}
                  </div>

                  {/* Sparkline */}
                  <span className="w-[50px] flex-shrink-0 hidden md:block">
                    <Sparkline prices={sparklines[h.ticker]} positive={h.positive} />
                  </span>

                  {/* Shares */}
                  <span className="font-mono text-xs text-[#e6edf3] w-[60px] text-right flex-shrink-0 hidden md:block">
                    {fmtShares(h.shares)}
                  </span>

                  {/* Price */}
                  <span className="font-mono text-xs text-[#e6edf3] w-[72px] text-right flex-shrink-0 hidden md:block">
                    {h.ticker === 'CASH' || h.hasPrice === false ? '--' : fmt(h.livePrice)}
                  </span>

                  {/* Value */}
                  <span className="font-mono text-xs text-[#e6edf3] w-[80px] text-right flex-shrink-0 font-semibold">
                    {h.hasPrice === false ? '--' : fmt(h.value)}
                  </span>

                  {/* Return % */}
                  {(() => {
                    const historicalPct = h.ticker !== 'CASH' ? getHistoricalReturn(h.ticker) : null
                    const badge = RANGE_BADGE[range] ?? '7D'
                    return (
                      <span className="font-mono text-xs w-[70px] text-right flex-shrink-0 font-semibold flex items-center justify-end gap-1">
                        {h.ticker === 'CASH' ? (
                          <span style={{ color: '#7d8590' }}>--</span>
                        ) : historicalPct != null ? (
                          <>
                            <span style={{ fontSize: 9, color: '#7d8590', background: 'rgba(125,133,144,0.1)', borderRadius: 3, padding: '1px 4px', flexShrink: 0 }}>{badge}</span>
                            <span style={{ color: historicalPct >= 0 ? '#34d399' : '#f87171' }}>
                              {historicalPct >= 0 ? '+' : ''}{historicalPct.toFixed(2)}%
                            </span>
                          </>
                        ) : h.changePercent != null && h.changePercent !== 0 ? (
                          <>
                            <span style={{ fontSize: 9, color: '#7d8590', background: 'rgba(125,133,144,0.1)', borderRadius: 3, padding: '1px 4px', flexShrink: 0 }}>1D</span>
                            <span style={{ color: h.changePercent >= 0 ? '#34d399' : '#f87171' }}>
                              {h.changePercent >= 0 ? '+' : ''}{h.changePercent.toFixed(2)}%
                            </span>
                          </>
                        ) : h.gainPct != null ? (
                          <span style={{ color: h.positive ? '#34d399' : '#f87171' }}>
                            {h.positive ? '+' : ''}{h.gainPct.toFixed(2)}%
                          </span>
                        ) : (
                          <span style={{ color: '#7d8590' }}>--</span>
                        )}
                      </span>
                    )
                  })()}
                </button>
              )
            })}
          </div>

          {filtered.length > 6 && (
            <button
              onClick={() => setMobileExpanded((v) => !v)}
              className="sm:hidden w-full text-center text-[11px] text-[#10b981] hover:text-[#34d399] pt-2 transition-colors"
            >
              {mobileExpanded ? 'Show less' : `See all ${filtered.length}`}
            </button>
          )}
        </>
      )}
    </div>
  )
}
