'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()

  const [checking, setChecking] = useState(true)
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [invites, setInvites] = useState([])
  const [loadingInvites, setLoadingInvites] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        router.replace('/')
      } else {
        setChecking(false)
      }
    })
  }, [router])

  const loadInvites = useCallback(async () => {
    setLoadingInvites(true)
    const res = await fetch('/api/admin/invites')
    const json = await res.json()
    setInvites(json.invites ?? [])
    setLoadingInvites(false)
  }, [])

  useEffect(() => {
    if (!checking) loadInvites()
  }, [checking, loadInvites])

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
      loadInvites()
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

      {/* Invites table */}
      <div className="bg-[#161b22] border border-[#21262d] rounded-md overflow-hidden">
        <div className="px-4 py-3 border-b border-[#21262d]">
          <p className="text-xs text-[#7d8590] uppercase tracking-wider">All Invites</p>
        </div>
        {loadingInvites ? (
          <div className="px-4 py-6 text-sm text-[#7d8590]">Loading...</div>
        ) : invites.length === 0 ? (
          <div className="px-4 py-6 text-sm text-[#7d8590]">No invites yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Invited At</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-xs">{inv.email}</TableCell>
                  <TableCell className="text-xs text-[#7d8590]">
                    {new Date(inv.invited_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`text-xs font-mono px-2 py-0.5 rounded border ${
                        inv.used
                          ? 'text-[#7d8590] border-[#21262d]'
                          : 'text-[#10b981] border-[#10b981]/30 bg-[rgba(16,185,129,0.06)]'
                      }`}
                    >
                      {inv.used ? 'Used' : 'Pending'}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
