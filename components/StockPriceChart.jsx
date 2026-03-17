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

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-md px-3 py-2">
      <p className="text-xs text-[#7d8590] mb-1">{formatDate(label)}</p>
      <p className="text-sm font-mono text-[#10b981]">
        ${payload[0].value?.toFixed(2)}
      </p>
    </div>
  )
}

export default function StockPriceChart({ candles = [] }) {
  if (candles.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-[#7d8590]">
        No chart data available.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={candles} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1">
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
          minTickGap={40}
        />
        <YAxis
          domain={['auto', 'auto']}
          tickFormatter={(v) => `$${v}`}
          tick={{ fill: '#7d8590', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={60}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="close"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#stockGrad)"
          dot={false}
          activeDot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
