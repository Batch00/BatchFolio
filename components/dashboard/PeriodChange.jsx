'use client'

import { useState, useEffect } from 'react'
import { fmt, fmtPercent } from '@/lib/format'

export const PERIODS = ['1D', '7D', '30D', '90D', 'YTD']
// Enough history for the longest period (YTD on Dec 31 reaches back to the prior Dec 31)
export const PERIOD_HISTORY_DAYS = 370

const STORAGE_KEY = 'batchfolio.holdingsPeriod'
const PERIOD_DAYS = { '7D': 7, '30D': 30, '90D': 90 }

function shiftDate(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

function formatShortDate(dateStr) {
  const parts = dateStr.split('-')
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Selected period shared by the Accounts and Portfolio tabs, remembered per browser
export function useHoldingsPeriod() {
  const [period, setPeriod] = useState('7D')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (PERIODS.includes(saved)) setPeriod(saved)
    } catch {}
  }, [])

  function cyclePeriod() {
    const next = PERIODS[(PERIODS.indexOf(period) + 1) % PERIODS.length]
    setPeriod(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {}
  }

  return [period, cyclePeriod]
}

// Price change over the period from nightly holding snapshots, applied to current shares.
// Returns null when there are fewer than two snapshots. `since` is set when the history
// does not reach back to the period start.
export function computePeriodChange(history, period, shares) {
  // A ticker held in several accounts has one snapshot per holding per day; keep one per date
  const byDate = new Map()
  for (const s of history || []) {
    if (s.price > 0) byDate.set(s.date, s.price)
  }
  const points = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  if (points.length < 2) return null

  const [latestDate, latestPrice] = points[points.length - 1]
  let target
  if (period === '1D') target = points[points.length - 2][0]
  else if (period === 'YTD') target = `${parseInt(latestDate.slice(0, 4)) - 1}-12-31`
  else target = shiftDate(latestDate, -PERIOD_DAYS[period])

  // Latest snapshot on or before the period start, else the oldest one we have
  let base = points[0]
  let partial = true
  for (const p of points) {
    if (p[0] > target) break
    base = p
    partial = false
  }
  if (base[0] === latestDate) return null

  const [baseDate, basePrice] = base
  return {
    dollarChange: (latestPrice - basePrice) * shares,
    pctChange: ((latestPrice - basePrice) / basePrice) * 100,
    since: partial ? baseDate : null,
  }
}

export function PeriodHeader({ period, onCycle, className }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onCycle()
      }}
      title="Tap to change period"
      className={`uppercase hover:text-[#e6edf3] transition-colors border-b border-dashed border-[#7d8590]/60 ${className || ''}`}
    >
      {period}
    </button>
  )
}

export function PeriodChangeCell({ change }) {
  if (!change) {
    return <span className="font-mono text-xs text-[#7d8590]">--</span>
  }
  const flat = Math.abs(change.pctChange) < 0.005
  const pos = change.dollarChange >= 0
  const color = flat ? 'text-[#7d8590]' : pos ? 'text-[#34d399]' : 'text-[#f87171]'
  return (
    <div className={`font-mono text-xs md:text-[13px] ${color}`}>
      <div>{pos && !flat ? '+' : ''}{fmt(flat ? 0 : change.dollarChange)}</div>
      <div>{flat ? '0.00%' : fmtPercent(change.pctChange)}</div>
      {change.since && (
        <div style={{ fontSize: 10, color: '#7d8590' }}>since {formatShortDate(change.since)}</div>
      )}
    </div>
  )
}
