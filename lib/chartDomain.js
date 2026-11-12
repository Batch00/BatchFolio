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
