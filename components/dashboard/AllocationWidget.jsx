'use client'

import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, Label, ResponsiveContainer } from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'

const SLICE_COLORS = [
  '#10b981', // emerald
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#ef4444', // red
  '#06b6d4', // cyan
  '#f97316', // orange
  '#8b5cf6', // violet
  '#84cc16', // lime
]

function fmtCompact(v) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${Math.round(v / 1_000)}k`
  return `$${Math.round(v)}`
}

const fmt = (v) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(v)

function getAssetClass(ticker, description) {
  const t = (ticker || '').toLowerCase()
  const d = (description || '').toLowerCase()
  if (t === 'cash') return 'Cash'
  if (/bond|fixed|income|treasury|bnd|vbtlx|agg/.test(t + d)) return 'Fixed Income'
  if (/reit|real estate|property|vnq/.test(t + d)) return 'Real Estate'
  if (/international|intl|foreign|vxus|vtiax|eafe/.test(t + d)) return 'International'
  return 'Equities'
}

export default function AllocationWidget({ loading, holdings }) {
  const [view, setView] = useState('ticker')

  const total = holdings.reduce((s, h) => s + h.value, 0)

  let data
  if (view === 'class') {
    const classMap = {}
    holdings.forEach((h) => {
      if (h.value <= 0) return
      const cls = getAssetClass(h.ticker, h.description)
      classMap[cls] = (classMap[cls] || 0) + h.value
    })
    data = Object.entries(classMap)
      .map(([label, value]) => ({
        ticker: label,
        value,
        pct: total > 0 ? (value / total) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)
  } else {
    data = holdings
      .filter((h) => h.value > 0)
      .slice(0, 6)
      .map((h) => ({
        ticker: h.ticker,
        value: h.value,
        pct: total > 0 ? (h.value / total) * 100 : 0,
      }))
  }

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-md p-4">
      <div className="flex items-center justify-between mb-[10px]">
        <p
          className="text-[10px] uppercase text-[#7d8590] font-mono"
          style={{ letterSpacing: '0.08em' }}
        >
          Allocation
        </p>
        <div className="flex items-center gap-1">
          {[
            { id: 'ticker', label: 'Ticker' },
            { id: 'class', label: 'Class' },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => setView(opt.id)}
              className="font-mono transition-colors"
              style={{
                fontSize: 9,
                letterSpacing: '0.05em',
                padding: '2px 6px',
                borderRadius: 3,
                border: `1px solid ${view === opt.id ? '#10b981' : '#21262d'}`,
                background: view === opt.id ? 'rgba(16,185,129,0.12)' : 'transparent',
                color: view === opt.id ? '#10b981' : '#7d8590',
              }}
            >
              {opt.label.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-[120px]" />
      ) : data.length === 0 ? (
        <div className="min-h-[80px] flex items-center justify-center text-xs text-[#7d8590]">
          No holdings yet.
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div className="flex-shrink-0" style={{ width: 140, height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={36}
                  outerRadius={62}
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

          <div className="flex flex-col gap-1.5 w-full mt-3">
            {data.map((d, i) => (
              <div key={d.ticker} className="flex items-center gap-2 px-1">
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: SLICE_COLORS[i % SLICE_COLORS.length],
                  }}
                />
                <span
                  className="font-mono text-[11px] text-[#10b981] truncate"
                  style={{ minWidth: 0, maxWidth: 60 }}
                  title={d.ticker}
                >
                  {d.ticker}
                </span>
                <span className="font-mono text-[11px] text-[#e6edf3] flex-1 text-right">
                  {d.pct.toFixed(1)}%
                </span>
                <span className="font-mono text-[10px] text-[#7d8590] w-14 text-right">
                  {fmt(d.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
