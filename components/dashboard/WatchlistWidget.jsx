'use client'

import { Skeleton } from '@/components/ui/skeleton'
import RangeBar from '@/components/dashboard/RangeBar'
import Sparkline from '@/components/dashboard/Sparkline'

const fmt = (v) => (v == null ? '--' : `$${Number(v).toFixed(2)}`)
const fmtChange = (v) => (v == null ? '--' : `${v >= 0 ? '+' : ''}$${Math.abs(Number(v)).toFixed(2)}`)
const fmtPct = (v) => (v == null ? '--' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`)

export default function WatchlistWidget({ loading, watchlist, fundamentals = {}, sparklines = {}, onOpenDrawer }) {
  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-md p-4">
      <p
        className="text-[10px] uppercase text-[#7d8590] font-mono mb-[10px]"
        style={{ letterSpacing: '0.08em' }}
      >
        Watchlist
      </p>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : watchlist.length === 0 ? (
        <div className="min-h-[80px] flex items-center justify-center">
          <p className="text-xs text-[#7d8590]">Watchlist is empty.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          {/* Table header - desktop */}
          <div className="hidden md:grid grid-cols-[60px_1fr_80px_80px_80px_100px_60px] gap-2 items-center px-1 mb-1">
            <span className="text-[10px] uppercase text-[#7d8590] font-mono" style={{ letterSpacing: '0.05em' }}>Ticker</span>
            <span className="text-[10px] uppercase text-[#7d8590] font-mono" style={{ letterSpacing: '0.05em' }}>Name</span>
            <span className="text-[10px] uppercase text-[#7d8590] font-mono text-right" style={{ letterSpacing: '0.05em' }}>Price</span>
            <span className="text-[10px] uppercase text-[#7d8590] font-mono text-right" style={{ letterSpacing: '0.05em' }}>Change $</span>
            <span className="text-[10px] uppercase text-[#7d8590] font-mono text-right" style={{ letterSpacing: '0.05em' }}>Change %</span>
            <span className="text-[10px] uppercase text-[#7d8590] font-mono text-center" style={{ letterSpacing: '0.05em' }}>52w Range</span>
            <span />
          </div>

          <div className="divide-y divide-[#21262d]">
            {watchlist.map((w) => {
              const positive = (w.quote?.changePercent ?? 0) >= 0
              const f = fundamentals[w.ticker]
              return (
                <button
                  key={w.id}
                  onClick={() => onOpenDrawer(w.ticker)}
                  className="w-full text-left hover:bg-[#0d1117] transition-colors rounded"
                >
                  {/* Desktop row */}
                  <div className="hidden md:grid grid-cols-[60px_1fr_80px_80px_80px_100px_60px] gap-2 items-center py-2 px-1" style={{ minHeight: 40 }}>
                    <span className="font-mono text-xs text-[#10b981]">{w.ticker}</span>
                    <span className="text-xs text-[#7d8590] truncate">{w.quote?.name ?? '--'}</span>
                    <span className="font-mono text-xs text-[#e6edf3] text-right">{fmt(w.quote?.price)}</span>
                    <span className={`font-mono text-xs text-right ${positive ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                      {fmtChange(w.quote?.change)}
                    </span>
                    <span className={`font-mono text-xs text-right ${positive ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                      {fmtPct(w.quote?.changePercent)}
                    </span>
                    <span className="flex justify-center">
                      {f ? (
                        <RangeBar
                          low={f.low52w}
                          high={f.high52w}
                          current={w.quote?.price}
                          width={80}
                          showLabels={false}
                        />
                      ) : (
                        <span className="text-[10px] text-[#7d8590]">--</span>
                      )}
                    </span>
                    <span className="flex justify-end">
                      {sparklines[w.ticker] ? (
                        <Sparkline prices={sparklines[w.ticker]} positive={positive} width={50} height={24} />
                      ) : (
                        <div style={{ width: 50, height: 24, background: '#21262d', borderRadius: 2 }} />
                      )}
                    </span>
                  </div>

                  {/* Mobile row */}
                  <div className="md:hidden flex items-center justify-between py-2.5 px-1" style={{ minHeight: 44 }}>
                    <span className="font-mono text-xs text-[#10b981]">{w.ticker}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-[#e6edf3]">{fmt(w.quote?.price)}</span>
                      <span className={`font-mono text-xs ${positive ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                        {fmtPct(w.quote?.changePercent)}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
