'use client'

import { useState, useEffect, useRef } from 'react'
import {
  AreaChart,
  Area,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { fmt } from '@/lib/format'

const formatDate = (dateStr) => {
  try {
    if (!dateStr) return ''
    const clean = String(dateStr).split('T')[0]
    const parts = clean.split('-')
    if (parts.length !== 3) return String(dateStr)
    const year = parseInt(parts[0])
    const month = parseInt(parts[1]) - 1
    const day = parseInt(parts[2])
    if (isNaN(year) || isNaN(month) || isNaN(day)) return String(dateStr)
    return new Date(year, month, day).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return String(dateStr || '')
  }
}

const CustomTooltip = ({ active, payload, label }) => {
  try {
    if (!active || !payload || !payload.length) return null
    return (
      <div className="bg-[#161b22] border border-[#21262d] rounded-md px-3 py-2">
        <p className="text-xs text-[#7d8590] mb-1">{formatDate(label)}</p>
        <p className="font-mono text-sm font-semibold text-[#10b981]">
          {fmt(payload[0]?.value ?? 0)}
        </p>
      </div>
    )
  } catch {
    return null
  }
}

const RANGES = [
  { id: 30, label: '30D' },
  { id: 90, label: '90D' },
  { id: 365, label: '1Y' },
]

export default function AccountTrendChart({ accountId, accountName, currentValue }) {
  const [days, setDays] = useState(90)
  const [trend, setTrend] = useState([])
  const [loading, setLoading] = useState(true)
  const cache = useRef({})

  useEffect(() => {
    const cacheKey = `${accountId ?? 'all'}-${days}`
    if (cache.current[cacheKey]) {
      setTrend(cache.current[cacheKey])
      setLoading(false)
      return
    }

    let cancelled = false
    async function fetchTrend() {
      setLoading(true)
      try {
        const params = new URLSearchParams({ days: String(days) })
        if (accountId) params.set('accountId', accountId)
        const res = await fetch(`/api/holdings/account-trend?${params}`)
        const data = await res.json()
        if (!cancelled) {
          const t = data.trend ?? []
          cache.current[cacheKey] = t
          setTrend(t)
        }
      } catch {
        if (!cancelled) setTrend([])
      }
      if (!cancelled) setLoading(false)
    }
    fetchTrend()
    return () => { cancelled = true }
  }, [accountId, days])

  // Clear cache when account changes
  useEffect(() => {
    cache.current = {}
  }, [accountId])

  const firstVal = trend.length >= 2 ? trend[0].total : null
  const lastVal = trend.length >= 2 ? trend[trend.length - 1].total : null
  const change = firstVal != null && lastVal != null ? lastVal - firstVal : null
  const changePct = change != null && firstVal > 0 ? (change / firstVal) * 100 : null
  const positive = change != null ? change >= 0 : true

  // Compute actual days of data
  const actualDays = trend.length >= 2
    ? Math.round(
        (new Date(trend[trend.length - 1].date.split('T')[0]) -
         new Date(trend[0].date.split('T')[0])) /
        (1000 * 60 * 60 * 24)
      )
    : 0

  const periodLabel = actualDays < 7
    ? `past ${actualDays} day${actualDays !== 1 ? 's' : ''}`
    : actualDays < 25
      ? `past ${actualDays} days`
      : days === 365
        ? 'past year'
        : `past ${days} days`

  const sparseData = actualDays > 0 && actualDays < days / 2
  const showDots = trend.length < 14

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-md p-4 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <p
          className="text-[10px] uppercase text-[#7d8590] font-mono truncate"
          style={{ letterSpacing: '0.08em' }}
          title={accountName}
        >
          {accountName || 'Trend'}
        </p>
        <div className="flex items-center gap-1 flex-shrink-0">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setDays(r.id)}
              className="font-mono transition-colors"
              style={{
                fontSize: 9,
                letterSpacing: '0.05em',
                padding: '2px 6px',
                borderRadius: 3,
                border: `1px solid ${days === r.id ? '#10b981' : '#21262d'}`,
                background: days === r.id ? 'rgba(16,185,129,0.12)' : 'transparent',
                color: days === r.id ? '#10b981' : '#7d8590',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Value + change */}
      <div className="mb-2">
        <p className="font-mono text-lg font-semibold text-[#e6edf3]">
          {currentValue != null ? fmt(currentValue) : '--'}
        </p>
        {change != null && (
          <p className="font-mono" style={{ fontSize: 11, color: positive ? '#34d399' : '#f87171' }}>
            {positive ? '+' : ''}{fmt(change)}
            {changePct != null && ` (${positive ? '+' : ''}${changePct.toFixed(2)}%)`}
            <span style={{ color: '#7d8590', marginLeft: 6, fontSize: 10 }}>
              {periodLabel}
            </span>
          </p>
        )}
        {sparseData && (
          <p style={{ fontSize: 10, color: '#7d8590', marginTop: 2 }}>
            Showing {actualDays} days of available data
          </p>
        )}
      </div>

      {/* Chart */}
      {loading ? (
        <Skeleton className="h-[120px]" />
      ) : trend.length === 0 ? (
        <div className="flex items-center justify-center" style={{ height: 120 }}>
          <p className="text-center" style={{ fontSize: 11, color: '#7d8590' }}>
            Building history - check back after a few nightly syncs
          </p>
        </div>
      ) : trend.length === 1 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: 120,
            gap: 4,
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }} />
          <p style={{ fontSize: 11, color: '#7d8590' }}>First data point recorded</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={trend} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="acctTrendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <ReferenceLine
              y={trend[0]?.total}
              stroke="#21262d"
              strokeDasharray="4 4"
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: '#7d8590', strokeWidth: 1, strokeDasharray: '3 3' }}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#acctTrendGrad)"
              dot={showDots ? { fill: '#10b981', r: 3, strokeWidth: 0 } : false}
              activeDot={showDots ? { r: 5, fill: '#34d399' } : { r: 3, fill: '#10b981', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
