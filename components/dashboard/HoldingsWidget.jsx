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

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-md p-4 h-full">
      <div className="flex items-center justify-between mb-[10px]">
        <p className="text-[10px] uppercase text-[#7d8590] font-mono" style={{ letterSpacing: '0.08em' }}>Holdings</p>
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
          <div className="divide-y divide-[#21262d]">
            {/* On mobile show max 4 rows unless expanded; on desktop show all */}
            {filtered.map((h, i) => (
              <button
                key={h.id}
                onClick={() => onOpenDrawer(h.ticker)}
                className={`w-full flex items-center gap-2 py-2.5 text-left hover:bg-[#0d1117] transition-colors rounded min-h-[44px] ${
                  i >= 4 && !mobileExpanded ? 'hidden sm:flex' : ''
                }`}
              >
                <span className="font-mono text-xs text-[#10b981] w-[52px] flex-shrink-0">
                  {h.ticker}
                </span>
                <span className="text-xs text-[#7d8590] flex-1 min-w-0 truncate">
                  {h.name || h.ticker}
                </span>
                <Sparkline prices={sparklines[h.ticker]} positive={h.positive} />
                <span className="font-mono text-xs text-[#e6edf3] w-20 text-right flex-shrink-0">
                  {fmt(h.value)}
                </span>
                <span
                  className={`font-mono text-xs w-14 text-right flex-shrink-0 ${
                    h.positive ? 'text-[#34d399]' : 'text-[#f87171]'
                  }`}
                >
                  {h.positive ? '+' : ''}
                  {h.gainPct.toFixed(2)}%
                </span>
              </button>
            ))}
          </div>
          {/* Mobile see-all / collapse toggle */}
          {filtered.length > 4 && (
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
