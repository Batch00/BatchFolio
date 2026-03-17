import { cn } from '@/lib/utils'

function fmt(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0)
}

export default function StatCard({ label, value, negative = false, highlight = false }) {
  return (
    <div
      className={cn(
        'bg-[#161b22] border rounded-md p-4',
        highlight ? 'border-[#10b981]/40' : 'border-[#21262d]',
      )}
    >
      <p className="text-xs text-[#7d8590] mb-2 uppercase tracking-wide">{label}</p>
      <p
        className={cn(
          'text-2xl font-mono font-semibold',
          negative ? 'text-[#f87171]' : highlight ? 'text-[#10b981]' : 'text-[#e6edf3]',
        )}
      >
        {fmt(value)}
      </p>
    </div>
  )
}
