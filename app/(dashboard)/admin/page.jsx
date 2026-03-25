'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft, Trash2 } from 'lucide-react'

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()

  const [checking, setChecking] = useState(true)
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const [invitedUsers, setInvitedUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [revoking, setRevoking] = useState(null) // userId being revoked

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        router.replace('/')
      } else {
        setChecking(false)
      }
    })
  }, [router])

  const loadInvitedUsers = useCallback(async () => {
    setLoadingUsers(true)
    try {
      const res = await fetch('/api/admin/list-invites')
      const json = await res.json()
      setInvitedUsers(json.users ?? [])
    } catch {
      setInvitedUsers([])
    } finally {
      setLoadingUsers(false)
    }
  }, [])

  useEffect(() => {
    if (!checking) loadInvitedUsers()
  }, [checking, loadInvitedUsers])

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch('/api/admin/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const json = await res.json()
      console.log('[send-invite] response:', res.status, json)

      if (!res.ok || json.error) {
        setError(json.error ?? 'Failed to send invite')
      } else {
        setSuccess(true)
        setEmail('')
        loadInvitedUsers()
      }
    } catch (err) {
      console.error('[send-invite] fetch error:', err)
      setError(err.message ?? 'Request failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRevoke(userId) {
    setRevoking(userId)
    try {
      const res = await fetch('/api/admin/revoke-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const json = await res.json()
      if (json.success) {
        loadInvitedUsers()
      }
    } finally {
      setRevoking(null)
    }
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

      {/* Invited users table */}
      <div className="bg-[#161b22] border border-[#21262d] rounded-md overflow-hidden">
        <div className="px-4 py-3 border-b border-[#21262d]">
          <p
            className="uppercase text-[#7d8590]"
            style={{ fontSize: 10, letterSpacing: '0.08em' }}
          >
            Invited Users
          </p>
        </div>

        {loadingUsers ? (
          <div className="px-4 py-3 space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-3/4" />
          </div>
        ) : invitedUsers.length === 0 ? (
          <div className="px-4 py-6 flex items-center justify-center">
            <p className="text-sm text-[#7d8590]">No pending invites</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Invited At</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitedUsers.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-mono text-xs">{u.email}</TableCell>
                  <TableCell className="text-xs text-[#7d8590]">
                    {new Date(u.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </TableCell>
                  <TableCell>
                    <span
                      style={{
                        background: 'rgba(251,191,36,0.1)',
                        color: '#fbbf24',
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 4,
                      }}
                    >
                      Pending
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      onClick={() => handleRevoke(u.id)}
                      disabled={revoking === u.id}
                      className="text-[#7d8590] hover:text-[#f87171] transition-colors disabled:opacity-40"
                      aria-label="Revoke invite"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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
