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
          (h.name || '').toLowerCase().includes(search.toLowerCase()),
      )
    : holdings

  const headers = [
    { label: 'Ticker', align: 'text-left', width: 'w-[52px]' },
    { label: 'Name', align: 'text-left', width: 'flex-1' },
    { label: '', align: '', width: 'w-[60px]' },
    { label: 'Shares', align: 'text-right', width: 'w-[60px]' },
    { label: 'Avg Cost', align: 'text-right', width: 'w-[80px]' },
    { label: 'Price', align: 'text-right', width: 'w-[80px]' },
    { label: 'Value', align: 'text-right', width: 'w-[80px]' },
    { label: 'Gain/Loss', align: 'text-right', width: 'w-[80px]' },
    { label: 'Return', align: 'text-right', width: 'w-[70px]' },
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
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="min-h-[80px] flex items-center justify-center">
          <p className="text-xs text-[#7d8590]">{search ? 'No matches.' : 'No holdings yet.'}</p>
        </div>
      ) : (
        <>
          {/* Column headers - desktop only */}
          <div className="hidden md:flex items-center gap-2 px-1 mb-1">
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

          <div className="divide-y divide-[#21262d]">
            {filtered.map((h, i) => (
              <button
                key={h.id}
                onClick={() => onOpenDrawer(h.ticker)}
                className={`w-full flex items-center gap-2 py-2 text-left hover:bg-[#0d1117] transition-colors rounded ${
                  i >= 6 && !mobileExpanded ? 'hidden sm:flex' : ''
                }`}
                style={{ height: 40 }}
              >
                <span className="font-mono text-xs text-[#10b981] w-[52px] flex-shrink-0">
                  {h.ticker}
                </span>
                <span className="text-xs text-[#7d8590] flex-1 min-w-0 truncate hidden md:block">
                  {h.name || h.ticker}
                </span>
                <span className="w-[60px] flex-shrink-0 hidden md:block">
                  <Sparkline prices={sparklines[h.ticker]} positive={h.positive} />
                </span>
                <span className="font-mono text-xs text-[#e6edf3] w-[60px] text-right flex-shrink-0 hidden md:block">
                  {h.shares}
                </span>
                <span className="font-mono text-xs text-[#7d8590] w-[80px] text-right flex-shrink-0 hidden md:block">
                  {fmt(h.avg_cost_basis)}
                </span>
                <span className="font-mono text-xs text-[#e6edf3] w-[80px] text-right flex-shrink-0 hidden md:block">
                  {fmt(h.livePrice)}
                </span>
                <span className="font-mono text-xs text-[#e6edf3] w-[80px] text-right flex-shrink-0 font-semibold">
                  {fmt(h.value)}
                </span>
                <span
                  className={`font-mono text-xs w-[80px] text-right flex-shrink-0 hidden md:block ${
                    h.positive ? 'text-[#34d399]' : 'text-[#f87171]'
                  }`}
                >
                  {h.positive ? '+' : ''}
                  {fmt(h.gainLoss)}
                </span>
                <span
                  className={`font-mono text-xs w-[70px] text-right flex-shrink-0 font-semibold ${
                    h.positive ? 'text-[#34d399]' : 'text-[#f87171]'
                  }`}
                >
                  {h.positive ? '+' : ''}
                  {h.gainPct.toFixed(2)}%
                </span>
              </button>
            ))}
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
