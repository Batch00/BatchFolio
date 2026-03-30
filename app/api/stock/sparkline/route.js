import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const ticker = searchParams.get('ticker')?.toUpperCase().trim()

  if (!ticker) {
    return NextResponse.json({ error: 'ticker is required' }, { status: 400 })
  }

  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'FINNHUB_API_KEY is not set' }, { status: 500 })
  }

  const now = Math.floor(Date.now() / 1000)
  const from = now - 7 * 86400

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/candle?symbol=${ticker}&resolution=D&from=${from}&to=${now}&token=${apiKey}`,
      { next: { revalidate: 3600 } },
    )

    if (!res.ok) {
      return NextResponse.json({ prices: [] })
    }

    const data = await res.json()

    if (data.s === 'no_data' || !data.c) {
      return NextResponse.json({ prices: [] })
    }

    return NextResponse.json({ prices: data.c })
  } catch {
    return NextResponse.json({ prices: [] })
  }
}
