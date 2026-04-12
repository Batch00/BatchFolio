// Deploy with:
// supabase functions deploy nightly-snapshot
// Schedule nightly at midnight UTC in Supabase dashboard >
// Edge Functions > nightly-snapshot > Schedule (cron: 0 0 * * *)
// Required secrets: FINNHUB_API_KEY, APP_SUPABASE_URL,
// SERVICE_ROLE_KEY, DEMO_USER_ID (optional - skips demo user)
//
// Required SQL migrations (run in Supabase SQL editor before deploying):
// alter table batchfolio.accounts add column if not exists is_excluded boolean default false;
// alter table batchfolio.liabilities add column if not exists simplefin_id text unique;
// alter table batchfolio.liabilities add column if not exists is_synced boolean default false;

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function detectAccountType(name: string): string {
  const lower = name.toLowerCase()
  if (/401k|ira|roth|retirement/.test(lower)) return 'retirement'
  return 'brokerage'
}

function isCreditCardAccount(name: string, balance?: string): boolean {
  const lower = (name || '').toLowerCase()
  return (
    /credit|card|freedom|sapphire|venture|cash back|quicksilver|slate|ink|reserve/.test(lower) ||
    parseFloat(balance ?? '0') < 0
  )
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

    // Fetch 90 days of data including transactions
    const startDate = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000)
    const sfRes = await fetch(`${baseUrl}/accounts?version=2&start-date=${startDate}`, {
      headers: { Authorization: `Basic ${credentials}` },
    })
    if (!sfRes.ok) return

    const sfData = await sfRes.json()
    const sfAccounts: {
      id: string
      name: string
      balance?: string
      'available-balance'?: string
      'balance-date'?: number
      currency?: string
      org?: { name?: string }
      holdings?: {
        id: string
        symbol: string
        shares?: string
        cost_basis?: string
        purchase_price?: string
        description?: string
        currency?: string
        market_value?: string
      }[]
      transactions?: {
        id: string
        posted?: number
        transacted_at?: string
        amount?: string
        description?: string
        payee?: string
        memo?: string
        pending?: boolean
      }[]
    }[] = sfData.accounts ?? []

    for (const sfAcc of sfAccounts) {
      // Route credit cards to liabilities
      if (isCreditCardAccount(sfAcc.name, sfAcc.balance)) {
        const balanceAbs = Math.abs(parseFloat(sfAcc.balance ?? '0') || 0)
        try {
          const { data: existingLiab } = await supabase
            .from('liabilities')
            .select('id')
            .eq('user_id', uid)
            .eq('simplefin_id', sfAcc.id)
            .maybeSingle()

          if (existingLiab) {
            await supabase
              .from('liabilities')
              .update({ balance: balanceAbs, is_synced: true })
              .eq('id', existingLiab.id)
          } else {
            await supabase.from('liabilities').insert({
              user_id: uid,
              name: sfAcc.name,
              type: 'credit card',
              balance: balanceAbs,
              interest_rate: null,
              simplefin_id: sfAcc.id,
              is_synced: true,
            })
          }

          // Delete any account row previously created for this SimpleFIN ID
          const { data: existingCCAccount } = await supabase
            .from('accounts')
            .select('id')
            .eq('user_id', uid)
            .eq('simplefin_id', sfAcc.id)
            .maybeSingle()

          if (existingCCAccount) {
            await supabase.from('holdings').delete().eq('account_id', existingCCAccount.id)
            await supabase.from('accounts').delete().eq('id', existingCCAccount.id)
          }
        } catch {
          // simplefin_id column may not exist yet - skip gracefully
        }
        continue
      }

      const balanceNum = parseFloat(sfAcc.balance ?? '0') || 0
      const availableBalanceNum = parseFloat(sfAcc['available-balance'] ?? '0') || 0
      const currency = sfAcc.currency || 'USD'
      const lastBalanceDate = sfAcc['balance-date']
        ? new Date(sfAcc['balance-date'] * 1000).toISOString()
        : null

      // Preserve user-edited names: check before update, never overwrite name
      const { data: existingAcc } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', uid)
        .eq('simplefin_id', sfAcc.id)
        .maybeSingle()

      let accountId: string | null = null

      if (existingAcc) {
        // Update balance fields only - preserve user-edited name
        await supabase
          .from('accounts')
          .update({
            balance: balanceNum,
            available_balance: availableBalanceNum,
            currency,
            last_balance_date: lastBalanceDate,
            is_synced: true,
          })
          .eq('id', existingAcc.id)
        accountId = existingAcc.id
      } else {
        // New account - insert with name from SimpleFIN
        const { data: newAcc } = await supabase
          .from('accounts')
          .insert({
            user_id: uid,
            name: sfAcc.name,
            provider: sfAcc.org?.name ?? 'SimpleFIN',
            type: detectAccountType(sfAcc.name),
            simplefin_id: sfAcc.id,
            is_synced: true,
            balance: balanceNum,
            available_balance: availableBalanceNum,
            currency,
            last_balance_date: lastBalanceDate,
          })
          .select('id')
          .maybeSingle()
        accountId = newAcc?.id ?? null
      }

      if (!accountId) continue
      const sfHoldings = sfAcc.holdings ?? []

      if (sfHoldings.length > 0) {
        for (const h of sfHoldings) {
          const sh = parseFloat(h.shares ?? '0')
          const sharesNum = !isNaN(sh) ? sh : 0
          const costBasisTotal = parseFloat(h.cost_basis ?? '0') > 0 ? parseFloat(h.cost_basis ?? '0') : null
          const purchasePrice = parseFloat(h.purchase_price ?? '0') > 0 ? parseFloat(h.purchase_price ?? '0') : null
          const mv = parseFloat(h.market_value ?? '0')

          let avgCost: number
          if (costBasisTotal && costBasisTotal > 0 && sharesNum > 0) {
            avgCost = costBasisTotal / sharesNum
          } else if (purchasePrice && purchasePrice > 0) {
            avgCost = purchasePrice
          } else {
            avgCost = 0
          }

          const lastSyncedPrice = (!isNaN(mv) && !isNaN(sh) && sh > 0)
            ? mv / sh
            : (!isNaN(mv) && mv > 0 ? mv : null)

          await supabase.from('holdings').upsert(
            {
              account_id: accountId,
              ticker: h.symbol,
              shares: sharesNum,
              avg_cost_basis: avgCost,
              simplefin_id: h.id,
              is_synced: true,
              last_synced_price: lastSyncedPrice,
              description: h.description || null,
              cost_basis_total: costBasisTotal,
              currency: h.currency || 'USD',
              purchase_price: purchasePrice,
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

      // Sync transactions
      const sfTransactions = sfAcc.transactions ?? []
      for (const tx of sfTransactions) {
        if (!tx.id) continue
        const amount = parseFloat(tx.amount ?? '0')
        if (amount === 0 || isNaN(amount)) continue

        await supabase.from('transactions').upsert(
          {
            account_id: accountId,
            user_id: uid,
            simplefin_id: tx.id,
            posted_at: tx.posted
              ? new Date(tx.posted * 1000).toISOString()
              : null,
            transacted_at: tx.transacted_at
              ? new Date(tx.transacted_at * 1000).toISOString()
              : null,
            amount,
            description: tx.description || null,
            payee: tx.payee || null,
            memo: tx.memo || null,
            pending: tx.pending || false,
          },
          { onConflict: 'simplefin_id' },
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

  // Find demo user ID - check by email as fallback if DEMO_USER_ID env var is not set
  const demoUserByEmail = userList.users.find((u) => u.email === 'demo@batchfolio.app')
  const DEMO_USER_ID = Deno.env.get('DEMO_USER_ID') || demoUserByEmail?.id || ''

  const users = userList.users
  const results: { uid: string; ok: boolean; skipped?: boolean; error?: string }[] = []

  for (const user of users) {
    const uid = user.id

    // Skip demo user - their snapshot history is seeded and should not be overwritten
    if (DEMO_USER_ID && uid === DEMO_USER_ID) {
      results.push({ uid, ok: true, skipped: true })
      continue
    }

    try {
      // Sync SimpleFIN data first (if user has a connection)
      await syncSimpleFINForUser(supabase, uid)

      // Fetch accounts for this user (include balance for synced accounts, exclude excluded accounts)
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id, is_synced, balance, is_excluded')
        .eq('user_id', uid)

      const accountList = (accounts ?? []) as { id: string; is_synced: boolean; balance: number; is_excluded: boolean }[]

      // Filter out excluded accounts from all calculations
      const activeAccounts = accountList.filter((a) => !a.is_excluded)

      // Calculate synced assets total directly from account balances
      const syncedAssetsTotal = activeAccounts
        .filter((a) => a.is_synced && a.balance > 0)
        .reduce((sum, a) => sum + a.balance, 0)

      // Fetch holdings for non-synced accounts (manual)
      const manualAccountIds = activeAccounts.filter((a) => !a.is_synced).map((a) => a.id)
      let manualHoldings: { ticker: string; shares: number; avg_cost_basis: number }[] = []

      if (manualAccountIds.length > 0) {
        const { data: holdingRows } = await supabase
          .from('holdings')
          .select('ticker, shares, avg_cost_basis')
          .in('account_id', manualAccountIds)
        manualHoldings = holdingRows ?? []
      }

      // Get unique tickers for manual holdings (skip CASH) and fetch live prices
      const tickers = [...new Set(manualHoldings.map((h) => h.ticker))].filter((t) => t !== 'CASH')
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

      // Calculate manual assets total
      const manualAssetsTotal = manualHoldings.reduce((sum, h) => {
        if (h.ticker === 'CASH') return sum + (h.avg_cost_basis ?? 0)
        return sum + h.shares * (priceMap[h.ticker] ?? 0)
      }, 0)

      const totalAssets = syncedAssetsTotal + manualAssetsTotal

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

  const processed = results.filter((r) => r.ok && !r.skipped).length
  const skipped = results.filter((r) => r.skipped).length
  const failed = results.filter((r) => !r.ok).length

  return new Response(
    JSON.stringify({ date: today, processed, skipped, failed, results }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
