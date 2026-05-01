import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const ticker = searchParams.get('ticker')?.toUpperCase().trim()
  const days = parseInt(searchParams.get('days') || '30', 10)

  const TICKER_REGEX = /^[A-Z0-9.\-]{1,10}$/
  if (!ticker || !TICKER_REGEX.test(ticker)) {
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

    const { data, error } = await supabase
      .from('holding_snapshots')
      .select('date, price, market_value')
      .eq('user_id', user.id)
      .eq('ticker', ticker)
      .gte('date', from)
      .order('date', { ascending: true })

    if (error) throw error

    return NextResponse.json({ history: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
