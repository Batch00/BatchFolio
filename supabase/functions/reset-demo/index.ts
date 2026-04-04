// Deploy with:
// supabase functions deploy reset-demo
// Schedule nightly at 3AM UTC in Supabase dashboard >
// Edge Functions > reset-demo > Schedule (cron: 0 3 * * *)
// Required secrets: APP_SUPABASE_URL, SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DEMO_EMAIL = 'demo@batchfolio.app'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('APP_SUPABASE_URL')!,
    Deno.env.get('SERVICE_ROLE_KEY')!,
    { db: { schema: 'batchfolio' } },
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
      { user_id: uid, name: 'Vanguard Retirement', type: 'retirement', provider: 'Vanguard' },
      { user_id: uid, name: 'Robinhood', type: 'brokerage', provider: 'Robinhood' },
    ])
    .select('id, name')

  if (!accounts) {
    return new Response(JSON.stringify({ error: 'Failed to insert accounts' }), { status: 500 })
  }

  const fidelityId = accounts.find((a) => a.name === 'Fidelity Brokerage')?.id
  const vanguardId = accounts.find((a) => a.name === 'Vanguard Retirement')?.id
  const robinhoodId = accounts.find((a) => a.name === 'Robinhood')?.id

  // Insert holdings
  await supabase.from('holdings').insert([
    { account_id: fidelityId, ticker: 'AAPL', shares: 22, avg_cost_basis: 142.50 },
    { account_id: fidelityId, ticker: 'MSFT', shares: 14, avg_cost_basis: 285.00 },
    { account_id: fidelityId, ticker: 'VTI',  shares: 30, avg_cost_basis: 195.00 },
    { account_id: fidelityId, ticker: 'SPY',  shares: 10, avg_cost_basis: 410.00 },
    { account_id: vanguardId, ticker: 'VTI',  shares: 40, avg_cost_basis: 185.00 },
    { account_id: vanguardId, ticker: 'VXUS', shares: 35, avg_cost_basis: 52.00 },
    { account_id: vanguardId, ticker: 'BND',  shares: 50, avg_cost_basis: 72.00 },
    { account_id: robinhoodId, ticker: 'TSLA', shares: 5,  avg_cost_basis: 220.00 },
    { account_id: robinhoodId, ticker: 'AMZN', shares: 8,  avg_cost_basis: 148.00 },
    { account_id: robinhoodId, ticker: 'NVDA', shares: 4,  avg_cost_basis: 410.00 },
  ])

  // Insert liabilities
  await supabase.from('liabilities').insert([
    { user_id: uid, name: 'Student Loan', type: 'loan', balance: 18400.00, interest_rate: 4.5 },
    { user_id: uid, name: 'Car Loan',     type: 'loan', balance: 9200.00,  interest_rate: 6.2 },
  ])

  // Insert 12 monthly net worth snapshots
  const snapshots = [
    { months: 12, assets: 48000, liabilities: 29000, nw: 19000 },
    { months: 11, assets: 49200, liabilities: 28600, nw: 20600 },
    { months: 10, assets: 51000, liabilities: 28200, nw: 22800 },
    { months: 9,  assets: 50400, liabilities: 27800, nw: 22600 },
    { months: 8,  assets: 53000, liabilities: 27400, nw: 25600 },
    { months: 7,  assets: 55500, liabilities: 27000, nw: 28500 },
    { months: 6,  assets: 54200, liabilities: 26800, nw: 27400 },
    { months: 5,  assets: 57000, liabilities: 26600, nw: 30400 },
    { months: 4,  assets: 59500, liabilities: 26400, nw: 33100 },
    { months: 3,  assets: 61000, liabilities: 26200, nw: 34800 },
    { months: 2,  assets: 63500, liabilities: 26000, nw: 37500 },
    { months: 1,  assets: 66000, liabilities: 27600, nw: 38400 },
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
