'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Search } from 'lucide-react'

const fmt = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v ?? 0)

function Sparkline({ data, positive }) {
  if (!data || data.length < 2) return <div className="w-[50px] h-[20px] flex-shrink-0" />
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const W = 50
  const H = 20
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * W
      const y = H - ((v - min) / range) * (H - 4) - 2
      return `${x},${y}`
    })
    .join(' ')
  return (
    <svg width={W} height={H} className="overflow-visible flex-shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={positive ? '#34d399' : '#f87171'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function HoldingsWidget({ loading, holdings, sparklines, onOpenDrawer }) {
  const [search, setSearch] = useState('')

  const filtered = search
    ? holdings.filter(
        (h) =>
          h.ticker.includes(search.toUpperCase()) ||
          (h.name || '').toLowerCase().includes(search.toLowerCase()),
      )
    : holdings

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-md p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] uppercase tracking-widest text-[#7d8590] font-mono">Holdings</p>
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
        <p className="text-xs text-[#7d8590]">{search ? 'No matches.' : 'No holdings yet.'}</p>
      ) : (
        <div className="divide-y divide-[#21262d]">
          {filtered.map((h) => (
            <button
              key={h.id}
              onClick={() => onOpenDrawer(h.ticker)}
              className="w-full flex items-center gap-2 py-2.5 text-left hover:bg-[#0d1117] transition-colors rounded"
            >
              <span className="font-mono text-xs text-[#10b981] w-[52px] flex-shrink-0">
                {h.ticker}
              </span>
              <span className="text-xs text-[#7d8590] flex-1 min-w-0 truncate">
                {h.name || h.ticker}
              </span>
              <Sparkline data={sparklines[h.ticker]} positive={h.positive} />
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
      )}
    </div>
  )
}
