'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Link from 'next/link'
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
    <div className="min-h-screen flex items-center justify-center bg-[#0d1117] px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-2xl font-semibold">
            <span className="text-[#7d8590]">Batch</span>
            <span className="text-[#10b981]">Folio</span>
          </span>
          <p className="text-sm text-[#7d8590] mt-1">Sign in to your portfolio</p>
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
        </div>

        <p className="text-center text-sm text-[#7d8590] mt-4">
          No account?{' '}
          <Link href="/signup" className="text-[#10b981] hover:text-[#34d399] transition-colors">
            Create one
          </Link>
        </p>

        {/* Demo login */}
        <div className="flex items-center gap-3 mt-4">
          <div className="flex-1 border-t border-[#21262d]" />
          <span className="text-xs text-[#7d8590]">or</span>
          <div className="flex-1 border-t border-[#21262d]" />
        </div>
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
          className="mt-2 w-full border border-[#21262d] bg-transparent text-[#7d8590] hover:text-[#e6edf3] hover:border-[#7d8590] transition-colors rounded-md py-2 text-sm"
        >
          Try the demo
        </button>
      </div>
    </div>
  )
}
