import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const accountId = searchParams.get('accountId')
  const days = parseInt(searchParams.get('days') || '90', 10)

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - days)
    const from = fromDate.toISOString().split('T')[0]

    if (accountId) {
      // Verify the account belongs to the user
      const { data: account, error: accErr } = await supabase
        .from('accounts')
        .select('id, name')
        .eq('id', accountId)
        .single()

      if (accErr || !account) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 })
      }

      // First check account_snapshots for this account (covers all account types)
      const { data: acctSnaps } = await supabase
        .from('account_snapshots')
        .select('date, balance')
        .eq('account_id', accountId)
        .gte('date', from)
        .order('date', { ascending: true })

      if (acctSnaps && acctSnaps.length >= 2) {
        const trend = acctSnaps.map((s) => ({
          date: s.date,
          total: s.balance,
        }))
        return NextResponse.json({ trend, accountName: account.name })
      }

      // Fall back to holding_snapshots for investment accounts
      const { data: holdings } = await supabase
        .from('holdings')
        .select('id')
        .eq('account_id', accountId)

      const holdingIds = (holdings ?? []).map((h) => h.id)

      if (holdingIds.length === 0) {
        return NextResponse.json({ trend: [], accountName: account.name })
      }

      const { data: snapshots, error: snapErr } = await supabase
        .from('holding_snapshots')
        .select('date, market_value, holding_id')
        .in('holding_id', holdingIds)
        .gte('date', from)
        .order('date', { ascending: true })

      if (snapErr) throw snapErr

      // Group by date and sum market_value
      const grouped = {}
      ;(snapshots ?? []).forEach((s) => {
        grouped[s.date] = (grouped[s.date] || 0) + (s.market_value || 0)
      })

      const trend = Object.entries(grouped)
        .map(([date, total]) => ({ date, total }))
        .sort((a, b) => new Date(a.date) - new Date(b.date))

      return NextResponse.json({ trend, accountName: account.name })
    }

    // No accountId: use net_worth_snapshots
    const { data: snapshots, error: snapErr } = await supabase
      .from('net_worth_snapshots')
      .select('date, total_assets')
      .eq('user_id', user.id)
      .gte('date', from)
      .order('date', { ascending: true })

    if (snapErr) throw snapErr

    const trend = (snapshots ?? []).map((s) => ({
      date: s.date,
      total: s.total_assets,
    }))

    return NextResponse.json({ trend, accountName: 'All Accounts' })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
