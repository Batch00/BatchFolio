'use client'

import { Skeleton } from '@/components/ui/skeleton'

const fmt = (v) =>
  v == null
    ? '--'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v)

const fmtCompact = (v) => {
  if (v == null) return '--'
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`
  return fmt(v)
}

export default function NetWorthWidget({
  loading,
  netWorth,
  totalAssets,
  totalLiabilities,
  dayChange,
  dayChangePct,
  dayPositive,
}) {
  return (
    <div className="bg-[#161b22] border border-[#10b981]/40 rounded-md p-4 h-full">
      <p className="text-[10px] uppercase text-[#7d8590] font-mono mb-[10px]" style={{ letterSpacing: '0.08em' }}>
        Net Worth
      </p>

      {loading ? (
        <>
          <Skeleton className="h-9 w-44 mb-2" />
          <Skeleton className="h-4 w-32 mb-4" />
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="font-mono text-3xl font-semibold text-[#e6edf3] leading-none mb-1">
            {fmt(netWorth)}
          </p>
          <p
            className={`font-mono text-xs mb-4 ${
              dayPositive ? 'text-[#34d399]' : 'text-[#f87171]'
            }`}
          >
            {dayPositive ? '+' : ''}
            {fmt(dayChange)} ({dayPositive ? '+' : ''}
            {dayChangePct.toFixed(2)}%) today
          </p>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-[#0d1117] rounded px-2 py-2">
              <p className="text-[9px] uppercase tracking-wider text-[#7d8590] mb-1">Assets</p>
              <p className="font-mono text-xs text-[#e6edf3]">{fmtCompact(totalAssets)}</p>
            </div>
            <div className="bg-[#0d1117] rounded px-2 py-2">
              <p className="text-[9px] uppercase tracking-wider text-[#7d8590] mb-1">Liabilities</p>
              <p className="font-mono text-xs text-[#f87171]">{fmtCompact(totalLiabilities)}</p>
            </div>
            <div className="bg-[#0d1117] rounded px-2 py-2">
              <p className="text-[9px] uppercase tracking-wider text-[#7d8590] mb-1">30D Chg</p>
              <p
                className={`font-mono text-xs ${
                  dayPositive ? 'text-[#34d399]' : 'text-[#f87171]'
                }`}
              >
                {dayPositive ? '+' : ''}
                {fmtCompact(dayChange)}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
