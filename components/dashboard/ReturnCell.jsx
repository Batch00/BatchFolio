'use client'

import { fmt } from '@/lib/format'

function formatShortDate(dateStr) {
  const parts = dateStr.split('-')
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function ReturnCell({ ticker, avgCostBasis, currentPrice, shares, isSynced, periodReturn, loading }) {
  if (ticker === 'CASH') {
    return <span className="text-xs md:text-[13px]" style={{ color: '#7d8590', fontFamily: 'monospace' }}>--</span>
  }

  const hasCostBasis = avgCostBasis > 0 && currentPrice > 0 && !isSynced

  if (hasCostBasis) {
    const gainDollar = (currentPrice - avgCostBasis) * shares
    const gainPct = ((currentPrice - avgCostBasis) / avgCostBasis) * 100
    const positive = gainDollar >= 0
    return (
      <span className="text-xs md:text-[13px]" style={{
        color: positive ? '#34d399' : '#f87171',
        fontFamily: 'monospace',
      }}>
        {positive ? '+' : ''}{fmt(gainDollar)}{' '}
        ({positive ? '+' : ''}{gainPct.toFixed(2)}%)
      </span>
    )
  }

  if (loading) {
    return <span className="text-xs md:text-[13px]" style={{ color: '#7d8590', fontFamily: 'monospace' }}>...</span>
  }

  if (!periodReturn?.hasData) {
    return <span className="text-xs md:text-[13px]" style={{ color: '#7d8590', fontFamily: 'monospace' }}>--</span>
  }

  const { dollarChange, pricePctChange, startDate } = periodReturn
  const positive = dollarChange >= 0

  return (
    <div className="text-xs md:text-[13px]" style={{ fontFamily: 'monospace' }}>
      <span style={{ color: positive ? '#34d399' : '#f87171' }}>
        {positive ? '+' : ''}{fmt(dollarChange)}{' '}
        ({positive ? '+' : ''}{pricePctChange.toFixed(2)}%)
      </span>
      <div style={{ fontSize: 10, color: '#7d8590', marginTop: 1 }}>
        since {formatShortDate(startDate)}
      </div>
    </div>
  )
}
