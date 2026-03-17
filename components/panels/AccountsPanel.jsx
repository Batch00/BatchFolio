'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
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
import { Trash2, Plus, ChevronDown, ChevronRight } from 'lucide-react'

const fmt = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v ?? 0)

export default function AccountsPanel({ onOpenDetail }) {
  const supabase = createClient()
  const [accounts, setAccounts] = useState([])
  const [holdings, setHoldings] = useState({})
  const [prices, setPrices] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState({})

  // Add account dialog
  const [accDialog, setAccDialog] = useState(false)
  const [accName, setAccName] = useState('')
  const [accProvider, setAccProvider] = useState('')
  const [accType, setAccType] = useState('brokerage')
  const [accSaving, setAccSaving] = useState(false)
  const [accError, setAccError] = useState(null)

  // Add holding dialog
  const [holdDialog, setHoldDialog] = useState(false)
  const [holdAccountId, setHoldAccountId] = useState(null)
  const [holdTicker, setHoldTicker] = useState('')
  const [holdShares, setHoldShares] = useState('')
  const [holdCost, setHoldCost] = useState('')
  const [holdSaving, setHoldSaving] = useState(false)
  const [holdError, setHoldError] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data: accs, error: accErr } = await supabase
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: false })

    if (accErr) { setError(accErr.message); setLoading(false); return }

    const { data: allHoldings, error: holdErr } = await supabase
      .from('holdings')
      .select('*')
      .order('ticker')

    if (holdErr) { setError(holdErr.message); setLoading(false); return }

    const grouped = {}
    for (const acc of (accs ?? [])) grouped[acc.id] = []
    for (const h of (allHoldings ?? [])) {
      if (!grouped[h.account_id]) grouped[h.account_id] = []
      grouped[h.account_id].push(h)
    }

    const tickers = [...new Set((allHoldings ?? []).map((h) => h.ticker))]
    const priceResults = await Promise.all(
      tickers.map((t) =>
        fetch(`/api/stock/quote?ticker=${t}`)
          .then((r) => r.json())
          .then((q) => ({ t, q }))
          .catch(() => ({ t, q: null }))
      )
    )
    const priceMap = {}
    priceResults.forEach(({ t, q }) => { if (q) priceMap[t] = q })

    setAccounts(accs ?? [])
    setHoldings(grouped)
    setPrices(priceMap)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function accountTotal(accountId) {
    return (holdings[accountId] ?? []).reduce(
      (sum, h) => sum + h.shares * (prices[h.ticker]?.price ?? 0),
      0
    )
  }

  async function addAccount(e) {
    e.preventDefault()
    setAccSaving(true)
    setAccError(null)
    const { data: { user } } = await supabase.auth.getUser()
    const { error: err } = await supabase.from('accounts').insert({
      user_id: user.id,
      name: accName.trim(),
      provider: accProvider.trim(),
      type: accType,
    })
    if (err) {
      setAccError(err.message)
    } else {
      setAccDialog(false)
      setAccName(''); setAccProvider(''); setAccType('brokerage')
      await loadData()
    }
    setAccSaving(false)
  }

  async function deleteAccount(id) {
    if (!confirm('Delete this account and all its holdings?')) return
    await supabase.from('accounts').delete().eq('id', id)
    await loadData()
  }

  function openAddHolding(accountId) {
    setHoldAccountId(accountId)
    setHoldTicker(''); setHoldShares(''); setHoldCost('')
    setHoldError(null)
    setHoldDialog(true)
  }

  async function addHolding(e) {
    e.preventDefault()
    setHoldSaving(true)
    setHoldError(null)
    const { error: err } = await supabase.from('holdings').insert({
      account_id: holdAccountId,
      ticker: holdTicker.toUpperCase().trim(),
      shares: parseFloat(holdShares),
      avg_cost_basis: parseFloat(holdCost),
    })
    if (err) {
      setHoldError(err.message)
    } else {
      setHoldDialog(false)
      await loadData()
    }
    setHoldSaving(false)
  }

  async function deleteHolding(id) {
    if (!confirm('Remove this holding?')) return
    await supabase.from('holdings').delete().eq('id', id)
    await loadData()
  }

  function toggleExpand(id) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[#21262d] flex items-center justify-between flex-shrink-0">
        <p className="text-xs text-[#7d8590] uppercase tracking-wider">Accounts</p>
        <button
          onClick={() => { setAccError(null); setAccDialog(true) }}
          className="text-xs text-[#10b981] hover:text-[#34d399] transition-colors flex items-center gap-1"
        >
          <Plus className="h-3 w-3" />
          Add
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {error && <p className="p-3 text-xs text-[#f87171]">{error}</p>}
        {loading ? (
          <div className="p-3 space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14" />)}
          </div>
        ) : accounts.length === 0 ? (
          <p className="p-4 text-sm text-[#7d8590]">No accounts yet.</p>
        ) : (
          <div>
            {accounts.map((acc) => {
              const total = accountTotal(acc.id)
              const holdList = holdings[acc.id] ?? []
              const isExpanded = expanded[acc.id]

              return (
                <div key={acc.id} className="border-b border-[#21262d]">
                  {/* Account row */}
                  <div className="flex items-center px-4 py-3">
                    <button
                      onClick={() => toggleExpand(acc.id)}
                      className="flex-1 flex items-center gap-2 text-left min-w-0"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-[#7d8590] flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-[#7d8590] flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#e6edf3] truncate">{acc.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-[#7d8590]">{acc.provider}</span>
                          <Badge variant="secondary" className="text-xs py-0 h-4">{acc.type}</Badge>
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                      <span className="font-mono text-sm text-[#e6edf3]">{fmt(total)}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteAccount(acc.id) }}
                        className="text-[#7d8590] hover:text-[#f87171] transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded holdings */}
                  {isExpanded && (
                    <div className="bg-[#161b22] border-t border-[#21262d] px-4 py-2">
                      <div className="flex justify-end mb-2">
                        <button
                          onClick={() => openAddHolding(acc.id)}
                          className="text-xs text-[#10b981] hover:text-[#34d399] transition-colors flex items-center gap-1"
                        >
                          <Plus className="h-3 w-3" />
                          Add Holding
                        </button>
                      </div>
                      {holdList.length === 0 ? (
                        <p className="text-xs text-[#7d8590] py-1">No holdings in this account.</p>
                      ) : (
                        <div className="space-y-0.5">
                          {holdList.map((h) => {
                            const livePrice = prices[h.ticker]?.price ?? 0
                            const value = h.shares * livePrice
                            const costBasis = h.shares * h.avg_cost_basis
                            const gainLoss = value - costBasis
                            const gainPct = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0
                            const positive = gainLoss >= 0
                            return (
                              <div key={h.id} className="flex items-center justify-between py-1.5">
                                <button
                                  onClick={() => onOpenDetail({ type: 'stock', ticker: h.ticker })}
                                  className="text-left min-w-0"
                                >
                                  <p className="font-mono text-xs text-[#10b981] hover:text-[#34d399] transition-colors">
                                    {h.ticker}
                                  </p>
                                  <p className="text-xs text-[#7d8590]">{h.shares} shares</p>
                                </button>
                                <div className="flex items-center gap-2 ml-2">
                                  <div className="text-right">
                                    <p className="font-mono text-xs text-[#e6edf3]">{fmt(value)}</p>
                                    <p className={`font-mono text-xs ${positive ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                                      {positive ? '+' : ''}{gainPct.toFixed(2)}%
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => deleteHolding(h.id)}
                                    className="text-[#7d8590] hover:text-[#f87171] transition-colors"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Account Dialog */}
      <Dialog open={accDialog} onOpenChange={setAccDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Account</DialogTitle>
          </DialogHeader>
          <form onSubmit={addAccount} className="space-y-4 mt-2">
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
            {accError && <p className="text-sm text-[#f87171]">{accError}</p>}
            <Button type="submit" className="w-full" disabled={accSaving}>
              {accSaving ? 'Adding...' : 'Add Account'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Holding Dialog */}
      <Dialog open={holdDialog} onOpenChange={setHoldDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Holding</DialogTitle>
          </DialogHeader>
          <form onSubmit={addHolding} className="space-y-4 mt-2">
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
            {holdError && <p className="text-sm text-[#f87171]">{holdError}</p>}
            <Button type="submit" className="w-full" disabled={holdSaving}>
              {holdSaving ? 'Adding...' : 'Add Holding'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
