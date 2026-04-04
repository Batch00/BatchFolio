'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

export default function TickerSearch({ onSelect, placeholder = 'Search ticker...' }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const wrapperRef = useRef(null)
  const debounceRef = useRef(null)
  const inputRef = useRef(null)

  const fetchResults = useCallback(async (q) => {
    if (!q || q.length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/stock/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(data.results ?? [])
      setOpen((data.results ?? []).length > 0 || q.length >= 2)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  function handleChange(e) {
    const val = e.target.value
    setQuery(val)
    setActiveIndex(-1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchResults(val), 300)
  }

  function handleSelect(ticker, name) {
    onSelect(ticker, name)
    setQuery('')
    setResults([])
    setOpen(false)
    setActiveIndex(-1)
  }

  function handleKeyDown(e) {
    if (!open) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1))
    } else if (e.key === 'Enter' && activeIndex >= 0 && results[activeIndex]) {
      e.preventDefault()
      handleSelect(results[activeIndex].ticker, results[activeIndex].name)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className={`w-full h-9 px-3 text-xs font-mono uppercase bg-[#0d1117] border rounded-md text-[#e6edf3] placeholder-[#7d8590] outline-none transition-colors ${
          loading ? 'border-[#10b981]/50 animate-pulse' : 'border-[#21262d] focus:border-[#10b981]'
        }`}
      />

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#161b22] border border-[#21262d] rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
          {results.length === 0 && !loading ? (
            <p className="px-3 py-2 text-xs text-[#7d8590]">No matches found</p>
          ) : (
            results.map((r, i) => (
              <button
                key={r.ticker}
                onClick={() => handleSelect(r.ticker, r.name)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                  i === activeIndex ? 'bg-[#0d1117]' : ''
                }`}
              >
                <span className="font-mono text-xs text-[#10b981] w-16 flex-shrink-0">
                  {r.ticker}
                </span>
                <span className="text-xs text-[#7d8590] truncate">{r.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
