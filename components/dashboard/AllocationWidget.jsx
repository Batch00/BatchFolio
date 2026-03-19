'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'

const COLORS = [
  '#10b981',
  '#059669',
  '#34d399',
  '#047857',
  '#6ee7b7',
  '#065f46',
  '#a7f3d0',
  '#064e3b',
]

export default function AllocationWidget({ loading, holdings }) {
  const total = holdings.reduce((s, h) => s + h.value, 0)

  const data = holdings.slice(0, 8).map((h) => ({
    ticker: h.ticker,
    value: h.value,
    pct: total > 0 ? (h.value / total) * 100 : 0,
  }))

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-md p-4">
      <p className="text-[10px] uppercase tracking-widest text-[#7d8590] font-mono mb-3">
        Allocation
      </p>

      {loading ? (
        <Skeleton className="h-40" />
      ) : data.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-xs text-[#7d8590]">
          No holdings yet.
        </div>
      ) : (
        <>
          <div className="flex justify-center mb-3">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={32}
                  outerRadius={54}
                  paddingAngle={2}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload
                    return (
                      <div className="bg-[#161b22] border border-[#21262d] rounded px-2 py-1">
                        <p className="font-mono text-xs text-[#10b981]">{d.ticker}</p>
                        <p className="font-mono text-xs text-[#e6edf3]">{d.pct.toFixed(1)}%</p>
                      </div>
                    )
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5">
            {data.map((d, i) => (
              <div key={d.ticker} className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                <span className="font-mono text-[10px] text-[#10b981] w-12 flex-shrink-0">
                  {d.ticker}
                </span>
                <span className="font-mono text-[10px] text-[#7d8590]">{d.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
