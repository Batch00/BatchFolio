import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function detectAccountType(name) {
  const lower = name.toLowerCase()
  if (/401k|ira|roth|retirement/.test(lower)) return 'retirement'
  return 'brokerage'
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

    // Check if synced within the last hour
    if (conn.last_synced_at) {
      const lastSynced = new Date(conn.last_synced_at)
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
      if (lastSynced > hourAgo) {
        return Response.json({
          alreadySynced: true,
          message: 'Already synced recently. SimpleFIN updates once per day.',
        })
      }
    }

    // Parse access URL for credentials
    const url = new URL(conn.access_url)
    const username = url.username
    const password = url.password
    const baseUrl = `${url.protocol}//${url.host}${url.pathname}`
    const credentials = Buffer.from(`${username}:${password}`).toString('base64')

    // Fetch accounts from SimpleFIN
    const sfRes = await fetch(`${baseUrl}/accounts?version=2`, {
      headers: { Authorization: `Basic ${credentials}` },
    })
    if (!sfRes.ok) {
      throw new Error(`SimpleFIN returned ${sfRes.status}`)
    }
    const sfData = await sfRes.json()
    const sfAccounts = sfData.accounts ?? []

    let accountsSynced = 0
    let holdingsSynced = 0

    for (const sfAcc of sfAccounts) {
      // Upsert account
      const { data: upsertedAcc, error: accErr } = await supabase
        .from('accounts')
        .upsert(
          {
            user_id: user.id,
            name: sfAcc.name,
            provider: sfAcc.org?.name ?? 'SimpleFIN',
            type: detectAccountType(sfAcc.name),
            simplefin_id: sfAcc.id,
            is_synced: true,
          },
          { onConflict: 'user_id,simplefin_id' },
        )
        .select('id')
        .single()

      if (accErr) {
        console.error('Account upsert error:', accErr.message)
        continue
      }

      accountsSynced++
      const accountId = upsertedAcc.id

      const sfHoldings = sfAcc.holdings ?? []

      if (sfHoldings.length > 0) {
        for (const h of sfHoldings) {
          const sharesNum = parseFloat(h.shares ?? 0)
          const costBasisNum = parseFloat(h.cost_basis ?? 0)
          const avgCost = sharesNum > 0 && costBasisNum > 0 ? costBasisNum / sharesNum : 0

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
        const { error: cashErr } = await supabase
          .from('holdings')
          .upsert(
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

        if (cashErr) {
          console.error('Cash holding upsert error:', cashErr.message)
        } else {
          holdingsSynced++
        }
      }
    }

    // Update last_synced_at
    await supabase
      .from('simplefin_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('user_id', user.id)

    return Response.json({ success: true, accountsSynced, holdingsSynced })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
