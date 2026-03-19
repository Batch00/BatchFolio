'use client'

import { Skeleton } from '@/components/ui/skeleton'

const fmt = (v) => (v == null ? '--' : `$${Number(v).toFixed(2)}`)
const fmtPct = (v) => (v == null ? '--' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`)

export default function WatchlistWidget({ loading, watchlist, onOpenDrawer }) {
  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-md p-4">
      <p className="text-[10px] uppercase tracking-widest text-[#7d8590] font-mono mb-3">
        Watchlist
      </p>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      ) : watchlist.length === 0 ? (
        <p className="text-xs text-[#7d8590]">Watchlist is empty.</p>
      ) : (
        <div className="divide-y divide-[#21262d]">
          {watchlist.map((w) => {
            const positive = (w.quote?.changePercent ?? 0) >= 0
            return (
              <button
                key={w.id}
                onClick={() => onOpenDrawer(w.ticker)}
                className="w-full flex items-center gap-2 py-2.5 text-left hover:bg-[#0d1117] transition-colors rounded"
              >
                <span className="font-mono text-xs text-[#10b981] w-12 flex-shrink-0">
                  {w.ticker}
                </span>
                <span className="text-xs text-[#7d8590] flex-1 min-w-0 truncate">
                  {w.quote?.name ?? '--'}
                </span>
                <span className="font-mono text-xs text-[#e6edf3] flex-shrink-0">
                  {fmt(w.quote?.price)}
                </span>
                <span
                  className={`font-mono text-xs w-14 text-right flex-shrink-0 ${
                    positive ? 'text-[#34d399]' : 'text-[#f87171]'
                  }`}
                >
                  {fmtPct(w.quote?.changePercent)}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
