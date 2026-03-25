'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft } from 'lucide-react'

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()

  const [checking, setChecking] = useState(true)
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        router.replace('/')
      } else {
        setChecking(false)
      }
    })
  }, [router])

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(false)

    const res = await fetch('/api/admin/send-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const json = await res.json()

    if (!res.ok || json.error) {
      setError(json.error ?? 'Failed to send invite')
    } else {
      setSuccess(true)
      setEmail('')
    }
    setSubmitting(false)
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-sm text-[#7d8590]">Loading...</span>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs text-[#7d8590] hover:text-[#e6edf3] transition-colors mb-5"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </Link>

      <div className="mb-6">
        <h1 className="text-lg font-semibold text-[#e6edf3] mb-1">Invite Management</h1>
        <p className="text-sm text-[#7d8590]">
          Send invites to allow new users to sign up for BatchFolio
        </p>
      </div>

      {/* Invite form */}
      <div className="bg-[#161b22] border border-[#21262d] rounded-md p-4 mb-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setSuccess(false)
                setError(null)
              }}
              placeholder="user@example.com"
              required
            />
          </div>

          {error && <p className="text-sm text-[#f87171]">{error}</p>}

          {success && (
            <div className="bg-[rgba(16,185,129,0.08)] border border-[#10b981]/20 rounded px-3 py-2.5">
              <p className="text-sm text-[#10b981]">Invite sent.</p>
              <p className="text-xs text-[#7d8590] mt-1">
                They will receive an email with a link to set their password and access BatchFolio.
              </p>
            </div>
          )}

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Sending...' : 'Send Invite'}
          </Button>
        </form>
      </div>

      {/* Invites note */}
      <div className="bg-[#161b22] border border-[#21262d] rounded-md overflow-hidden">
        <div className="px-4 py-3 border-b border-[#21262d]">
          <p className="text-xs text-[#7d8590] uppercase tracking-wider">All Invites</p>
        </div>
        <div className="px-4 py-6 flex items-center justify-center">
          <p className="text-[#7d8590] text-center" style={{ fontSize: 13 }}>
            Invites are managed by Supabase. View invited users in the Supabase dashboard under Authentication &gt; Users.
          </p>
        </div>
      </div>
    </div>
  )
}
