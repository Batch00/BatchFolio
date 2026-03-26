'use client'

export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getBrowserClient } from '@/lib/supabase-browser'

function InviteHandler() {
  const router = useRouter()

  useEffect(() => {
    if (!window.location.hash.includes('type=invite')) return

    const supabase = getBrowserClient()

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Strip the hash so a refresh doesn't re-trigger
        window.history.replaceState(
          null,
          '',
          window.location.pathname + window.location.search,
        )
        router.push('/set-password')
      }
    })
  }, [])

  return null
}

export default function DashboardLayout({ children }) {
  return (
    <>
      <InviteHandler />
      {children}
    </>
  )
}
