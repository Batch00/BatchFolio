// Deploy with:
// supabase functions deploy nightly-snapshot
// Schedule nightly at midnight UTC in Supabase dashboard >
// Edge Functions > nightly-snapshot > Schedule (cron: 0 0 * * *)
// Required secrets: FINNHUB_API_KEY, APP_SUPABASE_URL,
// SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function detectAccountType(name: string): string {
  const lower = name.toLowerCase()
  if (/401k|ira|roth|retirement/.test(lower)) return 'retirement'
  return 'brokerage'
}

async function syncSimpleFINForUser(
  supabase: ReturnType<typeof createClient>,
  uid: string,
): Promise<void> {
  const { data: conn } = await supabase
    .from('simplefin_connections')
    .select('access_url')
    .eq('user_id', uid)
    .maybeSingle()

  if (!conn?.access_url) return

  try {
    const url = new URL(conn.access_url)
    const username = url.username
    const password = url.password
    const baseUrl = `${url.protocol}//${url.host}${url.pathname}`
    const credentials = btoa(`${username}:${password}`)

    const sfRes = await fetch(`${baseUrl}/accounts?version=2`, {
      headers: { Authorization: `Basic ${credentials}` },
    })
    if (!sfRes.ok) return

    const sfData = await sfRes.json()
    const sfAccounts: {
      id: string
      name: string
      balance?: string
      org?: { name?: string }
      holdings?: { id: string; symbol: string; shares?: string; cost_basis?: string }[]
    }[] = sfData.accounts ?? []

    for (const sfAcc of sfAccounts) {
      const { data: upsertedAcc } = await supabase
        .from('accounts')
        .upsert(
          {
            user_id: uid,
            name: sfAcc.name,
            provider: sfAcc.org?.name ?? 'SimpleFIN',
            type: detectAccountType(sfAcc.name),
            simplefin_id: sfAcc.id,
            is_synced: true,
          },
          { onConflict: 'user_id,simplefin_id' },
        )
        .select('id')
        .maybeSingle()

      if (!upsertedAcc) continue
      const accountId = upsertedAcc.id
      const sfHoldings = sfAcc.holdings ?? []

      if (sfHoldings.length > 0) {
        for (const h of sfHoldings) {
          const sharesNum = parseFloat(h.shares ?? '0')
          const costBasisNum = parseFloat(h.cost_basis ?? '0')
          const avgCost = sharesNum > 0 && costBasisNum > 0 ? costBasisNum / sharesNum : 0
          await supabase.from('holdings').upsert(
            {
              account_id: accountId,
              ticker: h.symbol,
              shares: sharesNum,
              avg_cost_basis: avgCost,
              simplefin_id: h.id,
              is_synced: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'account_id,simplefin_id' },
          )
        }
      } else if (sfAcc.balance != null) {
        await supabase.from('holdings').upsert(
          {
            account_id: accountId,
            ticker: 'CASH',
            shares: 1,
            avg_cost_basis: parseFloat(sfAcc.balance),
            simplefin_id: `${sfAcc.id}-cash`,
            is_synced: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'account_id,simplefin_id' },
        )
      }
    }

    await supabase
      .from('simplefin_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('user_id', uid)
  } catch {
    // Sync failure is non-fatal - proceed with snapshot using existing data
  }
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('APP_SUPABASE_URL')!,
    Deno.env.get('SERVICE_ROLE_KEY')!,
    { db: { schema: 'batchfolio' } },
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
      // Sync SimpleFIN data first (if user has a connection)
      await syncSimpleFINForUser(supabase, uid)

      // Fetch accounts for this user
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', uid)

      const accountIds = (accounts ?? []).map((a: { id: string }) => a.id)

      // Fetch all holdings across those accounts
      let holdings: { ticker: string; shares: number; avg_cost_basis: number }[] = []
      if (accountIds.length > 0) {
        const { data: holdingRows } = await supabase
          .from('holdings')
          .select('ticker, shares, avg_cost_basis')
          .in('account_id', accountIds)
        holdings = holdingRows ?? []
      }

      // Get unique tickers (skip CASH) and fetch live prices from Finnhub
      const tickers = [...new Set(holdings.map((h) => h.ticker))].filter((t) => t !== 'CASH')
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

      // Calculate total portfolio value (CASH uses avg_cost_basis as its value)
      const totalAssets = holdings.reduce((sum, h) => {
        if (h.ticker === 'CASH') return sum + (h.avg_cost_basis ?? 0)
        return sum + h.shares * (priceMap[h.ticker] ?? 0)
      }, 0)

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
