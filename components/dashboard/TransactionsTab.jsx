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

// Local formatter: transactions use Math.abs because sign is rendered separately via +/-.
const fmtAbs = (v) =>
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

export default function TransactionsTab() {
  const supabase = createClient()

  const [transactions, setTransactions] = useState([])
  const [accountPills, setAccountPills] = useState([
    { id: 'all', name: 'All Accounts', type: 'all' },
  ])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [dateRange, setDateRange] = useState('30d')
  const [selectedAccount, setSelectedAccount] = useState('all')
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

    const isLiabilityFilter = selectedAccount.startsWith('liability:')
    const liabilityId = isLiabilityFilter ? selectedAccount.replace('liability:', '') : null

    const [accsRes, liabsRes, txRes] = await Promise.all([
      supabase
        .from('accounts')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('is_hidden', false)
        .order('sort_order', { ascending: true }),
      supabase
        .from('liabilities')
        .select('id, name, simplefin_id')
        .eq('user_id', user.id)
        .not('simplefin_id', 'is', null),
      (() => {
        let q = supabase
          .from('transactions')
          .select('*, accounts(name), liabilities(name)')
          .eq('user_id', user.id)
          .gte('posted_at', fromDate.toISOString())
          .order('posted_at', { ascending: false })
          .limit(2000)
        if (liabilityId) {
          q = q.eq('liability_id', liabilityId)
        } else if (selectedAccount !== 'all') {
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

    setAccountPills([
      { id: 'all', name: 'All Accounts', type: 'all' },
      ...(accsRes.data ?? []).map((a) => ({ ...a, type: 'account' })),
      ...(liabsRes.data ?? []).map((l) => ({ ...l, type: 'liability' })),
    ])

    setLoading(false)
  }, [dateRange, selectedAccount])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Client-side search filter
  const filtered = transactions.filter((tx) => {
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

  const selectedPillId =
    selectedAccount === 'all'
      ? 'all'
      : selectedAccount.startsWith('liability:')
        ? selectedAccount
        : selectedAccount

  const getPillValue = (pill) => {
    if (pill.type === 'all') return 'all'
    if (pill.type === 'liability') return `liability:${pill.id}`
    return pill.id
  }

  const selectedPill = accountPills.find((p) => getPillValue(p) === selectedPillId)
  const selectedAccountName =
    selectedPill && selectedPill.type !== 'all' ? selectedPill.name : null
  const rangeLabel = DATE_RANGES.find((r) => r.id === dateRange)?.label?.toLowerCase() ?? ''
  const summaryContext = selectedAccountName
    ? `${selectedAccountName} - ${rangeLabel}`
    : rangeLabel

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

      {/* Account filter pills */}
      {!loading && accountPills.length > 1 && (
        <div
          className="flex"
          style={{
            gap: 6,
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            paddingBottom: 4,
          }}
        >
          {accountPills.map((pill) => {
            const value = getPillValue(pill)
            const active = selectedPillId === value
            return (
              <button
                key={`${pill.type}:${pill.id}`}
                onClick={() => {
                  setSelectedAccount(value)
                  setPage(0)
                }}
                className="transition-colors flex-shrink-0"
                style={{
                  fontSize: 12,
                  padding: '5px 14px',
                  borderRadius: 20,
                  border: `1px solid ${active ? '#10b981' : '#21262d'}`,
                  background: active ? 'rgba(16,185,129,0.12)' : 'transparent',
                  color: active ? '#10b981' : '#7d8590',
                  maxWidth: 150,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={pill.name}
              >
                {pill.name}
              </button>
            )
          })}
        </div>
      )}

      {/* Summary chips */}
      {!loading && (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap gap-3">
            <div className="bg-[#161b22] border border-[#21262d] rounded px-3 py-2 flex flex-col gap-0.5 min-w-[110px]">
              <p
                className="text-[10px] uppercase font-mono text-[#7d8590]"
                style={{ letterSpacing: '0.06em' }}
              >
                Total In
              </p>
              <p className="font-mono text-sm font-semibold text-[#34d399]">+{fmtAbs(totalIn)}</p>
            </div>
            <div className="bg-[#161b22] border border-[#21262d] rounded px-3 py-2 flex flex-col gap-0.5 min-w-[110px]">
              <p
                className="text-[10px] uppercase font-mono text-[#7d8590]"
                style={{ letterSpacing: '0.06em' }}
              >
                Total Out
              </p>
              <p className="font-mono text-sm font-semibold text-[#f87171]">-{fmtAbs(totalOut)}</p>
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
                {fmtAbs(net)}
              </p>
            </div>
          </div>
          {summaryContext && (
            <p
              className="text-[10px] font-mono text-[#7d8590]"
              style={{ letterSpacing: '0.04em' }}
            >
              {summaryContext}
            </p>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-[#161b22] border border-[#21262d] rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: 100 }}>Date</TableHead>
                <TableHead className="hidden md:table-cell" style={{ width: 140 }}>
                  Account
                </TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right" style={{ width: 100 }}>
                  Amount
                </TableHead>
                <TableHead className="hidden md:table-cell" style={{ width: 120 }}>
                  Memo
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
                    <TableCell className="hidden md:table-cell">
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16 ml-auto" />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Skeleton className="h-4 w-20" />
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
                  const rawPrimary = tx.payee || tx.description || '--'
                  const primaryLabel =
                    rawPrimary.length > 40 ? rawPrimary.slice(0, 40) + '...' : rawPrimary
                  const secondaryLabel =
                    tx.payee && tx.description && tx.description !== tx.payee
                      ? tx.description
                      : null
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
                        className="text-xs text-[#7d8590] truncate hidden md:table-cell"
                        style={{ maxWidth: 140 }}
                        title={tx.liabilities?.name ?? tx.accounts?.name ?? ''}
                      >
                        {tx.liabilities?.name ?? tx.accounts?.name ?? '--'}
                      </TableCell>
                      <TableCell>
                        <span
                          className="text-xs text-[#e6edf3] block truncate"
                          title={rawPrimary}
                        >
                          {primaryLabel}
                        </span>
                        {secondaryLabel && (
                          <span
                            className="text-[#7d8590] block truncate"
                            style={{ fontSize: 10 }}
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
                      <TableCell className="text-right font-mono text-xs font-medium whitespace-nowrap">
                        <span style={{ color: positive ? '#34d399' : '#f87171' }}>
                          {positive ? '+' : '-'}
                          {fmtAbs(tx.amount)}
                        </span>
                      </TableCell>
                      <TableCell
                        className="text-xs text-[#7d8590] truncate hidden md:table-cell"
                        style={{ maxWidth: 120 }}
                        title={tx.memo ?? ''}
                      >
                        {tx.memo || '--'}
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
