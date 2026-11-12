// Y axis domain for Recharts: data min and max padded by 15% of the range on each side.
// The total range is never smaller than 2% of the largest absolute value, so a nearly
// flat period is not stretched to look volatile.
export function chartDomain(values) {
  const nums = (values ?? []).filter((v) => v != null).map(Number).filter(Number.isFinite)
  if (nums.length === 0) return [0, 1]

  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const pad = (max - min) * 0.15
  let low = min - pad
  let high = max + pad

  // Fall back to 1 when every value is 0
  const minRange = Math.max(Math.abs(min), Math.abs(max)) * 0.02 || 1
  if (high - low < minRange) {
    const mid = (min + max) / 2
    low = mid - minRange / 2
    high = mid + minRange / 2
  }

  return [low, high]
}

// Dollar tick formatter for a [low, high] domain. Recharts draws 5 ticks, so the step is
// about a quarter of the range; precision on the k value grows as the step shrinks.
export function dollarTickFormatter([low, high]) {
  const step = (high - low) / 4
  const decimals = step >= 1000 ? 0 : step >= 100 ? 1 : 2
  return (value) => {
    const sign = value < 0 ? '-' : ''
    const abs = Math.abs(value)
    if (abs < 1000) return `${sign}$${Math.round(abs)}`
    return `${sign}$${(abs / 1000).toFixed(decimals)}k`
  }
}
