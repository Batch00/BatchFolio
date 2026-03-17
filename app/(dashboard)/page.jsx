'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import StatCard from '@/components/StatCard'
import NetWorthChart from '@/components/NetWorthChart'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function DashboardPage() {
  const supabase = createClient()
  const [snapshots, setSnapshots] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [assets, setAssets] = useState('')
  const [liabilities, setLiabilities] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)

    const [snapshotsRes, accountsRes] = await Promise.all([
      supabase.from('net_worth_snapshots').select('*').order('date', { ascending: true }),
      supabase.from('accounts').select('*').order('created_at', { ascending: false }).limit(5),
    ])

    if (snapshotsRes.error) {
      setError(snapshotsRes.error.message)
    } else {
      setSnapshots(snapshotsRes.data ?? [])
    }

    if (!accountsRes.error) {
      setAccounts(accountsRes.data ?? [])
    }

    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const latest = snapshots[snapshots.length - 1]
  const totalAssets = latest?.total_assets ?? 0
  const totalLiabilities = latest?.total_liabilities ?? 0
  const netWorth = latest?.net_worth ?? 0

  const computedNetWorth =
    assets && liabilities
      ? (parseFloat(assets || 0) - parseFloat(liabilities || 0)).toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
        })
      : null

  async function handleAddSnapshot(e) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const assetsVal = parseFloat(assets)
    const liabVal = parseFloat(liabilities)

    const { error: err } = await supabase.from('net_worth_snapshots').insert({
      user_id: user.id,
      date: new Date().toISOString().split('T')[0],
      total_assets: assetsVal,
      total_liabilities: liabVal,
      net_worth: assetsVal - liabVal,
    })

    if (err) {
      setSaveError(err.message)
    } else {
      setDialogOpen(false)
      setAssets('')
      setLiabilities('')
      await load()
    }

    setSaving(false)
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[#e6edf3]">Dashboard</h1>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          Add Snapshot
        </Button>
      </div>

      {error && <p className="text-sm text-[#f87171] mb-4">{error}</p>}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {loading ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        ) : (
          <>
            <StatCard label="Total Assets" value={totalAssets} />
            <StatCard label="Total Liabilities" value={totalLiabilities} negative />
            <StatCard label="Net Worth" value={netWorth} highlight />
          </>
        )}
      </div>

      {/* Net Worth Chart */}
      <div className="bg-[#161b22] border border-[#21262d] rounded-md p-4 mb-6">
        <h2 className="text-sm font-medium text-[#7d8590] mb-4">Net Worth Over Time</h2>
        {loading ? <Skeleton className="h-60" /> : <NetWorthChart data={snapshots} />}
      </div>

      {/* Recent Accounts */}
      <div className="bg-[#161b22] border border-[#21262d] rounded-md p-4">
        <h2 className="text-sm font-medium text-[#7d8590] mb-3">Recent Accounts</h2>
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-[#7d8590]">No accounts yet. Add one in Accounts.</p>
        ) : (
          <div className="divide-y divide-[#21262d]">
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm text-[#e6edf3]">{a.name}</p>
                  <p className="text-xs text-[#7d8590]">
                    {a.provider} &middot; {a.type}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Snapshot Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Net Worth Snapshot</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddSnapshot} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Total Assets</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={assets}
                onChange={(e) => setAssets(e.target.value)}
                placeholder="0.00"
                className="font-mono"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Total Liabilities</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={liabilities}
                onChange={(e) => setLiabilities(e.target.value)}
                placeholder="0.00"
                className="font-mono"
                required
              />
            </div>
            {computedNetWorth && (
              <p className="text-xs text-[#7d8590]">
                Net Worth: <span className="font-mono text-[#e6edf3]">{computedNetWorth}</span>
              </p>
            )}
            {saveError && <p className="text-sm text-[#f87171]">{saveError}</p>}
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? 'Saving...' : 'Save Snapshot'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
