import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const TICKER_REGEX = /^[A-Z0-9.\-]{1,10}$/
const PAGE_SIZE = 1000

// ?ticker=X returns { history: [...] }; ?tickers=X,Y returns { histories: { X: [...], Y: [...] } }
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const ticker = searchParams.get('ticker')?.toUpperCase().trim()
  const batch = searchParams.get('tickers')
  const days = parseInt(searchParams.get('days') || '30', 10)

  const tickerList = batch
    ? [...new Set(batch.split(',').map((t) => t.toUpperCase().trim()))].filter((t) => TICKER_REGEX.test(t)).slice(0, 50)
    : [ticker]

  if (!tickerList.length || !tickerList.every((t) => t && TICKER_REGEX.test(t))) {
    return NextResponse.json({ error: 'Invalid ticker' }, { status: 400 })
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - days)
    const from = fromDate.toISOString().split('T')[0]

    // Page through results: a year of snapshots across several tickers exceeds the 1000-row cap
    const rows = []
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('holding_snapshots')
        .select('ticker, date, price, market_value')
        .eq('user_id', user.id)
        .in('ticker', tickerList)
        .gte('date', from)
        .order('date', { ascending: true })
        .order('holding_id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)

      if (error) throw error
      rows.push(...(data ?? []))
      if (!data || data.length < PAGE_SIZE) break
    }

    if (!batch) {
      return NextResponse.json({
        history: rows.map(({ date, price, market_value }) => ({ date, price, market_value })),
      })
    }

    const histories = Object.fromEntries(tickerList.map((t) => [t, []]))
    for (const { ticker: t, date, price, market_value } of rows) {
      histories[t].push({ date, price, market_value })
    }
    return NextResponse.json({ histories })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
