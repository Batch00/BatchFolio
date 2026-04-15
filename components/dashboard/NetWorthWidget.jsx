'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { fmt, fmtCompact } from '@/lib/format'

const RANGES = [
  { id: 'today', label: 'TODAY' },
  { id: '30d', label: '30D' },
  { id: '90d', label: '90D' },
  { id: '1y', label: '1Y' },
]

export default function NetWorthWidget({
  loading,
  netWorth,
  totalAssets,
  totalLiabilities,
  changeDollar,
  changePct,
  changePositive,
  rangeLabel,
  range,
  onRangeChange,
}) {
  return (
    <div className="bg-[#161b22] border border-[#10b981]/40 rounded-md p-4 h-full flex flex-col">
      <p
        className="text-[10px] uppercase text-[#7d8590] font-mono mb-3"
        style={{ letterSpacing: '0.08em' }}
      >
        Net Worth
      </p>

      {loading ? (
        <>
          <Skeleton className="h-12 w-48 mb-2" />
          <Skeleton className="h-4 w-36 mb-4" />
          <div className="flex gap-2 mb-3">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-12 flex-1" />
            ))}
          </div>
          <Skeleton className="h-6 w-40" />
        </>
      ) : (
        <>
          <p
            className="font-mono font-semibold text-[#e6edf3] leading-none mb-2"
            style={{ fontSize: 48 }}
          >
            {fmt(netWorth)}
          </p>

          <p className="mb-4">
            <span
              className={`font-mono text-sm ${
                changePositive ? 'text-[#34d399]' : 'text-[#f87171]'
              }`}
            >
              {changePositive ? '+' : ''}
              {fmt(changeDollar)}
              {'  '}
              {changePositive ? '+' : ''}
              {changePct.toFixed(2)}%
            </span>
            <span className="text-[#7d8590] text-xs ml-2">{rangeLabel}</span>
          </p>

          <div className="flex gap-2 mb-4">
            <div className="bg-[#0d1117] rounded px-2.5 py-2 flex-1" title="Current market value of all your accounts">
              <p
                className="uppercase tracking-wider text-[#7d8590] mb-1"
                style={{ fontSize: 9 }}
              >
                Assets
              </p>
              <p className="font-mono text-[13px] text-[#e6edf3]">
                {fmtCompact(totalAssets)}
              </p>
            </div>
            <div className="bg-[#0d1117] rounded px-2.5 py-2 flex-1" title="Total outstanding debt and credit balances">
              <p
                className="uppercase tracking-wider text-[#7d8590] mb-1"
                style={{ fontSize: 9 }}
              >
                Liabilities
              </p>
              <p className="font-mono text-[13px] text-[#f87171]">
                {fmtCompact(totalLiabilities)}
              </p>
            </div>
          </div>

          <div className="flex gap-0.5 bg-[#21262d] rounded p-0.5 w-fit mt-auto">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => onRangeChange(r.id)}
                className={`px-2.5 py-1 text-[10px] rounded font-mono transition-colors ${
                  range === r.id
                    ? 'bg-[#10b981] text-white'
                    : 'text-[#7d8590] hover:text-[#e6edf3]'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
