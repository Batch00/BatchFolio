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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Trash2, Plus, ChevronDown, ChevronRight, Pencil, RefreshCw } from 'lucide-react'

const fmt = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v ?? 0)

function fmtDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function AccountsTab({ onOpenDrawer, isDemo, onDemoBlock }) {
  const supabase = createClient()

  // Accounts + holdings
  const [accounts, setAccounts] = useState([])
  const [holdings, setHoldings] = useState({})
  const [prices, setPrices] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState({})

  const [accDialog, setAccDialog] = useState(false)
  const [accName, setAccName] = useState('')
  const [accProvider, setAccProvider] = useState('')
  const [accType, setAccType] = useState('brokerage')
  const [accSaving, setAccSaving] = useState(false)
  const [accError, setAccError] = useState(null)

  const [holdDialog, setHoldDialog] = useState(false)
  const [holdAccountId, setHoldAccountId] = useState(null)
  const [holdTicker, setHoldTicker] = useState('')
  const [holdShares, setHoldShares] = useState('')
  const [holdCost, setHoldCost] = useState('')
  const [holdSaving, setHoldSaving] = useState(false)
  const [holdError, setHoldError] = useState(null)

  // Liabilities
  const [liabilities, setLiabilities] = useState([])
  const [liabDialog, setLiabDialog] = useState(false)
  const [liabName, setLiabName] = useState('')
  const [liabType, setLiabType] = useState('loan')
  const [liabBalance, setLiabBalance] = useState('')
  const [liabRate, setLiabRate] = useState('')
  const [liabSaving, setLiabSaving] = useState(false)
  const [liabError, setLiabError] = useState(null)

  // Snapshots
  const [snapshots, setSnapshots] = useState([])

  // Edit account state
  const [editAccDialog, setEditAccDialog] = useState(false)
  const [editAccId, setEditAccId] = useState(null)
  const [editAccName, setEditAccName] = useState('')
  const [editAccProvider, setEditAccProvider] = useState('')
  const [editAccType, setEditAccType] = useState('brokerage')
  const [editAccSaving, setEditAccSaving] = useState(false)
  const [editAccError, setEditAccError] = useState(null)
  const [editAccIsSynced, setEditAccIsSynced] = useState(false)

  // Edit holding state
  const [editHoldDialog, setEditHoldDialog] = useState(false)
  const [editHoldId, setEditHoldId] = useState(null)
  const [editHoldTicker, setEditHoldTicker] = useState('')
  const [editHoldShares, setEditHoldShares] = useState('')
  const [editHoldCost, setEditHoldCost] = useState('')
  const [editHoldSaving, setEditHoldSaving] = useState(false)
  const [editHoldError, setEditHoldError] = useState(null)

  // Edit liability state
  const [editLiabDialog, setEditLiabDialog] = useState(false)
  const [editLiabId, setEditLiabId] = useState(null)
  const [editLiabName, setEditLiabName] = useState('')
  const [editLiabType, setEditLiabType] = useState('loan')
  const [editLiabBalance, setEditLiabBalance] = useState('')
  const [editLiabRate, setEditLiabRate] = useState('')
  const [editLiabSaving, setEditLiabSaving] = useState(false)
  const [editLiabError, setEditLiabError] = useState(null)

  // Toast state
  const [toast, setToast] = useState(null)

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [accsRes, holdingsRes, liabRes, snapRes] = await Promise.all([
      supabase.from('accounts').select('*').order('created_at', { ascending: false }),
      supabase.from('holdings').select('*').order('ticker'),
      supabase.from('liabilities').select('*').order('created_at', { ascending: false }),
      supabase
        .from('net_worth_snapshots')
        .select('*')
        .order('date', { ascending: false })
        .limit(12),
    ])

    if (accsRes.error) {
      setError(accsRes.error.message)
      setLoading(false)
      return
    }

    const grouped = {}
    for (const acc of accsRes.data ?? []) grouped[acc.id] = []
    for (const h of holdingsRes.data ?? []) {
      if (!grouped[h.account_id]) grouped[h.account_id] = []
      grouped[h.account_id].push(h)
    }

    const allHoldingsList = holdingsRes.data ?? []

    // Build a per-ticker fallback from synced holdings that have a last_synced_price
    const syncedPriceMap = {}
    for (const h of allHoldingsList) {
      if (h.is_synced && h.last_synced_price > 0) {
        syncedPriceMap[h.ticker] = h.last_synced_price
      }
    }

    // Only call the quote API for tickers that need a live price:
    // non-synced holdings, or synced holdings with no last_synced_price
    const tickersNeedingQuote = [
      ...new Set(
        allHoldingsList
          .filter((h) => h.ticker !== 'CASH' && (!h.is_synced || !h.last_synced_price))
          .map((h) => h.ticker),
      ),
    ]
    const priceResults = await Promise.all(
      tickersNeedingQuote.map((t) =>
        fetch(`/api/stock/quote?ticker=${t}`)
          .then((r) => r.json())
          .then((q) => ({ t, q }))
          .catch(() => ({ t, q: null })),
      ),
    )
    const priceMap = {}
    priceResults.forEach(({ t, q }) => {
      if (q) priceMap[t] = q
    })
    // Apply synced fallback for any ticker with a missing or zero live price
    for (const [ticker, syncedPrice] of Object.entries(syncedPriceMap)) {
      if (!priceMap[ticker] || !(priceMap[ticker].price > 0)) {
        priceMap[ticker] = { price: syncedPrice }
      }
    }

    setAccounts(accsRes.data ?? [])
    setHoldings(grouped)
    setPrices(priceMap)
    setLiabilities(liabRes.data ?? [])
    setSnapshots(snapRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  function accountTotal(accountId) {
    return (holdings[accountId] ?? []).reduce((sum, h) => {
      if (h.ticker === 'CASH') return sum + h.avg_cost_basis
      return sum + h.shares * (prices[h.ticker]?.price ?? 0)
    }, 0)
  }

  // Account CRUD
  async function addAccount(e) {
    e.preventDefault()
    if (isDemo) { onDemoBlock?.(); return }
    setAccSaving(true)
    setAccError(null)
    const {
      data: { user },
    } = await supabase.auth.getUser()
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
      setAccName('')
      setAccProvider('')
      setAccType('brokerage')
      await loadData()
    }
    setAccSaving(false)
  }

  async function deleteAccount(id) {
    if (isDemo) { onDemoBlock?.(); return }
    if (!confirm('Delete this account and all its holdings?')) return
    await supabase.from('accounts').delete().eq('id', id)
    await loadData()
  }

  function openEditAccount(acc) {
    if (isDemo) { onDemoBlock?.(); return }
    setEditAccId(acc.id)
    setEditAccName(acc.name)
    setEditAccProvider(acc.provider)
    setEditAccType(acc.type)
    setEditAccIsSynced(acc.is_synced ?? false)
    setEditAccError(null)
    setEditAccDialog(true)
  }

  async function saveEditAccount(e) {
    e.preventDefault()
    if (isDemo) { onDemoBlock?.(); return }
    setEditAccSaving(true)
    setEditAccError(null)
    // Synced accounts: only name is user-editable; provider/type come from SimpleFIN
    const updatePayload = editAccIsSynced
      ? { name: editAccName.trim() }
      : { name: editAccName.trim(), provider: editAccProvider.trim(), type: editAccType }
    const { error: err } = await supabase
      .from('accounts')
      .update(updatePayload)
      .eq('id', editAccId)
    if (err) {
      setEditAccError(err.message)
    } else {
      setEditAccDialog(false)
      showToast('Account updated')
      await loadData()
    }
    setEditAccSaving(false)
  }

  // Holding CRUD
  function openAddHolding(accountId) {
    setHoldAccountId(accountId)
    setHoldTicker('')
    setHoldShares('')
    setHoldCost('')
    setHoldError(null)
    setHoldDialog(true)
  }

  async function addHolding(e) {
    e.preventDefault()
    if (isDemo) { onDemoBlock?.(); return }
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
    if (isDemo) { onDemoBlock?.(); return }
    if (!confirm('Remove this holding?')) return
    await supabase.from('holdings').delete().eq('id', id)
    await loadData()
  }

  function openEditHolding(h) {
    if (isDemo) { onDemoBlock?.(); return }
    setEditHoldId(h.id)
    setEditHoldTicker(h.ticker)
    setEditHoldShares(String(h.shares))
    setEditHoldCost(String(h.avg_cost_basis))
    setEditHoldError(null)
    setEditHoldDialog(true)
  }

  async function saveEditHolding(e) {
    e.preventDefault()
    if (isDemo) { onDemoBlock?.(); return }
    setEditHoldSaving(true)
    setEditHoldError(null)
    const { error: err } = await supabase
      .from('holdings')
      .update({
        shares: parseFloat(editHoldShares),
        avg_cost_basis: parseFloat(editHoldCost),
        updated_at: new Date().toISOString(),
      })
      .eq('id', editHoldId)
    if (err) {
      setEditHoldError(err.message)
    } else {
      setEditHoldDialog(false)
      showToast('Holding updated')
      await loadData()
    }
    setEditHoldSaving(false)
  }

  // Liability CRUD
  async function addLiability(e) {
    e.preventDefault()
    if (isDemo) { onDemoBlock?.(); return }
    setLiabSaving(true)
    setLiabError(null)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { error: err } = await supabase.from('liabilities').insert({
      user_id: user.id,
      name: liabName.trim(),
      type: liabType,
      balance: parseFloat(liabBalance),
      interest_rate: liabRate ? parseFloat(liabRate) : null,
    })
    if (err) {
      setLiabError(err.message)
    } else {
      setLiabDialog(false)
      setLiabName('')
      setLiabType('loan')
      setLiabBalance('')
      setLiabRate('')
      await loadData()
    }
    setLiabSaving(false)
  }

  async function deleteLiability(id) {
    if (isDemo) { onDemoBlock?.(); return }
    if (!confirm('Delete this liability?')) return
    await supabase.from('liabilities').delete().eq('id', id)
    await loadData()
  }

  function openEditLiability(l) {
    if (isDemo) { onDemoBlock?.(); return }
    setEditLiabId(l.id)
    setEditLiabName(l.name)
    setEditLiabType(l.type)
    setEditLiabBalance(String(l.balance))
    setEditLiabRate(l.interest_rate != null ? String(l.interest_rate) : '')
    setEditLiabError(null)
    setEditLiabDialog(true)
  }

  async function saveEditLiability(e) {
    e.preventDefault()
    if (isDemo) { onDemoBlock?.(); return }
    setEditLiabSaving(true)
    setEditLiabError(null)
    const { error: err } = await supabase
      .from('liabilities')
      .update({
        name: editLiabName.trim(),
        type: editLiabType,
        balance: parseFloat(editLiabBalance),
        interest_rate: editLiabRate ? parseFloat(editLiabRate) : null,
      })
      .eq('id', editLiabId)
    if (err) {
      setEditLiabError(err.message)
    } else {
      setEditLiabDialog(false)
      showToast('Liability updated')
      await loadData()
    }
    setEditLiabSaving(false)
  }

  function toggleExpand(id) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const liabTotal = liabilities.reduce((s, l) => s + l.balance, 0)

  return (
    <div className="p-4 space-y-6">
      {/* ---- ACCOUNTS SECTION ---- */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p
            className="text-[10px] uppercase text-[#7d8590] font-mono"
            style={{ letterSpacing: '0.08em' }}
          >
            Accounts
          </p>
          <button
            onClick={() => {
              setAccError(null)
              setAccDialog(true)
            }}
            className="flex items-center gap-1 text-xs text-[#10b981] hover:text-[#34d399] transition-colors border border-[#10b981]/40 rounded px-2.5 py-1"
          >
            <Plus className="h-3 w-3" />
            Add Account
          </button>
        </div>

        {error && <p className="text-xs text-[#f87171] mb-3">{error}</p>}

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-[#7d8590]">No accounts yet.</p>
        ) : (
          <div className="space-y-3">
            {accounts.map((acc) => {
              const total = accountTotal(acc.id)
              const holdList = holdings[acc.id] ?? []
              const isExpanded = expanded[acc.id]

              return (
                <div
                  key={acc.id}
                  className="bg-[#161b22] border border-[#21262d] rounded-md overflow-hidden"
                >
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm text-[#e6edf3] truncate">{acc.name}</p>
                          {acc.is_synced && (
                            <span
                              style={{
                                background: 'rgba(16,185,129,0.1)',
                                color: '#10b981',
                                fontSize: 9,
                                letterSpacing: '0.06em',
                                padding: '1px 5px',
                                borderRadius: 3,
                                fontFamily: 'monospace',
                                textTransform: 'uppercase',
                                flexShrink: 0,
                              }}
                            >
                              SYNCED
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-[#7d8590]">{acc.provider}</span>
                          <Badge variant="secondary" className="text-xs py-0 h-4">
                            {acc.type}
                          </Badge>
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center gap-3 ml-2 flex-shrink-0">
                      <span className="font-mono text-sm text-[#e6edf3]">{fmt(total)}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditAccount(acc)
                        }}
                        className="text-[#7d8590] hover:text-[#10b981] transition-colors"
                        style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Pencil className="h-[13px] w-[13px]" />
                      </button>
                      {!acc.is_synced && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteAccount(acc.id)
                          }}
                          className="text-[#7d8590] hover:text-[#f87171] transition-colors"
                          style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-[#21262d] bg-[#0d1117]">
                      <div className="flex justify-end px-4 py-2">
                        <button
                          onClick={() => openAddHolding(acc.id)}
                          className="text-xs text-[#10b981] hover:text-[#34d399] transition-colors flex items-center gap-1"
                        >
                          <Plus className="h-3 w-3" />
                          Add Holding
                        </button>
                      </div>
                      {holdList.length === 0 ? (
                        <p className="text-xs text-[#7d8590] px-4 pb-3">
                          No holdings in this account.
                        </p>
                      ) : (
                        <div className="px-4 pb-3 overflow-x-auto">
                          <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-x-4 gap-y-0 text-[10px] text-[#7d8590] uppercase tracking-wider mb-1">
                            <span>Ticker</span>
                            <span />
                            <span className="text-right hidden md:block">Shares</span>
                            <span className="text-right hidden md:block">Avg Cost</span>
                            <span className="text-right">Live Price</span>
                            <span className="text-right">Value</span>
                            <span className="text-right">Gain%</span>
                          </div>
                          <div className="space-y-0.5">
                            {holdList.map((h) => {
                              const isCash = h.ticker === 'CASH'
                              const livePrice = isCash
                                ? h.avg_cost_basis
                                : (prices[h.ticker]?.price ?? 0)
                              const value = isCash ? h.avg_cost_basis : h.shares * livePrice
                              const costBasis = isCash ? h.avg_cost_basis : h.shares * h.avg_cost_basis
                              const gainLoss = isCash ? 0 : value - costBasis
                              const gainPct = isCash ? 0 : costBasis > 0 ? (gainLoss / costBasis) * 100 : 0
                              const positive = gainLoss >= 0
                              return (
                                <div
                                  key={h.id}
                                  className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-x-4 items-center py-1.5 border-b border-[#21262d] last:border-0"
                                >
                                  <div className="flex items-center gap-1 w-14">
                                    {isCash ? (
                                      <span className="font-mono text-xs text-[#7d8590]">Cash</span>
                                    ) : (
                                      <button
                                        onClick={() => onOpenDrawer(h.ticker)}
                                        className="font-mono text-xs text-[#10b981] hover:text-[#34d399] transition-colors"
                                      >
                                        {h.ticker}
                                      </button>
                                    )}
                                    {h.is_synced && (
                                      <RefreshCw
                                        className="flex-shrink-0"
                                        style={{ width: 10, height: 10, color: 'rgba(16,185,129,0.5)' }}
                                      />
                                    )}
                                  </div>
                                  <span />
                                  <span className="font-mono text-xs text-[#e6edf3] text-right hidden md:block">
                                    {isCash ? '-' : h.shares}
                                  </span>
                                  <span className="font-mono text-xs text-[#e6edf3] text-right hidden md:block">
                                    {isCash ? '-' : fmt(h.avg_cost_basis)}
                                  </span>
                                  <span className="font-mono text-xs text-[#e6edf3] text-right">
                                    {isCash ? '-' : fmt(livePrice)}
                                  </span>
                                  <span className="font-mono text-xs text-[#e6edf3] text-right">
                                    {fmt(value)}
                                  </span>
                                  <div className="flex items-center gap-2 justify-end">
                                    {isCash ? (
                                      <span className="font-mono text-xs text-[#7d8590]">-</span>
                                    ) : (
                                      <span
                                        className={`font-mono text-xs ${positive ? 'text-[#34d399]' : 'text-[#f87171]'}`}
                                      >
                                        {positive ? '+' : ''}
                                        {gainPct.toFixed(2)}%
                                      </span>
                                    )}
                                    {!h.is_synced && (
                                      <button
                                        onClick={() => openEditHolding(h)}
                                        className="text-[#7d8590] hover:text-[#10b981] transition-colors"
                                        style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                      >
                                        <Pencil className="h-[13px] w-[13px]" />
                                      </button>
                                    )}
                                    {!h.is_synced && (
                                      <button
                                        onClick={() => deleteHolding(h.id)}
                                        className="text-[#7d8590] hover:text-[#f87171] transition-colors"
                                        style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
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

      {/* ---- LIABILITIES SECTION ---- */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p
            className="text-[10px] uppercase text-[#7d8590] font-mono"
            style={{ letterSpacing: '0.08em' }}
          >
            Liabilities
          </p>
          <button
            onClick={() => {
              setLiabError(null)
              setLiabDialog(true)
            }}
            className="flex items-center gap-1 text-xs text-[#10b981] hover:text-[#34d399] transition-colors border border-[#10b981]/40 rounded px-2.5 py-1"
          >
            <Plus className="h-3 w-3" />
            Add Liability
          </button>
        </div>

        <div className="bg-[#161b22] border border-[#21262d] rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Monthly Interest</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(2)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(6)].map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-16" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : liabilities.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-[#7d8590] py-8 text-xs"
                    >
                      No liabilities added yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {liabilities.map((l) => {
                      const monthlyInterest =
                        l.interest_rate ? (l.balance * l.interest_rate) / 100 / 12 : null
                      return (
                        <TableRow key={l.id}>
                          <TableCell className="text-sm">{l.name}</TableCell>
                          <TableCell className="text-xs text-[#7d8590] capitalize">
                            {l.type}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-[#f87171]">
                            {fmt(l.balance)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-[#7d8590]">
                            {l.interest_rate != null ? `${l.interest_rate}%` : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-[#f87171] hidden md:table-cell">
                            {monthlyInterest != null ? fmt(monthlyInterest) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openEditLiability(l)}
                                className="text-[#7d8590] hover:text-[#10b981] transition-colors"
                                style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <Pencil className="h-[13px] w-[13px]" />
                              </button>
                              <button
                                onClick={() => deleteLiability(l.id)}
                                className="text-[#7d8590] hover:text-[#f87171] transition-colors"
                                style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        className="text-xs font-semibold text-[#7d8590] uppercase tracking-wider"
                      >
                        Total
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold text-[#f87171]">
                        {fmt(liabTotal)}
                      </TableCell>
                      <TableCell colSpan={3} />
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* ---- SNAPSHOT HISTORY SECTION ---- */}
      <div>
        <p
          className="text-[10px] uppercase text-[#7d8590] font-mono mb-2"
          style={{ letterSpacing: '0.08em' }}
        >
          Snapshot History
        </p>
        <p className="text-xs text-[#7d8590] mb-3">
          Your net worth is automatically recorded each night at midnight.
        </p>

        <div className="bg-[#161b22] border border-[#21262d] rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total Assets</TableHead>
                  <TableHead className="text-right">Total Liabilities</TableHead>
                  <TableHead className="text-right">Net Worth</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(3)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(4)].map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : snapshots.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-[#7d8590] py-8 text-xs"
                    >
                      No history yet. Your first snapshot will be recorded tonight at midnight.
                    </TableCell>
                  </TableRow>
                ) : (
                  snapshots.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs text-[#7d8590]">
                        {fmtDate(s.date)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-[#e6edf3]">
                        {fmt(s.total_assets)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-[#f87171]">
                        {fmt(s.total_liabilities)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-[#e6edf3]">
                        {fmt(s.net_worth)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* ---- ADD ACCOUNT DIALOG ---- */}
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

      {/* ---- EDIT ACCOUNT DIALOG ---- */}
      <Dialog open={editAccDialog} onOpenChange={setEditAccDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveEditAccount} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Account Name</Label>
              <Input
                value={editAccName}
                onChange={(e) => setEditAccName(e.target.value)}
                required
              />
            </div>
            {editAccIsSynced ? (
              <>
                <div className="space-y-1.5">
                  <Label>Provider</Label>
                  <p className="text-sm text-[#e6edf3] px-3 py-2 bg-[#0d1117] rounded border border-[#21262d]">
                    {editAccProvider}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <p className="text-sm text-[#e6edf3] capitalize px-3 py-2 bg-[#0d1117] rounded border border-[#21262d]">
                    {editAccType}
                  </p>
                </div>
                <p style={{ fontSize: 11, color: '#7d8590' }}>
                  Provider and type are managed by SimpleFIN sync
                </p>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Provider</Label>
                  <Input
                    value={editAccProvider}
                    onChange={(e) => setEditAccProvider(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={editAccType} onValueChange={setEditAccType}>
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
            {editAccError && <p className="text-sm text-[#f87171]">{editAccError}</p>}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => setEditAccDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={editAccSaving}>
                {editAccSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---- ADD HOLDING DIALOG ---- */}
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

      {/* ---- EDIT HOLDING DIALOG ---- */}
      <Dialog open={editHoldDialog} onOpenChange={setEditHoldDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Holding</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveEditHolding} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Ticker</Label>
              <p className="font-mono text-sm text-[#10b981]">{editHoldTicker}</p>
            </div>
            <div className="space-y-1.5">
              <Label>Shares</Label>
              <Input
                type="number"
                step="0.0001"
                min="0"
                value={editHoldShares}
                onChange={(e) => setEditHoldShares(e.target.value)}
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
                value={editHoldCost}
                onChange={(e) => setEditHoldCost(e.target.value)}
                className="font-mono"
                required
              />
            </div>
            {editHoldError && <p className="text-sm text-[#f87171]">{editHoldError}</p>}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => setEditHoldDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={editHoldSaving}>
                {editHoldSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---- ADD LIABILITY DIALOG ---- */}
      <Dialog open={liabDialog} onOpenChange={setLiabDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Liability</DialogTitle>
          </DialogHeader>
          <form onSubmit={addLiability} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={liabName}
                onChange={(e) => setLiabName(e.target.value)}
                placeholder="e.g. Student Loan"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={liabType} onValueChange={setLiabType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="loan">Loan</SelectItem>
                  <SelectItem value="mortgage">Mortgage</SelectItem>
                  <SelectItem value="credit card">Credit Card</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Balance</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={liabBalance}
                onChange={(e) => setLiabBalance(e.target.value)}
                placeholder="18400"
                className="font-mono"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Interest Rate (%) - optional</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={liabRate}
                onChange={(e) => setLiabRate(e.target.value)}
                placeholder="4.5"
                className="font-mono"
              />
            </div>
            {liabError && <p className="text-sm text-[#f87171]">{liabError}</p>}
            <Button type="submit" className="w-full" disabled={liabSaving}>
              {liabSaving ? 'Adding...' : 'Add Liability'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---- EDIT LIABILITY DIALOG ---- */}
      <Dialog open={editLiabDialog} onOpenChange={setEditLiabDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Liability</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveEditLiability} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={editLiabName}
                onChange={(e) => setEditLiabName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={editLiabType} onValueChange={setEditLiabType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="loan">Loan</SelectItem>
                  <SelectItem value="mortgage">Mortgage</SelectItem>
                  <SelectItem value="credit card">Credit Card</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Balance</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={editLiabBalance}
                onChange={(e) => setEditLiabBalance(e.target.value)}
                className="font-mono"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Interest Rate (%) - optional</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={editLiabRate}
                onChange={(e) => setEditLiabRate(e.target.value)}
                className="font-mono"
              />
            </div>
            {editLiabError && <p className="text-sm text-[#f87171]">{editLiabError}</p>}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => setEditLiabDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={editLiabSaving}>
                {editLiabSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Success toast */}
      {toast && (
        <div
          className="fixed bottom-20 md:bottom-6 right-4 z-50 px-4 py-3 rounded-md border shadow-lg"
          style={{ background: '#161b22', borderColor: '#10b981' }}
        >
          <p className="text-sm text-[#34d399]">{toast}</p>
        </div>
      )}
    </div>
  )
}
