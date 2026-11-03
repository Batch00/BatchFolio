import { finnhubFetch } from '@/lib/finnhub'

// Keep in sync with resolveHoldingMetadata in supabase/functions/nightly-snapshot/index.ts

const TICKER_REGEX = /^[A-Z0-9.\-]{1,10}$/
const METADATA_TTL_MS = 7 * 24 * 60 * 60 * 1000

// Returns { name, searchName, type } from Finnhub, or null when Finnhub has no match
// (e.g. mutual funds). Throws on search errors so callers can retry on the next sync.
async function fetchSecurityMetadata(ticker) {
  if (!ticker || ticker === 'CASH' || !TICKER_REGEX.test(ticker)) return null
  const search = await finnhubFetch(`/search?q=${ticker}`)
  const match = (search.result || []).find((r) => r.symbol === ticker)
  if (!match) return null
  // profile2 is empty for ETFs and 403s for some symbols; fall back to other names
  const profile = await finnhubFetch(`/stock/profile2?symbol=${ticker}`).catch(() => ({}))
  return { name: profile.name || null, searchName: match.description || null, type: match.type || null }
}

// Builds the description/security_type fields for a synced holding upsert.
// Re-pulls from Finnhub when the holding is new, its ticker or SimpleFIN name changed,
// or the cached metadata is older than METADATA_TTL_MS. Otherwise keeps the cached
// values so a stale broker description (e.g. a reassigned ticker) cannot overwrite them.
export async function resolveHoldingMetadata(existing, ticker, providerDescription) {
  const providerDesc = providerDescription || null
  const sameTicker = existing?.ticker === ticker
  const stale =
    !existing ||
    !sameTicker ||
    existing.provider_description !== providerDesc ||
    !existing.metadata_refreshed_at ||
    Date.now() - new Date(existing.metadata_refreshed_at).getTime() > METADATA_TTL_MS

  if (!stale) {
    return { description: existing.description, provider_description: providerDesc }
  }

  try {
    const meta = await fetchSecurityMetadata(ticker)
    return {
      // Search names are all caps and truncated, so prefer SimpleFIN's name over them
      description: meta?.name || providerDesc || meta?.searchName || null,
      security_type: meta?.type || null,
      provider_description: providerDesc,
      metadata_refreshed_at: new Date().toISOString(),
    }
  } catch (err) {
    console.error('Security metadata error:', ticker, err.message)
    // Leave provider_description unchanged so the next sync retries
    return { description: sameTicker && existing.description ? existing.description : providerDesc }
  }
}
