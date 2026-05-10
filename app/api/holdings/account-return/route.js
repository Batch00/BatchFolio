import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

function getPeriodStartDate(period) {
  const now = new Date()
  if (period === 'ytd') {
    return new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]
  }
  if (period === '1y') {
    const d = new Date()
    d.setFullYear(d.getFullYear() - 1)
    return d.toISOString().split('T')[0]
  }
  return null
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const accountId = searchParams.get('accountId')
  const period = searchParams.get('period') || 'ytd'

  if (!accountId) {
    return NextResponse.json({ error: 'accountId required' }, { status: 400 })
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the account belongs to the user
    const { data: account, error: accErr } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', accountId)
      .single()

    if (accErr || !account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const startDate = getPeriodStartDate(period)

    let query = supabase
      .from('account_snapshots')
      .select('date, balance')
      .eq('account_id', accountId)
      .order('date', { ascending: true })

    if (startDate) {
      query = query.gte('date', startDate)
    }

    const { data: snapshots } = await query

    if (!snapshots || snapshots.length < 2) {
      return NextResponse.json({ hasData: false, dataPoints: snapshots?.length ?? 0 })
    }

    const startSnap = snapshots[0]
    const endSnap = snapshots[snapshots.length - 1]

    const changeDollar = endSnap.balance - startSnap.balance
    const changePct = startSnap.balance > 0
      ? (changeDollar / startSnap.balance) * 100
      : 0

    return NextResponse.json({
      hasData: true,
      changeDollar,
      changePct,
      startBalance: startSnap.balance,
      endBalance: endSnap.balance,
      startDate: startSnap.date,
      endDate: endSnap.date,
      dataPoints: snapshots.length,
    })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
