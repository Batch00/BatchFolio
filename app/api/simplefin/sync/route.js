import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Required SQL migrations (run in Supabase SQL editor):
// ALTER TABLE batchfolio.accounts DROP CONSTRAINT IF EXISTS accounts_type_check;
// ALTER TABLE batchfolio.accounts ADD CONSTRAINT accounts_type_check
//   CHECK (type IN ('brokerage', 'retirement', 'bank'));
// ALTER TABLE batchfolio.accounts ADD COLUMN IF NOT EXISTS provider_url text;
// ALTER TABLE batchfolio.transactions ADD COLUMN IF NOT EXISTS tx_type text;
// ALTER TABLE batchfolio.transactions ADD COLUMN IF NOT EXISTS liability_id uuid REFERENCES batchfolio.liabilities(id);
// -- Ensure unique constraint exists for shadow account upsert:
// -- accounts already has unique on (user_id, simplefin_id) — verify with:
// -- SELECT indexname FROM pg_indexes WHERE tablename = 'accounts' AND indexname LIKE '%simplefin%';

function detectAccountType(name, orgName) {
  const lower = (name || '').toLowerCase()
  const org = (orgName || '').toLowerCase()

  if (/401k|401\(k\)|ira|roth|retirement|pension|403b|457|hsa|health savings|sep|simple ira|annuity|profit sharing/.test(lower)) return 'retirement'

  if (/checking|savings|chequing|money market|mmda|share draft|deposit/.test(lower)) return 'bank'

  if (/horicon|community bank|credit union|chase bank|bank of america|wells fargo|citibank|us bank|pnc|td bank|capital one/.test(org)) {
    if (!/brokerage|investment|trading|ira|401/.test(lower)) return 'bank'
  }

  return 'brokerage'
}

function isCreditCardAccount(name, balance) {
  const lower = (name || '').toLowerCase()
  return (
    /credit|card|freedom|sapphire|venture|cash back|quicksilver|slate|ink|reserve/.test(lower) ||
    parseFloat(balance) < 0
  )
}

export async function POST() {
  try {
    // Get current user from session
    const cookieStore = await cookies()
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        db: { schema: 'batchfolio' },
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
          },
        },
      },
    )

    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser()
    if (authErr || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Service role client for all DB operations
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SERVICE_ROLE_KEY,
      {
        auth: { autoRefreshToken: false, persistSession: false },
        db: { schema: 'batchfolio' },
      },
    )

    // Get access URL from DB
    const { data: conn, error: connErr } = await supabase
      .from('simplefin_connections')
      .select('access_url, last_synced_at')
      .eq('user_id', user.id)
      .single()

    if (connErr || !conn) {
      return Response.json({ error: 'No SimpleFIN connection' }, { status: 400 })
    }

    if (conn.last_synced_at) {
      const lastSync = new Date(conn.last_synced_at)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      if (lastSync > oneHourAgo) {
        return Response.json({
          alreadySynced: true,
          message: 'Already synced recently. SimpleFIN updates once per day.'
        })
      }
    }

    // Parse access URL for credentials
    const url = new URL(conn.access_url)
    const username = url.username
    const password = url.password
    const baseUrl = `${url.protocol}//${url.host}${url.pathname}`
    const credentials = Buffer.from(`${username}:${password}`).toString('base64')

    // Fetch accounts + transactions from SimpleFIN (90 days back)
    const startDate = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000)
    const sfRes = await fetch(`${baseUrl}/accounts?version=2&start-date=${startDate}`, {
      headers: { Authorization: `Basic ${credentials}` },
    })
    if (!sfRes.ok) {
      throw new Error(`SimpleFIN returned ${sfRes.status}`)
    }
    const sfData = await sfRes.json()
    const sfAccounts = sfData.accounts ?? []

    let accountsSynced = 0
    let holdingsSynced = 0
    let transactionsSynced = 0
    let logCount = 0

    if (sfAccounts.length > 0) {
      console.log('SimpleFIN account fields:', Object.keys(sfAccounts[0]))
    }

    for (const sfAcc of sfAccounts) {
      // Auto-detect credit cards: route them to liabilities + sync transactions via shadow account
      // Requires: ALTER TABLE batchfolio.liabilities ADD COLUMN IF NOT EXISTS simplefin_id text UNIQUE;
      //           ALTER TABLE batchfolio.liabilities ADD COLUMN IF NOT EXISTS is_synced boolean DEFAULT false;
      if (isCreditCardAccount(sfAcc.name, sfAcc.balance)) {
        const balanceAbs = Math.abs(parseFloat(sfAcc.balance) || 0)
        try {
          // 1. Upsert liability
          let liabilityId = null
          const { data: existingLiab } = await supabase
            .from('liabilities')
            .select('id')
            .eq('user_id', user.id)
            .eq('simplefin_id', sfAcc.id)
            .maybeSingle()

          if (existingLiab) {
            await supabase
              .from('liabilities')
              .update({ balance: balanceAbs, is_synced: true })
              .eq('id', existingLiab.id)
            liabilityId = existingLiab.id
          } else {
            const { data: newLiab } = await supabase.from('liabilities').insert({
              user_id: user.id,
              name: sfAcc.name,
              type: 'credit card',
              balance: balanceAbs,
              interest_rate: null,
              simplefin_id: sfAcc.id,
              is_synced: true,
            }).select('id').single()
            liabilityId = newLiab?.id ?? null
          }

          // 2. Delete any old non-shadow account for this SimpleFIN ID
          const { data: existingCCAccount } = await supabase
            .from('accounts')
            .select('id')
            .eq('user_id', user.id)
            .eq('simplefin_id', sfAcc.id)
            .maybeSingle()

          if (existingCCAccount) {
            await supabase.from('holdings').delete().eq('account_id', existingCCAccount.id)
            await supabase.from('accounts').delete().eq('id', existingCCAccount.id)
          }

          // 3. Upsert hidden shadow account to hold transactions
          if (liabilityId) {
            const { data: shadowAcc } = await supabase
              .from('accounts')
              .upsert(
                {
                  user_id: user.id,
                  name: sfAcc.name + ' (Transactions)',
                  provider: sfAcc.org?.name || 'SimpleFIN',
                  provider_url: sfAcc.org?.url || null,
                  type: 'bank',
                  simplefin_id: sfAcc.id + '-txn',
                  is_synced: true,
                  is_hidden: true,
                  balance: 0,
                },
                { onConflict: 'user_id,simplefin_id' },
              )
              .select('id')
              .maybeSingle()

            // 4. Sync credit card transactions
            if (shadowAcc?.id) {
              const sfTransactions = sfAcc.transactions ?? []
              for (const tx of sfTransactions) {
                if (!tx.id) continue
                const amount = parseFloat(tx.amount)
                if (amount === 0 || isNaN(amount)) continue

                const { error: txErr } = await supabase
                  .from('transactions')
                  .upsert(
                    {
                      account_id: shadowAcc.id,
                      liability_id: liabilityId,
                      user_id: user.id,
                      simplefin_id: tx.id,
                      posted_at: tx.posted ? new Date(tx.posted * 1000).toISOString() : null,
                      transacted_at: tx.transacted_at ? new Date(tx.transacted_at * 1000).toISOString() : null,
                      amount,
                      description: tx.description || null,
                      payee: tx.payee || null,
                      memo: tx.memo || null,
                      pending: tx.pending || false,
                      tx_type: amount > 0 ? 'credit' : 'debit',
                    },
                    { onConflict: 'simplefin_id' },
                  )

                if (!txErr) transactionsSynced++
              }
            }
          }
        } catch {
          // simplefin_id column may not exist yet - skip gracefully
        }
        continue
      }

      // Preserve user-edited names: insert with SimpleFIN name only on first sync,
      // update provider/type/is_synced on subsequent syncs without touching name.
      const { data: existingAcc } = await supabase
        .from('accounts')
        .select('id, type')
        .eq('user_id', user.id)
        .eq('simplefin_id', sfAcc.id)
        .maybeSingle()

      const balanceNum = parseFloat(sfAcc.balance) || 0
      const availableBalanceNum = parseFloat(sfAcc['available-balance']) || 0
      const currency = sfAcc.currency || 'USD'
      const lastBalanceDate = sfAcc['balance-date']
        ? new Date(sfAcc['balance-date'] * 1000).toISOString()
        : null
      const newType = detectAccountType(sfAcc.name, sfAcc.org?.name)

      let accountId
      if (existingAcc) {
        await supabase
          .from('accounts')
          .update({
            provider: sfAcc.org?.name ?? 'SimpleFIN',
            is_synced: true,
            balance: balanceNum,
            available_balance: availableBalanceNum,
            currency,
            last_balance_date: lastBalanceDate,
            // Update type if it was auto-detected as brokerage but new detection says otherwise
            ...(existingAcc.type === 'brokerage' && newType !== 'brokerage' ? { type: newType } : {}),
          })
          .eq('id', existingAcc.id)
        accountId = existingAcc.id
      } else {
        const { data: newAcc, error: insertErr } = await supabase
          .from('accounts')
          .insert({
            user_id: user.id,
            name: sfAcc.name,
            provider: sfAcc.org?.name ?? 'SimpleFIN',
            provider_url: sfAcc.org?.url || null,
            type: newType,
            simplefin_id: sfAcc.id,
            is_synced: true,
            balance: balanceNum,
            available_balance: availableBalanceNum,
            currency,
            last_balance_date: lastBalanceDate,
          })
          .select('id')
          .single()
        if (insertErr) {
          console.error('Account insert error:', insertErr.message)
          continue
        }
        accountId = newAcc.id
      }

      accountsSynced++
      const sfHoldings = sfAcc.holdings ?? []

      if (sfHoldings.length > 0) {
        // Deduplicate by holding.id in case SimpleFIN returns duplicates
        const seenHoldingIds = new Set()
        for (const h of sfHoldings) {
          if (seenHoldingIds.has(h.id)) continue
          seenHoldingIds.add(h.id)

          if (logCount < 3) {
            console.log('SimpleFIN holding fields:', {
              allKeys: Object.keys(h),
              id: h.id,
              symbol: h.symbol,
              shares: h.shares,
              market_value: h.market_value,
              cost_basis: h.cost_basis,
              purchase_price: h.purchase_price,
              description: h.description,
              currency: h.currency,
            })
            logCount++
          }

          const mv = parseFloat(h.market_value)
          const sh = parseFloat(h.shares)
          let sharesNum = !isNaN(sh) ? sh : 0
          const costBasisTotal = parseFloat(h.cost_basis) > 0 ? parseFloat(h.cost_basis) : null
          const purchasePrice = parseFloat(h.purchase_price) > 0 ? parseFloat(h.purchase_price) : null

          // Updated avg_cost_basis calculation
          let avgCost
          if (costBasisTotal > 0 && sharesNum > 0) {
            avgCost = costBasisTotal / sharesNum
          } else if (purchasePrice > 0) {
            avgCost = purchasePrice
          } else {
            avgCost = 0
          }

          // Compute last_synced_price: market value per share from SimpleFIN
          const lastSyncedPrice = (!isNaN(mv) && !isNaN(sh) && sh > 0)
            ? mv / sh
            : (!isNaN(mv) && mv > 0 ? mv : null)

          if (sharesNum <= 0 && !isNaN(mv) && mv > 0) {
            sharesNum = 1
          }

          const { error: holdErr } = await supabase
            .from('holdings')
            .upsert(
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

          if (holdErr) {
            console.error('Holding upsert error:', holdErr.message)
          } else {
            holdingsSynced++
          }
        }
      } else if (sfAcc.balance != null) {
        // Cash account — store as CASH holding
        // Use 0.01 minimum to satisfy the avg_cost_basis > 0 check constraint
        const cashBalance = Math.max(parseFloat(sfAcc.balance ?? 0), 0.01)
        const { error: cashErr } = await supabase
          .from('holdings')
          .upsert(
            {
              account_id: accountId,
              ticker: 'CASH',
              shares: 1,
              avg_cost_basis: cashBalance,
              simplefin_id: `${sfAcc.id}-cash`,
              is_synced: true,
              last_synced_price: null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'account_id,simplefin_id' },
          )

        if (cashErr) {
          console.error('Cash holding upsert error:', cashErr.message)
        } else {
          holdingsSynced++
        }
      }

      // Sync transactions
      const sfTransactions = sfAcc.transactions ?? []
      for (const tx of sfTransactions) {
        if (!tx.id) continue
        const amount = parseFloat(tx.amount)
        if (amount === 0 || isNaN(amount)) continue

        const { error: txErr } = await supabase
          .from('transactions')
          .upsert(
            {
              account_id: accountId,
              user_id: user.id,
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
              tx_type: amount > 0 ? 'credit' : 'debit',
            },
            { onConflict: 'simplefin_id' },
          )

        if (txErr) {
          console.error('Transaction upsert error:', txErr.message)
        } else {
          transactionsSynced++
        }
      }
    }

    // Update last_synced_at
    await supabase
      .from('simplefin_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('user_id', user.id)

    return Response.json({ success: true, accountsSynced, holdingsSynced, transactionsSynced })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
