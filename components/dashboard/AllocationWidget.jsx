'use client'

import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, Label } from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { fmtCompact } from '@/lib/format'

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

const CLASS_COLORS = {
  'Cash': '#6b7280',
  'Fixed Income': '#3b82f6',
  'Real Estate': '#f59e0b',
  'International': '#8b5cf6',
  'US Large Cap': '#10b981',
  'US Mid/Small Cap': '#34d399',
  'Balanced': '#06b6d4',
  'Sector': '#ef4444',
  'US Equities': '#065f46',
}

function getAssetClass(ticker, description) {
  const t = (ticker || '').toLowerCase()
  const d = (description || '').toLowerCase()
  const td = t + ' ' + d
  if (t === 'cash') return 'Cash'
  if (/bond|fixed income|income fund|treasury|government|corporate bond|bnd|agg|lqd|vbtlx|tlt|shy/.test(td)) return 'Fixed Income'
  if (/reit|real estate|property|vnq|schh/.test(td)) return 'Real Estate'
  if (/international|intl|foreign|emerging market|global|world|eafe|vxus|vtiax|veu|efa|vwo|fspsx|dldrx/.test(td)) return 'International'
  if (/large cap|s&p 500|500 index|large-cap|sp500|fxaix|voo|spy|ivv|schx|seegx|pcbix|astlv/.test(td)) return 'US Large Cap'
  if (/small cap|mid cap|small-cap|mid-cap|extended market|completion|iwm|vb|vxf|vimax|mvckx/.test(td)) return 'US Mid/Small Cap'
  if (/balanced|target|allocation|moderate|conservative|growth|prwcx|vwenx/.test(td)) return 'Balanced'
  if (/sector|energy|technology|health|financial|utility|xle|pxe|igv|dgro|dfcex|dffvx/.test(td)) return 'Sector'
  return 'US Equities'
}

export default function AllocationWidget({ loading, holdings }) {
  const [view, setView] = useState('ticker')

  const total = holdings.reduce((s, h) => s + h.value, 0)

  // Build legend data and donut data separately
  let legendData = []
  let donutData = []

  if (view === 'class') {
    const classMap = {}
    holdings.forEach((h) => {
      if (h.value <= 0) return
      const cls = getAssetClass(h.ticker, h.description)
      classMap[cls] = (classMap[cls] || 0) + h.value
    })
    legendData = Object.entries(classMap)
      .map(([label, value]) => ({
        label,
        value,
        pct: total > 0 ? (value / total) * 100 : 0,
        color: CLASS_COLORS[label] ?? '#7d8590',
      }))
      .sort((a, b) => b.value - a.value)
    donutData = legendData
  } else {
    // Ticker view: assign colors, track original ticker for CASH grouping
    let colorIdx = 0
    const allItems = holdings
      .filter((h) => h.value > 0)
      .map((h) => {
        const isCash = h.ticker === 'CASH'
        const fullLabel = h.description || h.ticker
        const label = fullLabel.length > 22 ? fullLabel.substring(0, 22) : fullLabel
        return {
          label,
          fullLabel,
          origTicker: h.ticker,
          value: h.value,
          pct: total > 0 ? (h.value / total) * 100 : 0,
          color: isCash ? '#6b7280' : SLICE_COLORS[colorIdx++ % SLICE_COLORS.length],
        }
      })

    legendData = allItems

    // Group all CASH items into a single donut slice
    const cashTotal = allItems.filter((d) => d.origTicker === 'CASH').reduce((s, d) => s + d.value, 0)
    const nonCashItems = allItems.filter((d) => d.origTicker !== 'CASH')
    const cashPct = total > 0 ? (cashTotal / total) * 100 : 0
    donutData = cashTotal > 0
      ? [...nonCashItems, { label: 'Cash', fullLabel: 'Cash', origTicker: 'CASH', value: cashTotal, pct: cashPct, color: '#6b7280' }]
      : nonCashItems
  }

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-md p-4" style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
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
        <Skeleton className="h-[180px]" />
      ) : donutData.length === 0 ? (
        <div className="min-h-[80px] flex items-center justify-center text-xs text-[#7d8590]">
          No holdings yet.
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: 16, minWidth: 0, overflow: 'hidden', minHeight: 0 }}>
          {/* Donut */}
          <div style={{ width: 180, height: 180, flexShrink: 0 }}>
            <PieChart width={180} height={180}>
              <Pie
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {donutData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
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
                      <p className="font-mono text-xs" style={{ color: d.color }}>{d.label}</p>
                      <p className="font-mono text-xs text-[#e6edf3]">{d.pct.toFixed(1)}%</p>
                    </div>
                  )
                }}
              />
            </PieChart>
          </div>

          {/* Legend */}
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', overflowX: 'hidden', paddingRight: 14, display: 'flex', flexDirection: 'column', gap: 5, minHeight: 0, maxHeight: 320 }}>
            {legendData.map((d, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '10px 1fr 42px', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
                <span style={{ fontSize: 11, color: '#e6edf3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.fullLabel ?? d.label}>
                  {d.fullLabel ?? d.label}
                </span>
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#7d8590', textAlign: 'right' }}>
                  {d.pct.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
