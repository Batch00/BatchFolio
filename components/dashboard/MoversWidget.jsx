'use client'

import { Skeleton } from '@/components/ui/skeleton'

const fmt = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v ?? 0)

export default function MoversWidget({ loading, holdings, prices, onOpenDrawer }) {
  const movers = !loading
    ? holdings
        .map((h) => {
          const q = prices[h.ticker]
          const hasDayChange = q?.changePercent != null && Math.abs(q.changePercent) > 0.001
          if (hasDayChange) {
            return {
              ...h,
              absDayPct: Math.abs(q.changePercent),
              dayPct: q.changePercent,
              livePrice: q.price ?? 0,
              label: 'Today',
            }
          }
          // Synced holdings fallback: use total return vs cost basis
          if (h.is_synced && h.last_synced_price > 0 && h.avg_cost_basis > 0) {
            const totalReturn = ((h.last_synced_price - h.avg_cost_basis) / h.avg_cost_basis) * 100
            if (Math.abs(totalReturn) > 0.01) {
              return {
                ...h,
                absDayPct: Math.abs(totalReturn),
                dayPct: totalReturn,
                livePrice: h.last_synced_price,
                label: 'Return',
              }
            }
          }
          return null
        })
        .filter(Boolean)
        .sort((a, b) => b.absDayPct - a.absDayPct)
        .slice(0, 5)
    : []

  const maxPct = movers.length > 0 ? movers[0].absDayPct : 1

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-md p-4 h-full">
      <p
        className="text-[10px] uppercase text-[#7d8590] font-mono mb-[10px]"
        style={{ letterSpacing: '0.08em' }}
      >
        Top Movers
      </p>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : movers.length === 0 ? (
        <div className="min-h-[80px] flex items-center justify-center">
          <p className="text-xs text-[#7d8590]">No market data available.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {movers.map((m) => {
            const positive = m.dayPct >= 0
            const barWidth = (m.absDayPct / maxPct) * 100
            return (
              <button
                key={m.ticker}
                onClick={() => onOpenDrawer(m.ticker)}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between mb-0.5">
                  <div>
                    <span className="font-mono text-xs text-[#10b981]">{m.ticker}</span>
                    <p className="text-[10px] text-[#7d8590] leading-tight truncate max-w-[120px]">
                      {m.description || m.name || m.ticker}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`font-mono text-xs font-semibold ${
                        positive ? 'text-[#34d399]' : 'text-[#f87171]'
                      }`}
                    >
                      {positive ? '+' : ''}
                      {m.dayPct.toFixed(2)}%
                    </span>
                    {m.label === 'Return' && (
                      <span
                        className="font-mono"
                        style={{
                          fontSize: 9,
                          color: '#7d8590',
                          background: '#21262d',
                          padding: '1px 4px',
                          borderRadius: 2,
                          letterSpacing: '0.04em',
                        }}
                      >
                        TOTAL
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-1.5 bg-[#21262d] rounded overflow-hidden">
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${barWidth}%`,
                      background: positive ? '#34d399' : '#f87171',
                    }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
