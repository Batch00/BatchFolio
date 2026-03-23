'use client'

import { Skeleton } from '@/components/ui/skeleton'

export default function MoversWidget({ loading, holdings, prices, onOpenDrawer }) {
  const movers = holdings
    .map((h) => ({
      ...h,
      absDayPct: Math.abs(prices[h.ticker]?.changePercent ?? 0),
      dayPct: prices[h.ticker]?.changePercent ?? 0,
    }))
    .filter((h) => h.absDayPct > 0)
    .sort((a, b) => b.absDayPct - a.absDayPct)
    .slice(0, 5)

  const maxPct = movers.length > 0 ? movers[0].absDayPct : 1

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-md p-4 h-full">
      <p className="text-[10px] uppercase text-[#7d8590] font-mono mb-[10px]" style={{ letterSpacing: '0.08em' }}>
        Top Movers
      </p>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      ) : movers.length === 0 ? (
        <div className="min-h-[80px] flex items-center justify-center">
          <p className="text-xs text-[#7d8590]">No movers data.</p>
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
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs text-[#10b981]">{m.ticker}</span>
                  <span
                    className={`font-mono text-xs ${
                      positive ? 'text-[#34d399]' : 'text-[#f87171]'
                    }`}
                  >
                    {positive ? '+' : ''}
                    {m.dayPct.toFixed(2)}%
                  </span>
                </div>
                <div className="h-1 bg-[#21262d] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
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
