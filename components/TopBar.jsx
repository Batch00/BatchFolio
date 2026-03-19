'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Settings, LayoutDashboard, Briefcase, PieChart, Star } from 'lucide-react'

const TABS = [
  { id: 'overview', label: 'OVERVIEW', icon: LayoutDashboard },
  { id: 'accounts', label: 'ACCOUNTS', icon: Briefcase },
  { id: 'portfolio', label: 'PORTFOLIO', icon: PieChart },
  { id: 'watchlist', label: 'WATCHLIST', icon: Star },
]

const ADD_TYPES = [
  { id: 'account', label: 'Add Account' },
  { id: 'holding', label: 'Add Holding' },
  { id: 'snapshot', label: 'Add Snapshot' },
  { id: 'watchlist', label: 'Add Watchlist Ticker' },
]

const fmt = (v) =>
  v == null
    ? '--'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v)

export default function TopBar({
  activeTab,
  onTabChange,
  netWorth,
  netWorthChange,
  netWorthChangePositive,
}) {
  const supabase = createClient()

  const [addOpen, setAddOpen] = useState(false)
  const [addType, setAddType] = useState('account')

  const [accounts, setAccounts] = useState([])
  const [accName, setAccName] = useState('')
  const [accProvider, setAccProvider] = useState('')
  const [accType, setAccType] = useState('brokerage')

  const [holdAccountId, setHoldAccountId] = useState('')
  const [holdTicker, setHoldTicker] = useState('')
  const [holdShares, setHoldShares] = useState('')
  const [holdCost, setHoldCost] = useState('')

  const [snapAssets, setSnapAssets] = useState('')
  const [snapLiabilities, setSnapLiabilities] = useState('')

  const [wlTicker, setWlTicker] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  async function handleOpen() {
    setError(null)
    setSuccess(null)
    setAddOpen(true)
    const { data } = await supabase
      .from('accounts')
      .select('id, name')
      .order('created_at', { ascending: false })
    setAccounts(data ?? [])
    if (data?.length) setHoldAccountId(data[0].id)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (addType === 'account') {
        const { error: err } = await supabase.from('accounts').insert({
          user_id: user.id,
          name: accName.trim(),
          provider: accProvider.trim(),
          type: accType,
        })
        if (err) throw err
        setAccName('')
        setAccProvider('')
        setAccType('brokerage')
        setSuccess('Account added.')
      }

      if (addType === 'holding') {
        const { error: err } = await supabase.from('holdings').insert({
          account_id: holdAccountId,
          ticker: holdTicker.toUpperCase().trim(),
          shares: parseFloat(holdShares),
          avg_cost_basis: parseFloat(holdCost),
        })
        if (err) throw err
        setHoldTicker('')
        setHoldShares('')
        setHoldCost('')
        setSuccess('Holding added.')
      }

      if (addType === 'snapshot') {
        const assets = parseFloat(snapAssets)
        const liabilities = parseFloat(snapLiabilities)
        const { error: err } = await supabase.from('net_worth_snapshots').insert({
          user_id: user.id,
          date: new Date().toISOString().split('T')[0],
          total_assets: assets,
          total_liabilities: liabilities,
          net_worth: assets - liabilities,
        })
        if (err) throw err
        setSnapAssets('')
        setSnapLiabilities('')
        setSuccess('Snapshot saved.')
      }

      if (addType === 'watchlist') {
        const ticker = wlTicker.toUpperCase().trim()
        const { error: err } = await supabase
          .from('watchlist')
          .insert({ user_id: user.id, ticker })
        if (err) {
          if (err.code === '23505') throw new Error(`${ticker} already in watchlist.`)
          throw err
        }
        setWlTicker('')
        setSuccess(`${ticker} added to watchlist.`)
      }

      setTimeout(() => {
        setAddOpen(false)
        setSuccess(null)
      }, 1200)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const computedNetWorth =
    snapAssets && snapLiabilities
      ? parseFloat(snapAssets) - parseFloat(snapLiabilities)
      : null

  return (
    <div className="h-12 flex items-center px-4 border-b border-[#21262d] bg-[#0d1117] flex-shrink-0 sticky top-0 z-30">
      {/* Logo */}
      <div className="flex items-center mr-5 flex-shrink-0">
        <span className="text-[#7d8590] text-[15px] font-medium">Batch</span>
        <span className="text-[#10b981] text-[15px] font-medium">Folio</span>
      </div>

      {/* Tabs - desktop labels, mobile icons */}
      <div className="flex items-center flex-shrink-0">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`h-12 flex items-center gap-1.5 px-3 border-b-2 text-[11px] uppercase tracking-widest font-medium transition-colors ${
                active
                  ? 'border-[#10b981] text-[#10b981]'
                  : 'border-transparent text-[#7d8590] hover:text-[#e6edf3]'
              }`}
            >
              <Icon className="h-3.5 w-3.5 sm:hidden" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          )
        })}
      </div>

      {/* Center: persistent net worth */}
      <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
        {netWorth != null ? (
          <>
            <span className="font-mono text-sm font-semibold text-[#e6edf3] truncate">
              {fmt(netWorth)}
            </span>
            {netWorthChange != null && (
              <span
                className={`font-mono text-xs flex-shrink-0 ${
                  netWorthChangePositive ? 'text-[#34d399]' : 'text-[#f87171]'
                }`}
              >
                {netWorthChangePositive ? '+' : ''}
                {fmt(netWorthChange)}
              </span>
            )}
          </>
        ) : (
          <span className="font-mono text-xs text-[#7d8590]">--</span>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* LIVE indicator */}
        <div className="hidden sm:flex items-center gap-1.5 border border-[#21262d] rounded px-2 py-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10b981]" />
          </span>
          <span className="text-[10px] text-[#7d8590] uppercase tracking-wider">Live</span>
        </div>

        {/* + ADD */}
        <button
          onClick={handleOpen}
          className="border border-[#10b981]/50 bg-[rgba(16,185,129,0.06)] text-[#10b981] hover:bg-[rgba(16,185,129,0.12)] hover:border-[#10b981] transition-colors rounded px-2.5 py-1 text-[11px] uppercase tracking-wider"
        >
          + Add
        </button>

        {/* Settings */}
        <button
          onClick={() => supabase.auth.signOut().then(() => window.location.reload())}
          className="text-[#7d8590] hover:text-[#e6edf3] transition-colors"
          title="Sign out"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add</DialogTitle>
          </DialogHeader>

          {/* Type selector */}
          <div className="flex gap-1.5 flex-wrap">
            {ADD_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setAddType(t.id)
                  setError(null)
                  setSuccess(null)
                }}
                className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                  addType === t.id
                    ? 'border-[#10b981] text-[#10b981] bg-[rgba(16,185,129,0.06)]'
                    : 'border-[#21262d] text-[#7d8590] hover:text-[#e6edf3]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {addType === 'account' && (
              <>
                <div className="space-y-1.5">
                  <Label>Account Name</Label>
                  <Input
                    value={accName}
                    onChange={(e) => setAccName(e.target.value)}
                    placeholder="e.g. Fidelity Brokerage"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Provider</Label>
                  <Input
                    value={accProvider}
                    onChange={(e) => setAccProvider(e.target.value)}
                    placeholder="e.g. Fidelity"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={accType} onValueChange={setAccType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="brokerage">Brokerage</SelectItem>
                      <SelectItem value="retirement">Retirement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {addType === 'holding' && (
              <>
                <div className="space-y-1.5">
                  <Label>Account</Label>
                  <Select value={holdAccountId} onValueChange={setHoldAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Ticker Symbol</Label>
                  <Input
                    value={holdTicker}
                    onChange={(e) => setHoldTicker(e.target.value.toUpperCase())}
                    placeholder="AAPL"
                    className="font-mono uppercase"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Shares</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={holdShares}
                    onChange={(e) => setHoldShares(e.target.value)}
                    placeholder="0"
                    className="font-mono"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Avg Cost Basis (per share)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={holdCost}
                    onChange={(e) => setHoldCost(e.target.value)}
                    placeholder="0.00"
                    className="font-mono"
                    required
                  />
                </div>
              </>
            )}

            {addType === 'snapshot' && (
              <>
                <div className="space-y-1.5">
                  <Label>Total Assets</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={snapAssets}
                    onChange={(e) => setSnapAssets(e.target.value)}
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
                    value={snapLiabilities}
                    onChange={(e) => setSnapLiabilities(e.target.value)}
                    placeholder="0.00"
                    className="font-mono"
                    required
                  />
                </div>
                {computedNetWorth != null && (
                  <p className="text-xs text-[#7d8590]">
                    Net Worth:{' '}
                    <span className="font-mono text-[#e6edf3]">{fmt(computedNetWorth)}</span>
                  </p>
                )}
              </>
            )}

            {addType === 'watchlist' && (
              <div className="space-y-1.5">
                <Label>Ticker Symbol</Label>
                <Input
                  value={wlTicker}
                  onChange={(e) => setWlTicker(e.target.value.toUpperCase())}
                  placeholder="AAPL"
                  className="font-mono uppercase"
                  required
                />
              </div>
            )}

            {error && <p className="text-sm text-[#f87171]">{error}</p>}
            {success && <p className="text-sm text-[#34d399]">{success}</p>}
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
