'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/` },
    })

    if (err) {
      setError(err.message)
    } else {
      setMessage('Check your email to confirm your account.')
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
          <p className="text-sm text-[#7d8590] mt-1">Create your account</p>
        </div>

        <div className="bg-[#161b22] border border-[#21262d] rounded-md p-6">
          {message ? (
            <div className="text-center py-4">
              <p className="text-sm text-[#10b981]">{message}</p>
              <p className="text-xs text-[#7d8590] mt-2">You can close this window.</p>
            </div>
          ) : (
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
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>

              {error && (
                <p className="text-sm text-[#f87171]">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating account...' : 'Create account'}
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-[#7d8590] mt-4">
          Already have an account?{' '}
          <Link href="/login" className="text-[#10b981] hover:text-[#34d399] transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
