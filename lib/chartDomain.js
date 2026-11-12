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

// Exact Y axis ticks inside a [low, high] domain. The step is 1, 2 or 5 times a power of
// ten, picked so the number of its multiples inside the domain is closest to 5 (the larger
// step wins a tie). Recharts starts ticks at the domain edge for a numeric domain, so pass
// these ticks to the axis explicitly.
export function chartTicks([low, high]) {
  const range = high - low
  if (!(range > 0)) return { ticks: [], step: 1 }

  const exp = Math.floor(Math.log10(range))
  let best = null
  for (let e = exp - 2; e <= exp + 1; e++) {
    for (const m of [1, 2, 5]) {
      const step = m * 10 ** e
      const count = Math.floor(high / step) - Math.ceil(low / step) + 1
      const diff = Math.abs(count - 5)
      // Steps are visited smallest first, so <= lets the larger step win a tie
      if (!best || diff <= best.diff) best = { step, diff }
    }
  }

  const { step } = best
  const ticks = []
  for (let k = Math.ceil(low / step); k <= Math.floor(high / step); k++) {
    // Round away float drift such as 0.30000000000000004
    ticks.push(parseFloat((k * step).toPrecision(12)))
  }
  return { ticks, step }
}

// Dollar tick formatter for ticks from chartTicks. Precision comes from the step, so every
// label is exact. Large axes switch to millions as a whole.
export function dollarTickFormatter({ step, ticks }) {
  const maxAbs = Math.max(0, ...ticks.map((t) => Math.abs(t)))
  const useMillions = maxAbs >= 1_000_000 && step >= 10_000
  const mDecimals = step >= 1_000_000 ? 0 : step >= 100_000 ? 1 : 2
  const kDecimals = step >= 1000 ? 0 : step >= 100 ? 1 : 2
  return (value) => {
    if (value === 0) return '$0'
    const sign = value < 0 ? '-' : ''
    const abs = Math.abs(value)
    if (useMillions) return `${sign}$${(abs / 1_000_000).toFixed(mDecimals)}M`
    if (step < 1000 && abs < 1000) return `${sign}$${Math.round(abs)}`
    return `${sign}$${(abs / 1000).toFixed(kDecimals)}k`
  }
}
