'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const EMERALD_SHADES = [
  '#10b981',
  '#059669',
  '#34d399',
  '#047857',
  '#6ee7b7',
  '#065f46',
  '#a7f3d0',
]

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-md px-3 py-2">
      <p className="text-xs text-[#7d8590] mb-1">{name}</p>
      <p className="text-sm font-mono text-[#e6edf3]">{formatCurrency(value)}</p>
    </div>
  )
}

export default function AllocationChart({ data = [] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-[#7d8590]">
        No holdings to display.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={70}
          outerRadius={110}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={EMERALD_SHADES[index % EMERALD_SHADES.length]}
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value) => (
            <span className="text-xs text-[#7d8590]">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
