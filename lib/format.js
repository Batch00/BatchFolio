export function fmt(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n ?? 0)
}

export function fmtCompact(v) {
  if (v == null) return '--'
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return '$' + (v / 1_000_000).toFixed(1) + 'M'
  if (abs >= 1_000) return '$' + (v / 1_000).toFixed(1) + 'K'
  return fmt(v)
}

export function fmtPercent(n, opts = {}) {
  const { sign = true } = opts
  const val = (n ?? 0).toFixed(2) + '%'
  return sign && n >= 0 ? '+' + val : val
}

export function fmtShares(n) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 4,
  }).format(n ?? 0)
}

export function fmtMarketCap(v) {
  if (v == null) return '--'
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}T`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(2)}B`
  return `$${v.toFixed(2)}M`
}
