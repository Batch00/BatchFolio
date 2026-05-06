'use client'

import { useState, useEffect } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { fmt } from '@/lib/format'

function MoverRow({ m, maxPct, positive, onOpenDrawer, isLast }) {
  const barWidth = maxPct > 0 ? (Math.abs(m.pctChange) / maxPct) * 100 : 0
  const color = positive ? '#34d399' : '#f87171'
  const desc = m.description
    ? m.description.length > 18 ? m.description.substring(0, 18) : m.description
    : null

  return (
    <button
      onClick={() => onOpenDrawer(m.ticker)}
      className="w-full text-left"
      style={{ padding: '8px 0', borderBottom: isLast ? 'none' : '1px solid #21262d' }}
    >
      <div className="flex items-start justify-between">
        <div style={{ minWidth: 0, flex: 1 }}>
          <span className="font-mono text-xs text-[#10b981]" style={{ fontWeight: 500 }}>
            {m.ticker}
          </span>
          {desc && (
            <p
              style={{
                fontSize: 10,
                color: '#7d8590',
                marginTop: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {desc}
            </p>
          )}
        </div>
        <div className="text-right flex-shrink-0 ml-2">
          <span className="font-mono text-xs" style={{ color }}>
            {positive ? '+' : ''}{m.pctChange.toFixed(2)}%
          </span>
          <p className="font-mono" style={{ fontSize: 10, color: '#7d8590' }}>
            {m.dollarChange >= 0 ? '+' : ''}{fmt(m.dollarChange)}
          </p>
        </div>
      </div>
      <div
        style={{
          height: 3,
          borderRadius: 2,
          background: '#21262d',
          marginTop: 4,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${barWidth}%`,
            background: color,
            borderRadius: 2,
          }}
        />
      </div>
    </button>
  )
}

export default function MoversWidget({ onOpenDrawer }) {
  const [movers, setMovers] = useState({ gainers: [], losers: [], hasData: false })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/holdings/movers?days=7')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setMovers({ gainers: [], losers: [], hasData: false })
        } else {
          setMovers(data)
        }
      })
      .catch(() => setMovers({ gainers: [], losers: [], hasData: false }))
      .finally(() => setLoading(false))
  }, [])

  const gainerMax = movers.gainers.length > 0
    ? Math.max(...movers.gainers.map((m) => Math.abs(m.pctChange)))
    : 1
  const loserMax = movers.losers.length > 0
    ? Math.max(...movers.losers.map((m) => Math.abs(m.pctChange)))
    : 1

  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-md p-4 h-full">
      <div className="flex items-center justify-between mb-[10px]">
        <p
          className="text-[10px] uppercase text-[#7d8590] font-mono"
          style={{ letterSpacing: '0.08em' }}
        >
          Top Movers
        </p>
        <p
          className="text-[10px] uppercase text-[#7d8590] font-mono"
          style={{ letterSpacing: '0.08em' }}
        >
          Past 7 Days
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[0, 1].map((col) => (
            <div key={col} className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ))}
        </div>
      ) : !movers.hasData ? (
        <div className="min-h-[80px] flex items-center justify-center">
          <p className="text-[#7d8590] text-center" style={{ fontSize: 11 }}>
            No snapshot data yet. Returns populate after the first nightly sync.
          </p>
        </div>
      ) : movers.gainers.length === 0 && movers.losers.length === 0 ? (
        <div className="min-h-[80px] flex items-center justify-center">
          <p className="text-[#7d8590] text-center" style={{ fontSize: 11 }}>
            No price changes in the past 7 days
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <p
              className="font-mono uppercase"
              style={{ fontSize: 9, color: '#34d399', marginBottom: 8, letterSpacing: '0.06em' }}
            >
              Gainers
            </p>
            {movers.gainers.length === 0 ? (
              <p style={{ fontSize: 10, color: '#7d8590' }}>None</p>
            ) : (
              <div>
                {movers.gainers.map((m, i) => (
                  <MoverRow
                    key={m.ticker}
                    m={m}
                    maxPct={gainerMax}
                    positive
                    onOpenDrawer={onOpenDrawer}
                    isLast={i === movers.gainers.length - 1}
                  />
                ))}
              </div>
            )}
          </div>
          <div>
            <p
              className="font-mono uppercase"
              style={{ fontSize: 9, color: '#f87171', marginBottom: 8, letterSpacing: '0.06em' }}
            >
              Losers
            </p>
            {movers.losers.length === 0 ? (
              <p style={{ fontSize: 10, color: '#7d8590' }}>None</p>
            ) : (
              <div>
                {movers.losers.map((m, i) => (
                  <MoverRow
                    key={m.ticker}
                    m={m}
                    maxPct={loserMax}
                    positive={false}
                    onOpenDrawer={onOpenDrawer}
                    isLast={i === movers.losers.length - 1}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
