import { NextResponse } from 'next/server'
import { finnhubFetch } from '@/lib/finnhub'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const ticker = searchParams.get('ticker')?.toUpperCase().trim()

  const TICKER_REGEX = /^[A-Z0-9.\-]{1,10}$/
  if (!ticker || !TICKER_REGEX.test(ticker)) {
    return NextResponse.json({ error: 'Invalid ticker symbol' }, { status: 400 })
  }

  try {
    const [quote, profile] = await Promise.all([
      finnhubFetch(`/quote?symbol=${ticker}`),
      finnhubFetch(`/stock/profile2?symbol=${ticker}`),
    ])

    return NextResponse.json({
      price: quote.c ?? 0,
      change: quote.d ?? 0,
      changePercent: quote.dp ?? 0,
      high: quote.h ?? 0,
      low: quote.l ?? 0,
      open: quote.o ?? 0,
      previousClose: quote.pc ?? 0,
      name: profile.name || ticker,
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
