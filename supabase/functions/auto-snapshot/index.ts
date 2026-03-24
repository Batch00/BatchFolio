// Deploy with:
// supabase functions deploy auto-snapshot
// Schedule nightly at midnight UTC in Supabase dashboard >
// Edge Functions > auto-snapshot > Schedule (cron: 0 0 * * *)
// Required secrets: FINNHUB_API_KEY, APP_SUPABASE_URL,
// SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('APP_SUPABASE_URL')!,
    Deno.env.get('SERVICE_ROLE_KEY')!,
  )

  const finnhubKey = Deno.env.get('FINNHUB_API_KEY')!
  const today = new Date().toISOString().split('T')[0]

  // Get all users
  const { data: userList, error: userErr } = await supabase.auth.admin.listUsers()
  if (userErr || !userList) {
    return new Response(JSON.stringify({ error: 'Failed to list users' }), { status: 500 })
  }

  const users = userList.users
  const results: { uid: string; ok: boolean; error?: string }[] = []

  for (const user of users) {
    const uid = user.id

    try {
      // Fetch accounts for this user
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', uid)

      const accountIds = (accounts ?? []).map((a: { id: string }) => a.id)

      // Fetch all holdings across those accounts
      let holdings: { ticker: string; shares: number }[] = []
      if (accountIds.length > 0) {
        const { data: holdingRows } = await supabase
          .from('holdings')
          .select('ticker, shares')
          .in('account_id', accountIds)
        holdings = holdingRows ?? []
      }

      // Get unique tickers and fetch live prices from Finnhub
      const tickers = [...new Set(holdings.map((h) => h.ticker))]
      const priceMap: Record<string, number> = {}

      await Promise.all(
        tickers.map(async (ticker) => {
          try {
            const res = await fetch(
              `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${finnhubKey}`,
            )
            const data = await res.json()
            priceMap[ticker] = data.c ?? 0
          } catch {
            priceMap[ticker] = 0
          }
        }),
      )

      // Calculate total portfolio value
      const totalAssets = holdings.reduce(
        (sum, h) => sum + h.shares * (priceMap[h.ticker] ?? 0),
        0,
      )

      // Fetch total liabilities balance
      const { data: liabRows } = await supabase
        .from('liabilities')
        .select('balance')
        .eq('user_id', uid)

      const totalLiabilities = (liabRows ?? []).reduce(
        (sum: number, l: { balance: number }) => sum + l.balance,
        0,
      )

      const netWorth = totalAssets - totalLiabilities

      // Upsert snapshot for today
      const { error: upsertErr } = await supabase.from('net_worth_snapshots').upsert(
        {
          user_id: uid,
          date: today,
          total_assets: totalAssets,
          total_liabilities: totalLiabilities,
          net_worth: netWorth,
        },
        { onConflict: 'user_id,date' },
      )

      if (upsertErr) throw new Error(upsertErr.message)

      results.push({ uid, ok: true })
    } catch (err) {
      results.push({ uid, ok: false, error: String(err) })
    }
  }

  const processed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length

  return new Response(
    JSON.stringify({ date: today, processed, failed, results }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
