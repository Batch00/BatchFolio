import { NextResponse } from 'next/server'

const RANGE_CONFIG = {
  '30d': { resolution: 'D', days: 30 },
  '90d': { resolution: 'D', days: 90 },
  '1y':  { resolution: 'W', days: 365 },
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const ticker = searchParams.get('ticker')
  const range = searchParams.get('range') || '30d'

  if (!ticker) {
    return NextResponse.json({ error: 'ticker required' }, { status: 400 })
  }

  const config = RANGE_CONFIG[range] || RANGE_CONFIG['30d']
  const to = Math.floor(Date.now() / 1000)
  const from = to - config.days * 24 * 60 * 60

  const url = `https://finnhub.io/api/v1/stock/candle?symbol=${ticker.toUpperCase()}&resolution=${config.resolution}&from=${from}&to=${to}&token=${process.env.FINNHUB_API_KEY}`

  try {
    const res = await fetch(url, { cache: 'no-store' })

    if (!res.ok) {
      console.error('Finnhub error status:', res.status, 'ticker:', ticker)
      return NextResponse.json({ candles: [] }, { status: 200 })
    }

    const text = await res.text()

    let data
    try {
      data = JSON.parse(text)
    } catch (parseErr) {
      console.error('Failed to parse Finnhub response:', text)
      return NextResponse.json({ candles: [] }, { status: 200 })
    }

    if (!data || data.s === 'no_data' || !data.t || !Array.isArray(data.t)) {
      console.log('No data for ticker:', ticker, 'status:', data?.s)
      return NextResponse.json({ candles: [] }, { status: 200 })
    }

    const candles = data.t.map((timestamp, i) => ({
      date: new Date(timestamp * 1000).toISOString().split('T')[0],
      open:   data.o?.[i] ?? 0,
      high:   data.h?.[i] ?? 0,
      low:    data.l?.[i] ?? 0,
      close:  data.c?.[i] ?? 0,
      volume: data.v?.[i] ?? 0,
    }))

    return NextResponse.json({ candles }, { status: 200 })

  } catch (err) {
    console.error('Chart route error:', err.message, 'ticker:', ticker)
    return NextResponse.json({ candles: [] }, { status: 200 })
  }
}
