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
    const data = await finnhubFetch(`/stock/metric?symbol=${ticker}&metric=all`)
    const m = data.metric || {}

    return NextResponse.json({
      marketCap: m.marketCapitalization ?? null,
      peRatio: m.peNormalizedAnnual ?? m.peExclExtraTTM ?? null,
      eps: m.epsNormalizedAnnual ?? null,
      high52w: m['52WeekHigh'] ?? null,
      low52w: m['52WeekLow'] ?? null,
      dividendYield: m.currentDividendYieldTTM ?? null,
      beta: m.beta ?? null,
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
