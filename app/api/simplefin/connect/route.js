import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(request) {
  try {
    const { setupToken } = await request.json()
    if (!setupToken) {
      return Response.json({ error: 'setupToken is required' }, { status: 400 })
    }

    // Decode base64 setup token to get claim URL
    const claimUrl = Buffer.from(setupToken.trim(), 'base64').toString('utf-8')

    // POST to claim URL to exchange for access URL (one-time use)
    const claimRes = await fetch(claimUrl, { method: 'POST' })
    if (!claimRes.ok) {
      throw new Error(`Failed to claim setup token: ${claimRes.status}`)
    }
    const accessUrl = (await claimRes.text()).trim()

    if (!accessUrl.startsWith('http')) {
      throw new Error('Invalid access URL returned from SimpleFIN')
    }

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

    // Use service role to write — bypasses RLS
    const supabaseService = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SERVICE_ROLE_KEY,
      {
        auth: { autoRefreshToken: false, persistSession: false },
        db: { schema: 'batchfolio' },
      },
    )

    const { error: upsertErr } = await supabaseService
      .from('simplefin_connections')
      .upsert(
        { user_id: user.id, access_url: accessUrl, last_synced_at: null },
        { onConflict: 'user_id' },
      )

    if (upsertErr) throw new Error(upsertErr.message)

    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
