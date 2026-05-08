'use client'

import { useState, useEffect, useRef } from 'react'
import {
  AreaChart,
  Area,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { fmt } from '@/lib/format'

function formatDateFull(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const RANGES = [
  { id: 30, label: '30D' },
  { id: 90, label: '90D' },
  { id: 365, label: '1Y' },
]

const PERIOD_LABELS = {
  30: 'past 30 days',
  90: 'past 90 days',
  365: 'past year',
}

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
              {PERIOD_LABELS[days] || `past ${days} days`}
            </span>
          </p>
        )}
      </div>

      {/* Chart */}
      {loading ? (
        <Skeleton className="h-[120px]" />
      ) : trend.length < 2 ? (
        <div className="flex items-center justify-center" style={{ height: 120 }}>
          <p className="text-center" style={{ fontSize: 11, color: '#7d8590' }}>
            Building history - check back after a few nightly syncs
          </p>
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
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                return (
                  <div className="bg-[#161b22] border border-[#21262d] rounded-md px-3 py-2">
                    <p className="text-xs text-[#7d8590] mb-1">{formatDateFull(label)}</p>
                    <p className="font-mono text-sm font-semibold text-[#10b981]">
                      {fmt(payload[0].value)}
                    </p>
                  </div>
                )
              }}
              cursor={{ stroke: '#7d8590', strokeWidth: 1, strokeDasharray: '3 3' }}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#acctTrendGrad)"
              dot={false}
              activeDot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
