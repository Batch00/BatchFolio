// Deploy with:
// supabase functions deploy reset-demo
// Schedule nightly at 3AM UTC in Supabase dashboard >
// Edge Functions > reset-demo > Schedule

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DEMO_EMAIL = 'demo@batchfolio.app'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Look up demo user
  const { data: userList } = await supabase.auth.admin.listUsers()
  const demoUser = userList?.users?.find((u) => u.email === DEMO_EMAIL)

  if (!demoUser) {
    return new Response(JSON.stringify({ error: 'Demo user not found' }), { status: 404 })
  }

  const uid = demoUser.id

  // Delete all existing demo data (cascade handles holdings via account deletes)
  await supabase.from('watchlist').delete().eq('user_id', uid)
  await supabase.from('net_worth_snapshots').delete().eq('user_id', uid)
  await supabase.from('liabilities').delete().eq('user_id', uid)
  await supabase.from('accounts').delete().eq('user_id', uid)

  const now = new Date()

  // Insert accounts
  const { data: accounts } = await supabase
    .from('accounts')
    .insert([
      { user_id: uid, name: 'Fidelity Brokerage', type: 'brokerage', provider: 'Fidelity' },
      { user_id: uid, name: 'Vanguard 401k', type: 'retirement', provider: 'Vanguard' },
      { user_id: uid, name: 'Robinhood', type: 'brokerage', provider: 'Robinhood' },
    ])
    .select('id, name')

  if (!accounts) {
    return new Response(JSON.stringify({ error: 'Failed to insert accounts' }), { status: 500 })
  }

  const fidelityId = accounts.find((a) => a.name === 'Fidelity Brokerage')?.id
  const vanguardId = accounts.find((a) => a.name === 'Vanguard 401k')?.id
  const robinhoodId = accounts.find((a) => a.name === 'Robinhood')?.id

  // Insert holdings
  await supabase.from('holdings').insert([
    { account_id: fidelityId, ticker: 'AAPL', shares: 45, avg_cost_basis: 142.50 },
    { account_id: fidelityId, ticker: 'MSFT', shares: 28, avg_cost_basis: 285.00 },
    { account_id: fidelityId, ticker: 'NVDA', shares: 12, avg_cost_basis: 410.00 },
    { account_id: fidelityId, ticker: 'VTI',  shares: 60, avg_cost_basis: 195.00 },
    { account_id: vanguardId, ticker: 'VTSAX', shares: 180, avg_cost_basis: 88.00 },
    { account_id: vanguardId, ticker: 'VTIAX', shares: 90,  avg_cost_basis: 62.00 },
    { account_id: vanguardId, ticker: 'VBTLX', shares: 45,  avg_cost_basis: 9.80 },
    { account_id: robinhoodId, ticker: 'TSLA', shares: 8,  avg_cost_basis: 220.00 },
    { account_id: robinhoodId, ticker: 'AMZN', shares: 15, avg_cost_basis: 148.00 },
    { account_id: robinhoodId, ticker: 'SPY',  shares: 20, avg_cost_basis: 410.00 },
  ])

  // Insert liabilities
  await supabase.from('liabilities').insert([
    { user_id: uid, name: 'Student Loan', type: 'loan', balance: 18400.00, interest_rate: 4.5 },
    { user_id: uid, name: 'Car Loan',     type: 'loan', balance: 9200.00,  interest_rate: 6.2 },
  ])

  // Insert 12 monthly net worth snapshots
  const snapshots = [
    { months: 11, assets: 207600, liabilities: 27600, nw: 180000 },
    { months: 10, assets: 219800, liabilities: 27300, nw: 192500 },
    { months: 9,  assets: 215200, liabilities: 27000, nw: 188200 },
    { months: 8,  assets: 232400, liabilities: 26700, nw: 205700 },
    { months: 7,  assets: 242000, liabilities: 26500, nw: 215500 },
    { months: 6,  assets: 236800, liabilities: 26200, nw: 210600 },
    { months: 5,  assets: 254200, liabilities: 25900, nw: 228300 },
    { months: 4,  assets: 266000, liabilities: 25600, nw: 240400 },
    { months: 3,  assets: 277800, liabilities: 25300, nw: 252500 },
    { months: 2,  assets: 283500, liabilities: 25000, nw: 258500 },
    { months: 1,  assets: 295400, liabilities: 24700, nw: 270700 },
    { months: 0,  assets: 309200, liabilities: 24400, nw: 284800 },
  ]

  const snapshotRows = snapshots.map(({ months, assets, liabilities, nw }) => {
    const d = new Date(now)
    d.setMonth(d.getMonth() - months)
    return {
      user_id: uid,
      date: d.toISOString().split('T')[0],
      total_assets: assets,
      total_liabilities: liabilities,
      net_worth: nw,
    }
  })

  await supabase.from('net_worth_snapshots').insert(snapshotRows)

  // Insert watchlist
  await supabase.from('watchlist').insert([
    { user_id: uid, ticker: 'QQQ' },
    { user_id: uid, ticker: 'GLD' },
    { user_id: uid, ticker: 'AMD' },
    { user_id: uid, ticker: 'PLTR' },
  ])

  return new Response(JSON.stringify({ ok: true, uid }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
