import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createServiceClient } from '@supabase/supabase-js'

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

    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SERVICE_ROLE_KEY,
      {
        auth: { autoRefreshToken: false, persistSession: false },
        db: { schema: 'batchfolio' },
      },
    )

    // Delete the connection row
    await supabase
      .from('simplefin_connections')
      .delete()
      .eq('user_id', user.id)

    // Set is_synced = false on all user accounts
    const { data: userAccounts } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)

    if (userAccounts?.length) {
      await supabase
        .from('accounts')
        .update({ is_synced: false })
        .eq('user_id', user.id)

      const accountIds = userAccounts.map((a) => a.id)
      await supabase
        .from('holdings')
        .update({ is_synced: false })
        .in('account_id', accountIds)
    }

    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
