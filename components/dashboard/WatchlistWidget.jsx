'use client'

import { Skeleton } from '@/components/ui/skeleton'
import RangeBar from '@/components/dashboard/RangeBar'

const fmt = (v) => (v == null ? '--' : `$${Number(v).toFixed(2)}`)
const fmtChange = (v) => (v == null ? '--' : `${v >= 0 ? '+' : ''}$${Math.abs(Number(v)).toFixed(2)}`)
const fmtPct = (v) => (v == null ? '--' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`)

export default function WatchlistWidget({ loading, watchlist, fundamentals = {}, onOpenDrawer }) {
  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-md p-4 h-full">
      <p
        className="text-[10px] uppercase text-[#7d8590] font-mono mb-[10px]"
        style={{ letterSpacing: '0.08em' }}
      >
        Watchlist
      </p>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : watchlist.length === 0 ? (
        <div className="min-h-[80px] flex items-center justify-center">
          <p className="text-xs text-[#7d8590]">Watchlist is empty.</p>
        </div>
      ) : (
        <div className="divide-y divide-[#21262d]">
          {watchlist.map((w) => {
            const positive = (w.quote?.changePercent ?? 0) >= 0
            const f = fundamentals[w.ticker]
            return (
              <button
                key={w.id}
                onClick={() => onOpenDrawer(w.ticker)}
                className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-[#0d1117] transition-colors rounded"
              >
                <div className="flex-shrink-0 min-w-[48px]">
                  <span className="font-mono text-xs text-[#10b981] block">{w.ticker}</span>
                  <span className="text-[10px] text-[#7d8590] block leading-tight truncate max-w-[80px]">
                    {w.quote?.name ?? '--'}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  {f && (
                    <RangeBar
                      low={f.low52w}
                      high={f.high52w}
                      current={w.quote?.price}
                      width={80}
                      showLabels={false}
                    />
                  )}
                </div>

                <div className="flex-shrink-0 text-right">
                  <span className="font-mono text-[13px] text-[#e6edf3] block">
                    {fmt(w.quote?.price)}
                  </span>
                  <div className="flex flex-col items-end">
                    <span
                      className={`font-mono block ${
                        positive ? 'text-[#34d399]' : 'text-[#f87171]'
                      }`}
                      style={{ fontSize: 10 }}
                    >
                      {fmtChange(w.quote?.change)}
                    </span>
                    <span
                      className={`font-mono block ${
                        positive ? 'text-[#34d399]' : 'text-[#f87171]'
                      }`}
                      style={{ fontSize: 10 }}
                    >
                      {fmtPct(w.quote?.changePercent)}
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
