import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-server'

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
)

export async function POST(request) {
  try {
    // Verify requesting user is admin
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { email } = await request.json()
    if (!email) {
      return Response.json({ error: 'Email required' }, { status: 400 })
    }

    // Important: https://batchfolio.batch-apps.com
    // must be listed in Supabase dashboard > Authentication >
    // URL Configuration > Redirect URLs
    const invitePromise = supabaseAdmin.auth.admin.inviteUserByEmail(
      email.toLowerCase().trim(),
      { redirectTo: 'https://batchfolio.batch-apps.com' },
    )

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Invite request timed out after 10 seconds')), 10_000),
    )

    const { error } = await Promise.race([invitePromise, timeoutPromise])

    if (error) {
      return Response.json({ error: error.message || 'Unknown error' }, { status: 500 })
    }

    return Response.json({ success: true, email })
  } catch (err) {
    return Response.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}
