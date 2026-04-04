import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) {
    return NextResponse.json({ results: [] })
  }

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${apiKey}`,
      { next: { revalidate: 3600 } },
    )

    if (!res.ok) {
      return NextResponse.json({ results: [] })
    }

    const data = await res.json()
    const allowed = new Set(['Common Stock', 'ETP'])

    const results = (data.result ?? [])
      .filter((r) => allowed.has(r.type))
      .slice(0, 8)
      .map((r) => ({
        ticker: r.symbol,
        name: r.description,
        type: r.type,
      }))

    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ results: [] })
  }
}
