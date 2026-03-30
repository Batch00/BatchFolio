export default function Sparkline({ prices, width = 60, height = 28, positive }) {
  if (!prices || prices.length < 2) {
    return <div style={{ width, height, flexShrink: 0 }} />
  }

  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1

  const points = prices
    .map((v, i) => {
      const x = (i / (prices.length - 1)) * width
      const y = height - ((v - min) / range) * (height - 4) - 2
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg
      width={width}
      height={height}
      style={{ overflow: 'hidden', flexShrink: 0 }}
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke={positive ? '#34d399' : '#f87171'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
