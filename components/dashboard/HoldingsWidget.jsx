'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Search } from 'lucide-react'
import Sparkline from '@/components/dashboard/Sparkline'

const fmt = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v ?? 0)

export default function HoldingsWidget({ loading, holdings, sparklines, onOpenDrawer }) {
  const [search, setSearch] = useState('')
  const [mobileExpanded, setMobileExpanded] = useState(false)

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
    { label: 'Return', align: 'text-right', width: 'w-[70px] flex-shrink-0' },
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
          <div className="hidden md:flex items-center gap-2 mb-1">
            {headers.map((h, i) => (
              <span
                key={i}
                className={`text-[#7d8590] font-mono ${h.align} ${h.width} flex-shrink-0`}
                style={{ fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase' }}
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
                    {h.shares}
                  </span>

                  {/* Price */}
                  <span className="font-mono text-xs text-[#e6edf3] w-[72px] text-right flex-shrink-0 hidden md:block">
                    {h.hasPrice === false ? '--' : fmt(h.livePrice)}
                  </span>

                  {/* Value */}
                  <span className="font-mono text-xs text-[#e6edf3] w-[80px] text-right flex-shrink-0 font-semibold">
                    {h.hasPrice === false ? '--' : fmt(h.value)}
                  </span>

                  {/* Return % */}
                  <span
                    className={`font-mono text-xs w-[70px] text-right flex-shrink-0 font-semibold ${
                      h.positive ? 'text-[#34d399]' : 'text-[#f87171]'
                    }`}
                  >
                    {h.gainPct == null ? 'N/A' : `${h.positive ? '+' : ''}${h.gainPct.toFixed(2)}%`}
                  </span>
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
