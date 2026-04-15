'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Trash2 } from 'lucide-react'
import RangeBar from '@/components/dashboard/RangeBar'
import TickerSearch from '@/components/dashboard/TickerSearch'
import { fmt, fmtPercent } from '@/lib/format'

const fmtPct = (v) => fmtPercent(v)

export default function WatchlistTab({ onOpenDrawer, isDemo, onDemoBlock }) {
  const supabase = createClient()
  const [watchlist, setWatchlist] = useState([])
  const [quotes, setQuotes] = useState({})
  const [fundamentals, setFundamentals] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [addError, setAddError] = useState(null)
  const [adding, setAdding] = useState(false)

  const loadWatchlist = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data: wl, error: err } = await supabase
      .from('watchlist')
      .select('*')
      .order('added_at', { ascending: false })
      .limit(500)

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    const tickers = (wl ?? []).map((w) => w.ticker)
    setWatchlist(wl ?? [])
    setLoading(false)

    if (tickers.length === 0) return

    // Fetch quotes and fundamentals in parallel
    const [quoteResults, fundResults] = await Promise.all([
      Promise.all(
        tickers.map((t) =>
          fetch(`/api/stock/quote?ticker=${t}`)
            .then((r) => r.json())
            .then((q) => ({ t, q }))
            .catch(() => ({ t, q: null })),
        ),
      ),
      Promise.all(
        tickers.map((t) =>
          fetch(`/api/stock/fundamentals?ticker=${t}`)
            .then((r) => r.json())
            .then((f) => ({ t, f }))
            .catch(() => ({ t, f: null })),
        ),
      ),
    ])

    const qMap = {}
    quoteResults.forEach(({ t, q }) => {
      if (q) qMap[t] = q
    })
    const fMap = {}
    fundResults.forEach(({ t, f }) => {
      if (f) fMap[t] = f
    })

    setQuotes(qMap)
    setFundamentals(fMap)
  }, [])

  useEffect(() => {
    loadWatchlist()
  }, [loadWatchlist])

  async function addTicker(ticker) {
    if (isDemo) { onDemoBlock?.(); return }
    if (!ticker) return
    setAdding(true)
    setAddError(null)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { error: err } = await supabase.from('watchlist').insert({ user_id: user.id, ticker: ticker.toUpperCase().trim() })
    if (err) {
      setAddError(err.code === '23505' ? `${ticker} already in watchlist.` : err.message)
    } else {
      await loadWatchlist()
    }
    setAdding(false)
  }

  async function removeTicker(id) {
    if (isDemo) { onDemoBlock?.(); return }
    await supabase.from('watchlist').delete().eq('id', id)
    setWatchlist((prev) => prev.filter((w) => w.id !== id))
  }

  return (
    <div className="p-4">
      {/* Add ticker */}
      <div className="mb-4 max-w-sm">
        <TickerSearch
          placeholder="Search and add ticker..."
          onSelect={(ticker) => addTicker(ticker)}
        />
        {adding && <p className="text-xs text-[#7d8590] mt-1">Adding...</p>}
        {addError && <p className="text-xs text-[#f87171] mt-1">{addError}</p>}
      </div>

      {error && <p className="text-xs text-[#f87171] mb-4">{error}</p>}

      {/* Table */}
      <div className="bg-[#161b22] border border-[#21262d] rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#21262d]">
                {[
                  { label: 'Ticker', align: 'text-left' },
                  { label: 'Company Name', align: 'text-left' },
                  { label: 'Price', align: 'text-right' },
                  { label: 'Change $', align: 'text-right', hideMobile: true },
                  { label: 'Change %', align: 'text-right' },
                  { label: '52W Range', align: 'text-left', hideMobile: true },
                  { label: '', align: 'text-right' },
                ].map((h, i) => (
                    <th
                      key={i}
                      className={`px-3 py-2.5 text-[10px] uppercase tracking-wider text-[#7d8590] whitespace-nowrap font-mono ${h.align} ${h.hideMobile ? 'hidden md:table-cell' : ''}`}
                    >
                      {h.label}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="border-b border-[#21262d]">
                    {[false, false, false, true, false, true, false].map((hide, j) => (
                      <td key={j} className={`px-3 py-2.5 ${hide ? 'hidden md:table-cell' : ''}`}>
                        <Skeleton className="h-4 w-16" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : watchlist.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-[#7d8590]">
                    Your watchlist is empty.
                  </td>
                </tr>
              ) : (
                watchlist.map((w) => {
                  const q = quotes[w.ticker]
                  const f = fundamentals[w.ticker]
                  const positive = (q?.changePercent ?? 0) >= 0
                  return (
                    <tr
                      key={w.id}
                      className="border-b border-[#21262d] hover:bg-[#0d1117] transition-colors"
                    >
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => onOpenDrawer(w.ticker)}
                          className="font-mono text-[#10b981] hover:text-[#34d399] transition-colors"
                        >
                          {w.ticker}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-[#7d8590] max-w-[180px] truncate">
                        {q?.name ?? (
                          <span className="inline-block bg-[#21262d] rounded h-3 w-24 align-middle" />
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[#e6edf3] text-right whitespace-nowrap">
                        {q ? fmt(q.price) : <Skeleton className="h-4 w-14 ml-auto" />}
                      </td>
                      <td
                        className={`px-3 py-2.5 font-mono text-right whitespace-nowrap hidden md:table-cell ${positive ? 'text-[#34d399]' : 'text-[#f87171]'}`}
                      >
                        {q ? `${positive ? '+' : ''}${fmt(q.change)}` : '--'}
                      </td>
                      <td
                        className={`px-3 py-2.5 font-mono text-right whitespace-nowrap ${positive ? 'text-[#34d399]' : 'text-[#f87171]'}`}
                      >
                        {q ? fmtPct(q.changePercent) : '--'}
                      </td>
                      <td className="px-3 py-2.5 hidden md:table-cell">
                        {f && q ? (
                          <RangeBar
                            low={f.low52w}
                            high={f.high52w}
                            current={q.price}
                            width={80}
                            showLabels={true}
                          />
                        ) : (
                          <span className="font-mono text-[#7d8590]">--</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          onClick={() => removeTicker(w.id)}
                          className="text-[#7d8590] hover:text-[#f87171] transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
