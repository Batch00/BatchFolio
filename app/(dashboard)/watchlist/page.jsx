'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Trash2 } from 'lucide-react'

const fmt = (v, digits = 2) =>
  v == null ? '--' : `$${Number(v).toFixed(digits)}`

const fmtPct = (v) => (v == null ? '--' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`)

export default function WatchlistPage() {
  const supabase = createClient()
  const [watchlist, setWatchlist] = useState([])
  const [data, setData] = useState({})    // ticker -> { quote, fundamentals }
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [error, setError] = useState(null)
  const [tickerInput, setTickerInput] = useState('')
  const [addError, setAddError] = useState(null)
  const [adding, setAdding] = useState(false)

  const fetchMarketData = useCallback(async (tickers) => {
    if (tickers.length === 0) return
    setDataLoading(true)

    const results = await Promise.all(
      tickers.map(async (ticker) => {
        const [qRes, fRes] = await Promise.all([
          fetch(`/api/stock/quote?ticker=${ticker}`).then((r) => r.json()).catch(() => null),
          fetch(`/api/stock/fundamentals?ticker=${ticker}`).then((r) => r.json()).catch(() => null),
        ])
        return { ticker, quote: qRes, fundamentals: fRes }
      }),
    )

    const map = {}
    results.forEach(({ ticker, quote, fundamentals }) => {
      map[ticker] = { quote, fundamentals }
    })
    setData((prev) => ({ ...prev, ...map }))
    setDataLoading(false)
  }, [])

  const loadWatchlist = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data: wl, error: err } = await supabase
      .from('watchlist')
      .select('*')
      .order('added_at', { ascending: false })

    if (err) { setError(err.message); setLoading(false); return }

    setWatchlist(wl ?? [])
    setLoading(false)

    const tickers = (wl ?? []).map((w) => w.ticker)
    await fetchMarketData(tickers)
  }, [fetchMarketData])

  useEffect(() => { loadWatchlist() }, [loadWatchlist])

  async function addTicker(e) {
    e.preventDefault()
    const ticker = tickerInput.toUpperCase().trim()
    if (!ticker) return

    setAdding(true)
    setAddError(null)

    const { data: { user } } = await supabase.auth.getUser()
    const { error: err } = await supabase.from('watchlist').insert({
      user_id: user.id,
      ticker,
    })

    if (err) {
      setAddError(err.code === '23505' ? `${ticker} is already in your watchlist.` : err.message)
    } else {
      setTickerInput('')
      await loadWatchlist()
    }
    setAdding(false)
  }

  async function removeTicker(id) {
    await supabase.from('watchlist').delete().eq('id', id)
    setWatchlist((prev) => prev.filter((w) => w.id !== id))
  }

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-xl font-semibold text-[#e6edf3] mb-6">Watchlist</h1>

      {/* Add ticker */}
      <form onSubmit={addTicker} className="flex gap-2 mb-2">
        <Input
          value={tickerInput}
          onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
          placeholder="Add ticker (e.g. MSFT)"
          className="font-mono uppercase max-w-xs"
        />
        <Button type="submit" disabled={adding || !tickerInput.trim()}>
          {adding ? 'Adding...' : 'Add'}
        </Button>
      </form>
      {addError && <p className="text-sm text-[#f87171] mb-4">{addError}</p>}
      {error && <p className="text-sm text-[#f87171] mb-4">{error}</p>}

      {loading ? (
        <div className="mt-4 space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : watchlist.length === 0 ? (
        <p className="mt-6 text-sm text-[#7d8590]">Your watchlist is empty.</p>
      ) : (
        <div className="mt-4 bg-[#161b22] border border-[#21262d] rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticker</TableHead>
                <TableHead>Company</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Change</TableHead>
                <TableHead className="text-right">Change %</TableHead>
                <TableHead className="text-right">52w High</TableHead>
                <TableHead className="text-right">52w Low</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {watchlist.map((w) => {
                const d = data[w.ticker]
                const quote = d?.quote
                const fund = d?.fundamentals
                const positive = (quote?.change ?? 0) >= 0

                return (
                  <TableRow key={w.id}>
                    <TableCell>
                      <Link
                        href={`/stock/${w.ticker}`}
                        className="font-mono text-[#10b981] hover:text-[#34d399] transition-colors"
                      >
                        {w.ticker}
                      </Link>
                    </TableCell>
                    <TableCell className="text-[#7d8590] text-xs max-w-[140px] truncate">
                      {dataLoading && !quote ? (
                        <Skeleton className="h-4 w-24" />
                      ) : (
                        quote?.name ?? '--'
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {quote ? fmt(quote.price) : <Skeleton className="h-4 w-16 ml-auto" />}
                    </TableCell>
                    <TableCell className={`text-right font-mono ${positive ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                      {quote ? `${positive ? '+' : ''}${fmt(quote.change)}` : '--'}
                    </TableCell>
                    <TableCell className={`text-right font-mono ${positive ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                      {quote ? fmtPct(quote.changePercent) : '--'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {fund ? fmt(fund.high52w) : '--'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {fund ? fmt(fund.low52w) : '--'}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => removeTicker(w.id)}
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
        </div>
      )}
    </div>
  )
}
