'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  defs,
  linearGradient,
  stop,
} from 'recharts'

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatCurrency(value) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value}`
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-md px-3 py-2">
      <p className="text-xs text-[#7d8590] mb-1">{formatDate(label)}</p>
      <p className="text-sm font-mono text-[#10b981]">
        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
          payload[0].value,
        )}
      </p>
    </div>
  )
}

export default function NetWorthChart({ data = [] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-[#7d8590]">
        No snapshots yet. Add one to start tracking.
      </div>
    )
  }

  const chartData = data.map((s) => ({
    date: s.date,
    netWorth: s.net_worth,
  }))

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          tick={{ fill: '#7d8590', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatCurrency}
          tick={{ fill: '#7d8590', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={60}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="netWorth"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#nwGrad)"
          dot={false}
          activeDot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
