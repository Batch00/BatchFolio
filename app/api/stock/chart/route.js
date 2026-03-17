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
  const daysMap = { '30d': 30, '90d': 90, '1y': 365 }
  const days = daysMap[range] ?? 30
  const from = now - days * 86400

  try {
    const data = await finnhubFetch(
      `/stock/candle?symbol=${ticker}&resolution=D&from=${from}&to=${now}`,
    )

    if (data.s === 'no_data' || !data.t) {
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
