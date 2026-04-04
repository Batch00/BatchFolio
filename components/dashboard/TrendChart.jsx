'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'

function formatMonth(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' })
}

function formatDateFull(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatYAxis(value) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`
  return `$${value}`
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

export default function TrendChart({ loading, snapshots, range }) {
  const days =
    range === 'today' || range === '30d' ? 30 : range === '90d' ? 90 : 365
  const filtered = snapshots.slice(-days)
  const chartData = filtered.map((s) => ({ date: s.date, netWorth: s.net_worth }))

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-md p-4 h-full flex flex-col">
      <p
        className="text-[10px] uppercase text-[#7d8590] font-mono mb-3"
        style={{ letterSpacing: '0.08em' }}
      >
        Net Worth Trend
      </p>

      {loading ? (
        <Skeleton className="h-[200px] flex-1" />
      ) : chartData.length === 0 ? (
        <div className="flex-1 min-h-[200px] flex items-center justify-center px-4">
          <p className="text-center text-xs text-[#7d8590]">
            Your net worth history will appear here. The first snapshot is recorded automatically at midnight tonight.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200} className="flex-1">
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
              tickFormatter={formatMonth}
              tick={{ fill: '#7d8590', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              tickFormatter={formatYAxis}
              tick={{ fill: '#7d8590', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={50}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#7d8590', strokeWidth: 1, strokeDasharray: '3 3' }} />
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
