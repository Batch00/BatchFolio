import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const ticker = searchParams.get('ticker')

  if (!ticker) {
    return NextResponse.json(
      { error: 'ticker required' },
      { status: 400 }
    )
  }

  const toDate = new Date()
  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - 10)

  const from = fromDate.toISOString().split('T')[0]
  const to = toDate.toISOString().split('T')[0]

  const url = `https://api.polygon.io/v2/aggs/ticker/${ticker.toUpperCase()}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=10&apiKey=${process.env.POLYGON_API_KEY}`

  try {
    const res = await fetch(url, {
      next: { revalidate: 3600 }
    })

    if (!res.ok) {
      console.error(
        'Polygon sparkline error:', res.status,
        'ticker:', ticker
      )
      return NextResponse.json({ prices: [] }, { status: 200 })
    }

    const text = await res.text()

    let data
    try {
      data = JSON.parse(text)
    } catch {
      return NextResponse.json({ prices: [] }, { status: 200 })
    }

    if (
      !data?.results ||
      !Array.isArray(data.results) ||
      data.results.length === 0
    ) {
      return NextResponse.json({ prices: [] }, { status: 200 })
    }

    const prices = data.results.map((bar) => bar.c)

    return NextResponse.json({ prices }, { status: 200 })

  } catch (err) {
    console.error(
      'Sparkline route error:', err.message,
      'ticker:', ticker
    )
    return NextResponse.json({ prices: [] }, { status: 200 })
  }
}
