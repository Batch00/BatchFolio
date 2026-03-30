import { NextResponse } from 'next/server'
import { finnhubFetch } from '@/lib/finnhub'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const ticker = searchParams.get('ticker')?.toUpperCase().trim()
  const range = searchParams.get('range') || '30d'

  if (!ticker) {
    return NextResponse.json({ error: 'ticker is required' }, { status: 400 })
  }

  const now = Math.floor(Date.now() / 1000)
  const ranges = {
    '30d': { from: now - 30 * 24 * 60 * 60, resolution: 'D' },
    '90d': { from: now - 90 * 24 * 60 * 60, resolution: 'D' },
    '1y':  { from: now - 365 * 24 * 60 * 60, resolution: 'W' },
  }
  const { from, resolution } = ranges[range] ?? ranges['30d']

  try {
    const data = await finnhubFetch(
      `/stock/candle?symbol=${ticker}&resolution=${resolution}&from=${from}&to=${now}`,
    )

    if (data.s === 'no_data' || !data.t) {
      console.log('Finnhub no_data for:', ticker, 'range:', range)
      return NextResponse.json({ candles: [] })
    }

    const candles = data.t.map((timestamp, i) => ({
      date: new Date(timestamp * 1000).toISOString().split('T')[0],
      open: data.o[i],
      high: data.h[i],
      low: data.l[i],
      close: data.c[i],
      volume: data.v[i],
    }))

    return NextResponse.json({ candles })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
