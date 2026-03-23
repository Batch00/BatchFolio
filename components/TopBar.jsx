'use client'

import { useState } from 'react'
import Link from 'next/link'
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
import { Settings, LayoutDashboard, Briefcase, PieChart, Star, ShieldCheck } from 'lucide-react'

const TABS = [
  { id: 'overview',  label: 'OVERVIEW',  icon: LayoutDashboard },
  { id: 'accounts',  label: 'ACCOUNTS',  icon: Briefcase },
  { id: 'portfolio', label: 'PORTFOLIO', icon: PieChart },
  { id: 'watchlist', label: 'WATCHLIST', icon: Star },
]

const ADD_TYPES = [
  { id: 'account',   label: 'Add Account' },
  { id: 'holding',   label: 'Add Holding' },
  { id: 'snapshot',  label: 'Add Snapshot' },
  { id: 'watchlist', label: 'Add Watchlist Ticker' },
]

const fmt = (v) =>
  v == null
    ? '--'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v)

const fmtMobile = (v) =>
  v == null
    ? '--'
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(v)

export default function TopBar({
  activeTab,
  onTabChange,
  netWorth,
  netWorthChange,
  netWorthChangePositive,
  user,
  isDemo,
  onDemoBlock,
}) {
  const supabase = createClient()
  const isAdmin = user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL

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

  const [snapDate, setSnapDate] = useState('')
  const [snapAssets, setSnapAssets] = useState('')
  const [snapLiabilities, setSnapLiabilities] = useState('')
  const [snapPrefilling, setSnapPrefilling] = useState(false)

  const [wlTicker, setWlTicker] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  async function handleOpen() {
    if (isDemo) {
      onDemoBlock?.()
      return
    }
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

  async function loadSnapPrefill() {
    setSnapPrefilling(true)
    const [holdingsRes, liabRes] = await Promise.all([
      supabase.from('holdings').select('*'),
      supabase.from('liabilities').select('balance'),
    ])

    const allHoldings = holdingsRes.data ?? []
    const tickers = [...new Set(allHoldings.map((h) => h.ticker))]

    let portfolioValue = 0
    if (tickers.length > 0) {
      const results = await Promise.all(
        tickers.map((t) =>
          fetch(`/api/stock/quote?ticker=${t}`)
            .then((r) => r.json())
            .then((q) => ({ t, price: q.price ?? 0 }))
            .catch(() => ({ t, price: 0 })),
        ),
      )
      const priceMap = {}
      results.forEach(({ t, price }) => { priceMap[t] = price })
      portfolioValue = allHoldings.reduce(
        (sum, h) => sum + h.shares * (priceMap[h.ticker] ?? 0),
        0,
      )
    }

    const liabTotal = (liabRes.data ?? []).reduce((sum, l) => sum + l.balance, 0)
    setSnapAssets(portfolioValue.toFixed(2))
    setSnapLiabilities(liabTotal.toFixed(2))
    setSnapPrefilling(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser()

      if (addType === 'account') {
        const { error: err } = await supabase.from('accounts').insert({
          user_id: currentUser.id,
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
        const { error: err } = await supabase.from('net_worth_snapshots').upsert(
          {
            user_id: currentUser.id,
            date: snapDate || new Date().toISOString().split('T')[0],
            total_assets: assets,
            total_liabilities: liabilities,
            net_worth: assets - liabilities,
          },
          { onConflict: 'user_id,date' },
        )
        if (err) throw err
        setSnapAssets('')
        setSnapLiabilities('')
        setSnapDate(new Date().toISOString().split('T')[0])
        setSuccess('Snapshot saved.')
      }

      if (addType === 'watchlist') {
        const ticker = wlTicker.toUpperCase().trim()
        const { error: err } = await supabase
          .from('watchlist')
          .insert({ user_id: currentUser.id, ticker })
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

  return (
    <div
      className="flex-shrink-0 sticky top-0 z-30 border-b"
      style={{ borderColor: '#21262d', background: '#0d1117' }}
    >
      {/* Desktop top bar */}
      <div className="hidden md:grid h-12 grid-cols-[1fr_auto_1fr] items-center px-4">
        {/* Left: Logo + Tabs */}
        <div className="flex items-center min-w-0">
          <div className="flex items-center mr-4 flex-shrink-0">
            <span className="text-[#7d8590] text-[15px] font-medium">Batch</span>
            <span className="text-[#10b981] text-[15px] font-medium">Folio</span>
          </div>

          <div className="flex items-center flex-shrink-0">
            {TABS.map(({ id, label }) => {
              const active = activeTab === id
              return (
                <button
                  key={id}
                  onClick={() => onTabChange(id)}
                  className={`h-12 flex items-center px-3 border-b-2 text-[11px] uppercase tracking-widest font-medium transition-colors ${
                    active
                      ? 'border-[#10b981] text-[#10b981]'
                      : 'border-transparent text-[#7d8590] hover:text-[#e6edf3]'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Center: net worth */}
        <div className="flex items-center justify-center gap-2">
          {netWorth != null ? (
            <>
              <span className="font-mono font-semibold text-[#e6edf3]" style={{ fontSize: 14 }}>
                {fmt(netWorth)}
              </span>
              {netWorthChange != null && (
                <span
                  className={`font-mono flex-shrink-0 ${
                    netWorthChangePositive ? 'text-[#34d399]' : 'text-[#f87171]'
                  }`}
                  style={{ fontSize: 12 }}
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
        <div className="flex items-center justify-end gap-2">
          <div className="flex items-center gap-1.5 border border-[#21262d] rounded px-2 py-1">
            <span
              className="inline-flex h-2 w-2 rounded-full bg-[#10b981]"
              style={{ animation: 'live-pulse 2s infinite' }}
            />
            <span className="text-[10px] text-[#7d8590] uppercase tracking-wider">Live</span>
          </div>

          <button
            onClick={handleOpen}
            className="border border-[#10b981]/50 bg-[rgba(16,185,129,0.06)] text-[#10b981] hover:bg-[rgba(16,185,129,0.12)] hover:border-[#10b981] transition-colors rounded px-2.5 py-1 text-[11px] uppercase tracking-wider"
          >
            + Add
          </button>

          {isAdmin && (
            <Link
              href="/admin"
              className="text-[#7d8590] hover:text-[#e6edf3] transition-colors"
              title="Admin"
            >
              <ShieldCheck className="h-4 w-4" />
            </Link>
          )}

          <button
            onClick={() => supabase.auth.signOut().then(() => window.location.reload())}
            className="text-[#7d8590] hover:text-[#e6edf3] transition-colors"
            title="Sign out"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Mobile top bar: logo left + + button right */}
      <div className="md:hidden flex h-12 items-center justify-between px-4">
        <div className="flex items-center">
          <span className="text-[#7d8590] text-[15px] font-medium">Batch</span>
          <span className="text-[#10b981] text-[15px] font-medium">Folio</span>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link
              href="/admin"
              className="text-[#7d8590] hover:text-[#e6edf3] transition-colors"
              title="Admin"
            >
              <ShieldCheck className="h-4 w-4" />
            </Link>
          )}
          <button
            onClick={handleOpen}
            className="border border-[#10b981]/50 bg-[rgba(16,185,129,0.06)] text-[#10b981] hover:bg-[rgba(16,185,129,0.12)] hover:border-[#10b981] transition-colors rounded px-2.5 py-1 text-[11px] uppercase tracking-wider"
          >
            + Add
          </button>
          <button
            onClick={() => supabase.auth.signOut().then(() => window.location.reload())}
            className="text-[#7d8590] hover:text-[#e6edf3] transition-colors"
            title="Sign out"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add</DialogTitle>
          </DialogHeader>

          <div className="flex gap-1.5 flex-wrap">
            {ADD_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setAddType(t.id)
                  setError(null)
                  setSuccess(null)
                  if (t.id === 'snapshot') {
                    setSnapDate(new Date().toISOString().split('T')[0])
                    loadSnapPrefill()
                  }
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
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={snapDate}
                    onChange={(e) => setSnapDate(e.target.value)}
                    className="font-mono"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Total Assets ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={snapPrefilling ? '' : snapAssets}
                    onChange={(e) => setSnapAssets(e.target.value)}
                    placeholder={snapPrefilling ? 'Fetching live data...' : '0.00'}
                    className="font-mono"
                    disabled={snapPrefilling}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Total Liabilities ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={snapPrefilling ? '' : snapLiabilities}
                    onChange={(e) => setSnapLiabilities(e.target.value)}
                    placeholder={snapPrefilling ? 'Fetching live data...' : '0.00'}
                    className="font-mono"
                    disabled={snapPrefilling}
                    required
                  />
                </div>
                <div className="bg-[#0d1117] rounded px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-[#7d8590] mb-1">Net Worth</p>
                  <p className="font-mono text-lg font-semibold text-[#10b981]">
                    {snapAssets && snapLiabilities
                      ? fmt(parseFloat(snapAssets) - parseFloat(snapLiabilities))
                      : '--'}
                  </p>
                </div>
                <p className="text-[11px] text-[#7d8590]">
                  Assets and liabilities are pre-filled from your current data. Adjust if needed.
                </p>
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
