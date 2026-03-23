import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  const { email } = await request.json()

  if (!email) {
    return Response.json({ allowed: false, message: 'Email required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  const { data: invite } = await supabase
    .from('invites')
    .select('id, used')
    .eq('email', email.toLowerCase().trim())
    .single()

  if (!invite) {
    return Response.json({
      allowed: false,
      message: 'BatchFolio is currently invite-only. Request access at batch-apps.com',
    })
  }

  if (invite.used) {
    return Response.json({
      allowed: false,
      message: 'This invite has already been used.',
    })
  }

  // Mark invite as used
  await supabase.from('invites').update({ used: true }).eq('id', invite.id)

  return Response.json({ allowed: true })
}
