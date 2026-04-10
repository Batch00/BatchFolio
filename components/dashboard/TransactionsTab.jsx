'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
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
import { ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 50

const fmt = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(v ?? 0))

function fmtDate(iso) {
  if (!iso) return '--'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const DATE_RANGES = [
  { id: '7d', label: 'Last 7 days', days: 7 },
  { id: '30d', label: 'Last 30 days', days: 30 },
  { id: '90d', label: 'Last 90 days', days: 90 },
]

const CATEGORY_COLORS = {
  Gas: '#f59e0b',
  Groceries: '#34d399',
  Dining: '#f97316',
  Shopping: '#3b82f6',
  Recreation: '#8b5cf6',
  Income: '#10b981',
  Other: '#7d8590',
}

const ALL_CATEGORIES = ['Gas', 'Groceries', 'Dining', 'Shopping', 'Recreation', 'Income', 'Other']

function getCategory(payee, description) {
  const text = ((payee || '') + ' ' + (description || '')).toLowerCase()
  if (/gas|fuel|shell|bp|exxon|chevron/.test(text)) return 'Gas'
  if (/grocery|walmart|target|kroger|whole foods/.test(text)) return 'Groceries'
  if (/restaurant|cafe|coffee|mcdonald|starbucks|doordash|grubhub|uber eats/.test(text))
    return 'Dining'
  if (/amazon|ebay|shop|etsy/.test(text)) return 'Shopping'
  if (/golf|gym|sport|fitness|planet fitness/.test(text)) return 'Recreation'
  if (/dividend|interest|deposit|payroll|salary/.test(text)) return 'Income'
  return 'Other'
}

export default function TransactionsTab() {
  const supabase = createClient()

  const [transactions, setTransactions] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [dateRange, setDateRange] = useState('30d')
  const [selectedAccount, setSelectedAccount] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    setPage(0)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const rangeDays = DATE_RANGES.find((r) => r.id === dateRange)?.days ?? 30
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - rangeDays)

    const [accsRes, txRes] = await Promise.all([
      supabase.from('accounts').select('id, name').order('created_at', { ascending: false }),
      (() => {
        let q = supabase
          .from('transactions')
          .select('*, accounts(name)')
          .eq('user_id', user.id)
          .gte('posted_at', fromDate.toISOString())
          .order('posted_at', { ascending: false })
        if (selectedAccount !== 'all') {
          q = q.eq('account_id', selectedAccount)
        }
        return q
      })(),
    ])

    if (txRes.error) {
      setError(txRes.error.message)
    } else {
      setTransactions(txRes.data ?? [])
    }
    setAccounts(accsRes.data ?? [])
    setLoading(false)
  }, [dateRange, selectedAccount])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Enrich with category
  const enriched = transactions.map((tx) => ({
    ...tx,
    category: getCategory(tx.payee, tx.description),
  }))

  // Client-side filter
  const filtered = enriched.filter((tx) => {
    if (selectedCategory !== 'all' && tx.category !== selectedCategory) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      (tx.description ?? '').toLowerCase().includes(q) ||
      (tx.payee ?? '').toLowerCase().includes(q)
    )
  })

  // Summary stats
  const totalIn = filtered.filter((tx) => tx.amount > 0).reduce((s, tx) => s + tx.amount, 0)
  const totalOut = filtered.filter((tx) => tx.amount < 0).reduce((s, tx) => s + tx.amount, 0)
  const net = totalIn + totalOut
  const netPositive = net >= 0

  // Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const startIdx = page * PAGE_SIZE + 1
  const endIdx = Math.min((page + 1) * PAGE_SIZE, filtered.length)

  // Get categories that have transactions
  const activeCats = ALL_CATEGORIES.filter((c) => enriched.some((tx) => tx.category === c))

  return (
    <div className="p-4 space-y-4">
      {/* Header + Filters */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <p
          className="text-[10px] uppercase font-mono text-[#7d8590] flex-shrink-0"
          style={{ letterSpacing: '0.08em' }}
        >
          Transactions
        </p>
        <div className="flex flex-col md:flex-row gap-2 flex-1">
          <Select
            value={dateRange}
            onValueChange={(v) => {
              setDateRange(v)
              setPage(0)
            }}
          >
            <SelectTrigger className="w-full md:w-36 text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGES.map((r) => (
                <SelectItem key={r.id} value={r.id} className="text-xs">
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={selectedAccount}
            onValueChange={(v) => {
              setSelectedAccount(v)
              setPage(0)
            }}
          >
            <SelectTrigger className="w-full md:w-44 text-xs h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                All Accounts
              </SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id} className="text-xs">
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
            placeholder="Search transactions..."
            className="h-8 text-xs flex-1"
          />
        </div>
      </div>

      {error && <p className="text-xs text-[#f87171]">{error}</p>}

      {/* Summary chips */}
      {!loading && (
        <div className="flex flex-wrap gap-3">
          <div className="bg-[#161b22] border border-[#21262d] rounded px-3 py-2 flex flex-col gap-0.5 min-w-[110px]">
            <p
              className="text-[10px] uppercase font-mono text-[#7d8590]"
              style={{ letterSpacing: '0.06em' }}
            >
              Total In
            </p>
            <p className="font-mono text-sm font-semibold text-[#34d399]">+{fmt(totalIn)}</p>
          </div>
          <div className="bg-[#161b22] border border-[#21262d] rounded px-3 py-2 flex flex-col gap-0.5 min-w-[110px]">
            <p
              className="text-[10px] uppercase font-mono text-[#7d8590]"
              style={{ letterSpacing: '0.06em' }}
            >
              Total Out
            </p>
            <p className="font-mono text-sm font-semibold text-[#f87171]">-{fmt(totalOut)}</p>
          </div>
          <div className="bg-[#161b22] border border-[#21262d] rounded px-3 py-2 flex flex-col gap-0.5 min-w-[110px]">
            <p
              className="text-[10px] uppercase font-mono text-[#7d8590]"
              style={{ letterSpacing: '0.06em' }}
            >
              Net
            </p>
            <p
              className="font-mono text-sm font-semibold"
              style={{ color: netPositive ? '#34d399' : '#f87171' }}
            >
              {netPositive ? '+' : '-'}
              {fmt(net)}
            </p>
          </div>
        </div>
      )}

      {/* Category filter pills */}
      {!loading && activeCats.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => {
              setSelectedCategory('all')
              setPage(0)
            }}
            className="font-mono transition-colors"
            style={{
              fontSize: 10,
              letterSpacing: '0.04em',
              padding: '3px 8px',
              borderRadius: 3,
              border: `1px solid ${selectedCategory === 'all' ? '#10b981' : '#21262d'}`,
              background: selectedCategory === 'all' ? 'rgba(16,185,129,0.12)' : 'transparent',
              color: selectedCategory === 'all' ? '#10b981' : '#7d8590',
            }}
          >
            ALL
          </button>
          {activeCats.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(selectedCategory === cat ? 'all' : cat)
                setPage(0)
              }}
              className="font-mono transition-colors"
              style={{
                fontSize: 10,
                letterSpacing: '0.04em',
                padding: '3px 8px',
                borderRadius: 3,
                border: `1px solid ${selectedCategory === cat ? (CATEGORY_COLORS[cat] ?? '#10b981') : '#21262d'}`,
                background:
                  selectedCategory === cat
                    ? `${CATEGORY_COLORS[cat] ?? '#10b981'}20`
                    : 'transparent',
                color: selectedCategory === cat ? (CATEGORY_COLORS[cat] ?? '#10b981') : '#7d8590',
              }}
            >
              {cat.toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-[#161b22] border border-[#21262d] rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: 100 }}>Date</TableHead>
                <TableHead style={{ width: 130 }}>Account</TableHead>
                <TableHead>Description</TableHead>
                <TableHead style={{ width: 90 }}>Category</TableHead>
                <TableHead className="text-right" style={{ width: 100 }}>
                  Amount
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <TableRow key={i} style={{ minHeight: 44 }}>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-xs text-[#7d8590]">
                    No transactions found for the selected period
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((tx, idx) => {
                  const positive = tx.amount > 0
                  const primaryLabel = tx.payee || tx.description || '--'
                  const secondaryLabel =
                    tx.payee && tx.description && tx.description !== tx.payee
                      ? tx.description
                      : null
                  const catColor = CATEGORY_COLORS[tx.category] ?? '#7d8590'
                  return (
                    <TableRow
                      key={tx.id}
                      style={{
                        minHeight: 44,
                        background: idx % 2 === 1 ? 'rgba(255,255,255,0.018)' : 'transparent',
                      }}
                    >
                      <TableCell className="font-mono text-xs text-[#7d8590] whitespace-nowrap">
                        {fmtDate(tx.posted_at)}
                      </TableCell>
                      <TableCell
                        className="text-xs text-[#7d8590] truncate"
                        style={{ maxWidth: 130 }}
                        title={tx.accounts?.name ?? ''}
                      >
                        {tx.accounts?.name ?? '--'}
                      </TableCell>
                      <TableCell>
                        <span
                          className="text-xs text-[#e6edf3] block truncate"
                          style={{ minWidth: 200, maxWidth: 320 }}
                          title={primaryLabel}
                        >
                          {primaryLabel}
                        </span>
                        {secondaryLabel && (
                          <span
                            className="text-[#7d8590] block truncate"
                            style={{ fontSize: 10, maxWidth: 320 }}
                            title={secondaryLabel}
                          >
                            {secondaryLabel}
                          </span>
                        )}
                        {tx.pending && (
                          <span
                            className="font-mono"
                            style={{ fontSize: 9, color: '#7d8590', letterSpacing: '0.06em' }}
                          >
                            PENDING
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className="font-mono"
                          style={{
                            fontSize: 9,
                            color: catColor,
                            background: `${catColor}18`,
                            padding: '2px 5px',
                            borderRadius: 3,
                            letterSpacing: '0.04em',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {(tx.category || 'Other').toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-medium whitespace-nowrap">
                        <span style={{ color: positive ? '#34d399' : '#f87171' }}>
                          {positive ? '+' : '-'}
                          {fmt(tx.amount)}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {!loading && filtered.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[#7d8590] font-mono">
            Showing {startIdx}-{endIdx} of {filtered.length} transactions
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center justify-center rounded border transition-colors disabled:opacity-30"
              style={{
                width: 28,
                height: 28,
                borderColor: '#21262d',
                color: '#7d8590',
                background: 'transparent',
              }}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs font-mono text-[#7d8590] px-2">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="flex items-center justify-center rounded border transition-colors disabled:opacity-30"
              style={{
                width: 28,
                height: 28,
                borderColor: '#21262d',
                color: '#7d8590',
                background: 'transparent',
              }}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
