const fmt = (v) => `$${Number(v).toFixed(0)}`

export default function RangeBar({ low, high, current, width = 80, showLabels = true }) {
  if (low == null || high == null || current == null || low >= high) return null

  const pct = Math.min(100, Math.max(0, ((current - low) / (high - low)) * 100))
  const mid = (low + high) / 2
  const color = current >= mid ? '#10b981' : '#f87171'

  return (
    <div style={{ width }}>
      <div style={{ position: 'relative', height: 4, background: '#21262d', borderRadius: 2 }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: `${pct}%`,
            height: 4,
            background: color,
            borderRadius: 2,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: `${pct}%`,
            top: -1,
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: color,
            transform: 'translateX(-50%)',
          }}
        />
      </div>
      {showLabels && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
          <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#7d8590' }}>{fmt(low)}</span>
          <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#7d8590' }}>{fmt(high)}</span>
        </div>
      )}
    </div>
  )
}
