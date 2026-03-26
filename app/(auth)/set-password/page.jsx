'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function SetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Create a fresh client directly — do not use the
    // shared createClient() wrapper which has flowType: 'pkce'
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    )

    // The /auth/v1/verify link sets the session via a
    // server-side redirect — by the time the user lands
    // on this page the session cookie should already exist.
    const checkSession = async () => {
      // Wait for any cookie processing to complete
      await new Promise((resolve) => setTimeout(resolve, 800))

      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        setSessionReady(true)
      }
      setChecking(false)
    }

    checkSession()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    )

    const { error: err } = await supabase.auth.updateUser({ password })

    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      router.push('/')
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d1117]">
        <span className="font-mono text-sm text-[#7d8590]">Verifying invite link...</span>
      </div>
    )
  }

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d1117] px-4">
        <div className="w-full max-w-sm">
          <div className="bg-[#161b22] border border-[#21262d] rounded-md p-6 text-center">
            <p className="text-sm text-[#e6edf3] mb-1">Invite link invalid or expired</p>
            <p className="text-xs text-[#7d8590]">
              Contact the administrator to request a new invite.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0d1117] px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-3">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="18" width="6" height="10" rx="1" fill="#10b981" opacity="0.4" />
              <rect x="13" y="12" width="6" height="16" rx="1" fill="#10b981" opacity="0.7" />
              <rect x="22" y="6" width="6" height="22" rx="1" fill="#10b981" />
            </svg>
          </div>
          <span className="text-2xl font-semibold">
            <span className="text-[#7d8590]">Batch</span>
            <span className="text-[#10b981]">Folio</span>
          </span>
        </div>

        <div className="bg-[#161b22] border border-[#21262d] rounded-md p-6">
          <div className="mb-5">
            <h1 className="text-base font-semibold text-[#e6edf3]">Welcome to BatchFolio</h1>
            <p className="text-sm text-[#7d8590] mt-1">Set your password to get started</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat password"
                required
                autoComplete="new-password"
              />
            </div>

            {error && (
              <p className="text-sm text-[#f87171]">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Setting password...' : 'Set password'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
