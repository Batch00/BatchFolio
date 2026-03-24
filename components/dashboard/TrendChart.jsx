'use client'

import { useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'

const RANGES = ['30D', '90D', '1Y']

function formatDateShort(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDateFull(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-md px-3 py-2">
      <p className="text-xs text-[#7d8590] mb-1">{formatDateFull(label)}</p>
      <p className="text-base font-mono font-semibold text-[#10b981]">
        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
          payload[0].value,
        )}
      </p>
    </div>
  )
}

export default function TrendChart({ loading, snapshots }) {
  const [range, setRange] = useState('30D')

  const days = range === '30D' ? 30 : range === '90D' ? 90 : 365
  const filtered = snapshots.slice(-days)
  const chartData = filtered.map((s) => ({ date: s.date, netWorth: s.net_worth }))

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-md p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] uppercase text-[#7d8590] font-mono" style={{ letterSpacing: '0.08em' }}>
          Net Worth Trend
        </p>
        <div className="flex gap-0.5 bg-[#21262d] rounded p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2 py-0.5 text-[10px] rounded font-mono transition-colors ${
                range === r ? 'bg-[#10b981] text-white' : 'text-[#7d8590] hover:text-[#e6edf3]'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-40 flex-1" />
      ) : chartData.length === 0 ? (
        <div className="flex-1 min-h-[160px] flex items-center justify-center px-4">
          <p className="text-center text-xs text-[#7d8590]">
            Your net worth history will appear here. The first snapshot is recorded automatically at midnight tonight.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160} className="flex-1">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateShort}
              tick={{ fill: '#7d8590', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="netWorth"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#trendGrad)"
              dot={false}
              activeDot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
