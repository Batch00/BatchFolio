import { NextResponse } from 'next/server'

const RANGE_CONFIG = {
  '30d': { multiplier: 1, timespan: 'day',  days: 30  },
  '90d': { multiplier: 1, timespan: 'day',  days: 90  },
  '1y':  { multiplier: 1, timespan: 'day',  days: 365 },
}

async function fetchCandlesForConfig(ticker, config) {
  const toDate = new Date()
  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - config.days)
  const from = fromDate.toISOString().split('T')[0]
  const to   = toDate.toISOString().split('T')[0]

  const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/${config.multiplier}/${config.timespan}/${from}/${to}?adjusted=true&sort=asc&limit=500`

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${process.env.POLYGON_API_KEY}` },
    cache: 'no-store',
  })

  if (!res.ok) {
    console.error('Polygon error:', res.status, ticker)
    return null
  }

  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    console.error('Polygon parse error:', ticker)
    return null
  }

  if (!data || data.status === 'ERROR' || !Array.isArray(data.results) || data.results.length === 0) {
    console.error('Polygon no data:', ticker, data?.status)
    return null
  }

  return data.results.map((bar) => ({
    date:   new Date(bar.t).toISOString().split('T')[0],
    open:   bar.o ?? 0,
    high:   bar.h ?? 0,
    low:    bar.l ?? 0,
    close:  bar.c ?? 0,
    volume: bar.v ?? 0,
  }))
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const ticker = searchParams.get('ticker')?.toUpperCase().trim()
  const range  = searchParams.get('range') || '30d'

  const TICKER_REGEX = /^[A-Z0-9.\-]{1,10}$/
  if (!ticker || !TICKER_REGEX.test(ticker)) {
    return NextResponse.json({ error: 'Invalid ticker symbol' }, { status: 400 })
  }

  const config = RANGE_CONFIG[range] || RANGE_CONFIG['30d']

  try {
    const candles = await fetchCandlesForConfig(ticker, config)

    if (candles !== null) {
      return NextResponse.json({ candles })
    }

    // Requested range returned no data -- try 30d as fallback
    if (range !== '30d') {
      const fallbackCandles = await fetchCandlesForConfig(ticker, RANGE_CONFIG['30d'])
      if (fallbackCandles !== null) {
        return NextResponse.json({ candles: fallbackCandles, fallbackRange: '30d' })
      }
    }

    return NextResponse.json({ candles: [] })

  } catch {
    console.error('Chart route error:', ticker, range)
    return NextResponse.json({ candles: [] })
  }
}
