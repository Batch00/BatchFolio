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

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabaseAdmin.auth.admin.listUsers()

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    const pending = (data.users ?? [])
      .filter((u) => !u.confirmed_at)
      .map((u) => ({ id: u.id, email: u.email, created_at: u.created_at }))

    return Response.json({ users: pending })
  } catch (err) {
    return Response.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}
