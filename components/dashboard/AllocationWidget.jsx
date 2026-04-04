'use client'

import { PieChart, Pie, Cell, Tooltip, Label, ResponsiveContainer } from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'

const SLICE_COLORS = [
  '#10b981',
  '#3b82f6',
  '#f59e0b',
  '#8b5cf6',
  '#ef4444',
  '#06b6d4',
]

function fmtCompact(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${Math.round(v / 1_000)}k`
  return `$${Math.round(v)}`
}

const fmt = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)

export default function AllocationWidget({ loading, holdings }) {
  const total = holdings.reduce((s, h) => s + h.value, 0)

  const data = holdings.slice(0, 6).map((h) => ({
    ticker: h.ticker,
    value: h.value,
    pct: total > 0 ? (h.value / total) * 100 : 0,
  }))

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-md p-4">
      <p
        className="text-[10px] uppercase text-[#7d8590] font-mono mb-[10px]"
        style={{ letterSpacing: '0.08em' }}
      >
        Allocation
      </p>

      {loading ? (
        <Skeleton className="h-[120px]" />
      ) : data.length === 0 ? (
        <div className="min-h-[80px] flex items-center justify-center text-xs text-[#7d8590]">
          No holdings yet.
        </div>
      ) : (
        <div className="flex items-center gap-6">
          {/* Donut chart */}
          <div className="flex-shrink-0" style={{ width: 120, height: 120 }}>
            <ResponsiveContainer width="100%" height="100%">
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

          {/* Legend pills */}
          <div className="flex flex-wrap gap-2 flex-1">
            {data.map((d, i) => (
              <div
                key={d.ticker}
                className="flex items-center gap-1.5 bg-[#0d1117] rounded px-2.5 py-1.5"
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: SLICE_COLORS[i % SLICE_COLORS.length],
                  }}
                />
                <span className="font-mono text-[11px] text-[#7d8590]">{d.ticker}</span>
                <span className="font-mono text-[11px] text-[#e6edf3]">{d.pct.toFixed(1)}%</span>
                <span className="font-mono text-[10px] text-[#7d8590]">{fmt(d.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
