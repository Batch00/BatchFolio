import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') || '7', 10)

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Try today first; fall back to yesterday if no snapshots yet (nightly runs at 6AM UTC)
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    let { data: currentSnaps } = await supabase
      .from('holding_snapshots')
      .select('ticker, price, market_value, holding_id')
      .eq('user_id', user.id)
      .eq('date', todayStr)

    let currentDate = todayStr
    let extraDay = 0

    if (!currentSnaps || currentSnaps.length === 0) {
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      const { data: yesterdaySnaps } = await supabase
        .from('holding_snapshots')
        .select('ticker, price, market_value, holding_id')
        .eq('user_id', user.id)
        .eq('date', yesterdayStr)

      if (!yesterdaySnaps || yesterdaySnaps.length === 0) {
        return NextResponse.json({ gainers: [], losers: [], period: `${days}d`, hasData: false })
      }

      currentSnaps = yesterdaySnaps
      currentDate = yesterdayStr
      extraDay = 1
    }

    // Fetch old snapshots from N (+extraDay) days ago onward
    const fromDate = new Date(today)
    fromDate.setDate(fromDate.getDate() - days - extraDay)
    const fromDateStr = fromDate.toISOString().split('T')[0]

    const { data: oldSnaps } = await supabase
      .from('holding_snapshots')
      .select('ticker, price, market_value, holding_id, date')
      .eq('user_id', user.id)
      .gte('date', fromDateStr)
      .lt('date', currentDate)
      .order('date', { ascending: true })
      .limit(2000)

    if (!oldSnaps || oldSnaps.length === 0) {
      return NextResponse.json({ gainers: [], losers: [], period: `${days}d`, hasData: false })
    }

    // Build map of oldest snapshot per ticker from the old data
    const oldestByTicker = {}
    for (const snap of oldSnaps) {
      if (snap.ticker === 'CASH') continue
      if (!oldestByTicker[snap.ticker]) {
        oldestByTicker[snap.ticker] = snap
      }
    }

    // Aggregate current snapshots by ticker (may have multiple holdings of same ticker)
    const currentByTicker = {}
    for (const snap of currentSnaps) {
      if (snap.ticker === 'CASH') continue
      if (!currentByTicker[snap.ticker]) {
        currentByTicker[snap.ticker] = { price: snap.price, marketValue: snap.market_value }
      } else {
        currentByTicker[snap.ticker].marketValue += snap.market_value
      }
    }

    // Fetch descriptions from holdings (join through accounts for user scoping via RLS)
    const { data: holdingDetails } = await supabase
      .from('holdings')
      .select('ticker, description')

    const descriptionMap = {}
    for (const h of (holdingDetails ?? [])) {
      if (h.description && !descriptionMap[h.ticker]) {
        descriptionMap[h.ticker] = h.description
      }
    }

    // Calculate movers
    const movers = []
    for (const [ticker, current] of Object.entries(currentByTicker)) {
      const old = oldestByTicker[ticker]
      if (!old || !old.price || old.price === 0) continue

      const pctChange = ((current.price - old.price) / old.price) * 100
      // Aggregate old market value for this ticker
      const oldMV = oldSnaps
        .filter((s) => s.ticker === ticker && s.date === old.date)
        .reduce((sum, s) => sum + s.market_value, 0)
      const dollarChange = current.marketValue - oldMV

      movers.push({
        ticker,
        description: descriptionMap[ticker] || null,
        pctChange,
        dollarChange,
        currentValue: current.marketValue,
      })
    }

    // Sort by absolute pctChange descending
    movers.sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange))

    const gainers = movers.filter((m) => m.pctChange > 0).slice(0, 5)
    const losers = movers.filter((m) => m.pctChange < 0).slice(0, 5)

    return NextResponse.json({
      gainers,
      losers,
      period: `${days}d`,
      hasData: true,
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
