import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const tickers = searchParams.get('tickers')

  if (!tickers) {
    return NextResponse.json({ error: 'tickers required' }, { status: 400 })
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tickerList = tickers.split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 50)

    const { data: allSnaps } = await supabase
      .from('holding_snapshots')
      .select('ticker, date, price, market_value')
      .eq('user_id', user.id)
      .in('ticker', tickerList)
      .order('date', { ascending: true })

    const byTicker = {}
    ;(allSnaps ?? []).forEach((s) => {
      if (!byTicker[s.ticker]) byTicker[s.ticker] = []
      byTicker[s.ticker].push(s)
    })

    const results = {}
    for (const ticker of tickerList) {
      const snaps = byTicker[ticker]
      if (!snaps || snaps.length < 2) {
        results[ticker] = { hasData: false }
        continue
      }

      const first = snaps[0]
      const last = snaps[snaps.length - 1]

      const pricePctChange = first.price > 0
        ? ((last.price - first.price) / first.price) * 100
        : 0

      const dollarChange = last.market_value - first.market_value

      results[ticker] = {
        hasData: true,
        pricePctChange,
        dollarChange,
        startDate: first.date,
        endDate: last.date,
        startPrice: first.price,
        endPrice: last.price,
        dataPoints: snaps.length,
      }
    }

    return NextResponse.json({ results })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
