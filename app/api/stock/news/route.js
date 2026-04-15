import { NextResponse } from 'next/server'
import { finnhubFetch } from '@/lib/finnhub'

function formatDate(d) {
  return d.toISOString().split('T')[0]
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const ticker = searchParams.get('ticker')?.toUpperCase().trim()

  const TICKER_REGEX = /^[A-Z0-9.\-]{1,10}$/
  if (!ticker || !TICKER_REGEX.test(ticker)) {
    return NextResponse.json({ error: 'Invalid ticker symbol' }, { status: 400 })
  }

  try {
    const to = new Date()
    const from = new Date()
    from.setDate(from.getDate() - 7)

    const articles = await finnhubFetch(
      `/company-news?symbol=${ticker}&from=${formatDate(from)}&to=${formatDate(to)}`,
    )

    const news = (Array.isArray(articles) ? articles : [])
      .slice(0, 5)
      .map((a) => ({
        headline: a.headline ?? '',
        source: a.source ?? '',
        url: a.url ?? '',
        datetime: a.datetime ? new Date(a.datetime * 1000).toISOString() : null,
        summary: a.summary ?? '',
      }))

    return NextResponse.json({ news }, { next: { revalidate: 3600 } })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
