'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      setError(err.message)
    } else {
      router.push('/')
      router.refresh()
    }
    setLoading(false)
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
          <p className="text-sm text-[#7d8590] mt-1">Own your portfolio</p>
        </div>

        <div className="bg-[#161b22] border border-[#21262d] rounded-md p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-sm text-[#f87171]">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <div className="flex items-center gap-3 mt-4">
            <div className="flex-1 border-t border-[#21262d]" />
            <span className="text-xs text-[#7d8590]">or</span>
            <div className="flex-1 border-t border-[#21262d]" />
          </div>

          <div className="mt-3">
            <button
              type="button"
              onClick={async () => {
                setLoading(true)
                setError(null)
                const { error: err } = await supabase.auth.signInWithPassword({
                  email: 'demo@batchfolio.app',
                  password: 'demo1234',
                })
                if (err) {
                  setError(err.message)
                  setLoading(false)
                } else {
                  router.push('/')
                  router.refresh()
                }
              }}
              disabled={loading}
              className="w-full border border-[#21262d] bg-transparent text-[#7d8590] hover:text-[#e6edf3] hover:border-[#7d8590] transition-colors rounded-md py-2 text-sm"
            >
              Try a live demo
            </button>
            <p className="text-xs text-[#7d8590] text-center mt-1.5">
              Pre-loaded with sample data. Read-only account.
            </p>
          </div>
        </div>

        <p className="text-center text-[#7d8590] mt-5" style={{ fontSize: 12 }}>
          BatchFolio is invite-only. Contact the administrator to request access.
        </p>
      </div>
    </div>
  )
}
