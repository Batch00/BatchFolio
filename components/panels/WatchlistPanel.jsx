'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Trash2 } from 'lucide-react'

const fmt = (v) => (v == null ? '--' : `$${Number(v).toFixed(2)}`)
const fmtPct = (v) => (v == null ? '--' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`)

export default function WatchlistPanel({ onOpenDetail }) {
  const supabase = createClient()
  const [watchlist, setWatchlist] = useState([])
  const [data, setData] = useState({})
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
      tickers.map((ticker) =>
        fetch(`/api/stock/quote?ticker=${ticker}`)
          .then((r) => r.json())
          .then((quote) => ({ ticker, quote }))
          .catch(() => ({ ticker, quote: null }))
      )
    )
    const map = {}
    results.forEach(({ ticker, quote }) => { map[ticker] = quote })
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
    await fetchMarketData((wl ?? []).map((w) => w.ticker))
  }, [fetchMarketData])

  useEffect(() => { loadWatchlist() }, [loadWatchlist])

  async function addTicker(e) {
    e.preventDefault()
    const ticker = tickerInput.toUpperCase().trim()
    if (!ticker) return
    setAdding(true)
    setAddError(null)
    const { data: { user } } = await supabase.auth.getUser()
    const { error: err } = await supabase.from('watchlist').insert({ user_id: user.id, ticker })
    if (err) {
      setAddError(err.code === '23505' ? `${ticker} already in watchlist.` : err.message)
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[#21262d] flex-shrink-0">
        <p className="text-xs text-[#7d8590] uppercase tracking-wider">Watchlist</p>
      </div>

      {/* Add ticker */}
      <div className="px-3 py-2 border-b border-[#21262d] flex-shrink-0">
        <form onSubmit={addTicker} className="flex gap-2">
          <Input
            value={tickerInput}
            onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
            placeholder="Add ticker..."
            className="font-mono uppercase h-8 text-xs bg-[#161b22] border-[#21262d] flex-1"
          />
          <Button
            type="submit"
            size="sm"
            disabled={adding || !tickerInput.trim()}
            className="h-8 text-xs"
          >
            Add
          </Button>
        </form>
        {addError && <p className="text-xs text-[#f87171] mt-1">{addError}</p>}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {error && <p className="p-3 text-xs text-[#f87171]">{error}</p>}
        {loading ? (
          <div className="p-3 space-y-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : watchlist.length === 0 ? (
          <p className="p-4 text-sm text-[#7d8590]">Your watchlist is empty.</p>
        ) : (
          <div className="divide-y divide-[#21262d]">
            {watchlist.map((w) => {
              const quote = data[w.ticker]
              const positive = (quote?.changePercent ?? 0) >= 0
              return (
                <div key={w.id} className="flex items-center px-4 py-3">
                  <button
                    onClick={() => onOpenDetail({ type: 'stock', ticker: w.ticker })}
                    className="flex-1 text-left min-w-0 mr-3"
                  >
                    <p className="font-mono text-sm text-[#10b981]">{w.ticker}</p>
                    <p className="text-xs text-[#7d8590] truncate">
                      {dataLoading && !quote ? (
                        <span className="inline-block bg-[#21262d] rounded h-3 w-20 align-middle" />
                      ) : (
                        quote?.name ?? '--'
                      )}
                    </p>
                  </button>
                  <div className="text-right mr-3 flex-shrink-0">
                    {quote ? (
                      <>
                        <p className="font-mono text-sm text-[#e6edf3]">{fmt(quote.price)}</p>
                        <p className={`font-mono text-xs ${positive ? 'text-[#34d399]' : 'text-[#f87171]'}`}>
                          {fmtPct(quote.changePercent)}
                        </p>
                      </>
                    ) : (
                      <Skeleton className="h-8 w-14" />
                    )}
                  </div>
                  <button
                    onClick={() => removeTicker(w.id)}
                    className="text-[#7d8590] hover:text-[#f87171] transition-colors flex-shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
