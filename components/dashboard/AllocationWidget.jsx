'use client'

import { PieChart, Pie, Cell, Tooltip, Label, ResponsiveContainer } from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'

const SLICE_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ef4444', // red
  '#06b6d4', // cyan
]

function fmtCompact(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${Math.round(v / 1_000)}k`
  return `$${Math.round(v)}`
}

export default function AllocationWidget({ loading, holdings }) {
  const total = holdings.reduce((s, h) => s + h.value, 0)

  const data = holdings.slice(0, 6).map((h) => ({
    ticker: h.ticker,
    value: h.value,
    pct: total > 0 ? (h.value / total) * 100 : 0,
  }))

  const twoCol = data.length > 3

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-md p-4 h-full">
      <p className="text-[10px] uppercase text-[#7d8590] font-mono mb-[10px]" style={{ letterSpacing: '0.08em' }}>
        Allocation
      </p>

      {loading ? (
        <Skeleton className="h-40" />
      ) : data.length === 0 ? (
        <div className="min-h-[160px] flex items-center justify-center text-xs text-[#7d8590]">
          No holdings yet.
        </div>
      ) : (
        <>
          <div className="flex justify-center mb-3">
            <ResponsiveContainer width="100%" height={120}>
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
                    <Cell key={i} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
                  ))}
                  <Label
                    content={({ viewBox }) => {
                      const { cx, cy } = viewBox
                      return (
                        <text
                          x={cx}
                          y={cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="#e6edf3"
                          fontSize={11}
                          fontFamily="monospace"
                        >
                          {fmtCompact(total)}
                        </text>
                      )
                    }}
                  />
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

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: twoCol ? '1fr 1fr' : '1fr',
              gap: 6,
            }}
          >
            {data.map((d, i) => (
              <div key={d.ticker} className="flex items-center gap-1.5 min-w-0">
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: SLICE_COLORS[i % SLICE_COLORS.length],
                  }}
                />
                <span
                  className="font-mono truncate"
                  style={{ fontSize: 10, color: '#7d8590', flex: 1, minWidth: 0 }}
                  title={d.ticker}
                >
                  {d.ticker.slice(0, 10)}
                </span>
                <span
                  className="font-mono flex-shrink-0"
                  style={{ fontSize: 10, color: '#e6edf3' }}
                >
                  {d.pct.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
