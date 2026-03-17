'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { Trash2, Plus } from 'lucide-react'

const fmt = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v ?? 0)

async function fetchQuote(ticker) {
  const res = await fetch(`/api/stock/quote?ticker=${ticker}`)
  if (!res.ok) return null
  return res.json()
}

export default function AccountsPage() {
  const supabase = createClient()
  const [accounts, setAccounts] = useState([])
  const [holdings, setHoldings] = useState({}) // accountId -> holdings[]
  const [prices, setPrices] = useState({})      // ticker -> quote
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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

    // Group holdings by account
    const grouped = {}
    for (const acc of (accs ?? [])) grouped[acc.id] = []
    for (const h of (allHoldings ?? [])) {
      if (!grouped[h.account_id]) grouped[h.account_id] = []
      grouped[h.account_id].push(h)
    }

    // Fetch prices for all unique tickers
    const tickers = [...new Set((allHoldings ?? []).map((h) => h.ticker))]
    const priceResults = await Promise.all(tickers.map((t) => fetchQuote(t).then((q) => ({ t, q }))))
    const priceMap = {}
    priceResults.forEach(({ t, q }) => { if (q) priceMap[t] = q })

    setAccounts(accs ?? [])
    setHoldings(grouped)
    setPrices(priceMap)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

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

  function accountTotal(accountId) {
    return (holdings[accountId] ?? []).reduce((sum, h) => {
      const price = prices[h.ticker]?.price ?? 0
      return sum + h.shares * price
    }, 0)
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[#e6edf3]">Accounts</h1>
        <Button size="sm" onClick={() => { setAccError(null); setAccDialog(true) }}>
          Add Account
        </Button>
      </div>

      {error && <p className="text-sm text-[#f87171] mb-4">{error}</p>}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-[#7d8590]">No accounts yet.</p>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {accounts.map((acc) => {
            const total = accountTotal(acc.id)
            const holdList = holdings[acc.id] ?? []

            return (
              <AccordionItem
                key={acc.id}
                value={acc.id}
                className="bg-[#161b22] border border-[#21262d] rounded-md px-4 !border-b-0"
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 flex-1 mr-4">
                    <div className="flex-1 text-left">
                      <span className="text-sm text-[#e6edf3] font-medium">{acc.name}</span>
                      <span className="ml-2 text-xs text-[#7d8590]">{acc.provider}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">{acc.type}</Badge>
                    <span className="font-mono text-sm text-[#e6edf3]">{fmt(total)}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteAccount(acc.id) }}
                      className="text-[#7d8590] hover:text-[#f87171] transition-colors ml-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </AccordionTrigger>

                <AccordionContent>
                  <div className="mb-2 flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openAddHolding(acc.id)}
                      className="h-7 text-xs gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      Add Holding
                    </Button>
                  </div>

                  {holdList.length === 0 ? (
                    <p className="text-xs text-[#7d8590] py-2">No holdings in this account.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ticker</TableHead>
                          <TableHead className="text-right">Shares</TableHead>
                          <TableHead className="text-right">Avg Cost</TableHead>
                          <TableHead className="text-right">Live Price</TableHead>
                          <TableHead className="text-right">Value</TableHead>
                          <TableHead className="text-right">Gain/Loss</TableHead>
                          <TableHead className="text-right">Gain/Loss %</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {holdList.map((h) => {
                          const livePrice = prices[h.ticker]?.price ?? 0
                          const value = h.shares * livePrice
                          const costBasis = h.shares * h.avg_cost_basis
                          const gainLoss = value - costBasis
                          const gainPct = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0
                          const positive = gainLoss >= 0

                          return (
                            <TableRow key={h.id}>
                              <TableCell>
                                <Link
                                  href={`/stock/${h.ticker}`}
                                  className="font-mono text-[#10b981] hover:text-[#34d399] transition-colors"
                                >
                                  {h.ticker}
                                </Link>
                              </TableCell>
                              <TableCell className="text-right font-mono">{h.shares}</TableCell>
                              <TableCell className="text-right font-mono">{fmt(h.avg_cost_basis)}</TableCell>
                              <TableCell className="text-right font-mono">
                                {livePrice ? fmt(livePrice) : <span className="text-[#7d8590]">--</span>}
                              </TableCell>
                              <TableCell className="text-right font-mono">{fmt(value)}</TableCell>
                              <TableCell className={`text-right font-mono ${positive ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                                {positive ? '+' : ''}{fmt(gainLoss)}
                              </TableCell>
                              <TableCell className={`text-right font-mono ${positive ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                                {positive ? '+' : ''}{gainPct.toFixed(2)}%
                              </TableCell>
                              <TableCell>
                                <button
                                  onClick={() => deleteHolding(h.id)}
                                  className="text-[#7d8590] hover:text-[#f87171] transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  )}
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      )}

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
