import { finnhubFetch } from '@/lib/finnhub'

// Keep in sync with planHoldingMetadata, metadataFromLookup and metadataTtlMs in
// supabase/functions/nightly-snapshot/index.ts. That copy queues the Finnhub lookups and
// runs them after the nightly snapshots are written, once per ticker within a refresh
// budget. This route looks up inline because a user is waiting on the sync.

const TICKER_REGEX = /^[A-Z0-9.\-]{1,10}$/
const DAY_MS = 24 * 60 * 60 * 1000
const METADATA_TTL_MIN_MS = 5 * DAY_MS
const METADATA_TTL_SPREAD_MS = 4 * DAY_MS

// Effective metadata TTL between 5 and 9 days, fixed per ticker by an FNV-1a hash, so
// holdings refreshed on the same night do not all expire on the same night again.
function metadataTtlMs(ticker) {
  let hash = 0x811c9dc5
  for (let i = 0; i < ticker.length; i++) {
    hash ^= ticker.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return METADATA_TTL_MIN_MS + ((hash >>> 0) % (METADATA_TTL_SPREAD_MS + 1))
}

// Returns { name, searchName, type } from Finnhub, or null when Finnhub has no match
// (e.g. mutual funds). Throws on search errors, and on a profile2 429, so the caller can decide.
async function fetchSecurityMetadata(ticker) {
  if (!ticker || ticker === 'CASH' || !TICKER_REGEX.test(ticker)) return null
  const search = await finnhubFetch(`/search?q=${ticker}`)
  const match = (search.result || []).find((r) => r.symbol === ticker)
  if (!match) return null
  // profile2 is empty for ETFs and 403s for some symbols; fall back to other names.
  // A 429 is rethrown so the whole lookup is retried next sync.
  const profile = await finnhubFetch(`/stock/profile2?symbol=${ticker}`).catch((err) => {
    if (err.status === 429) throw err
    return {}
  })
  return { name: profile.name || null, searchName: match.description || null, type: match.type || null }
}

// Builds the description/security_type fields for a synced holding upsert.
// Re-pulls from Finnhub when the holding is new, its ticker or SimpleFIN name changed,
// or the cached metadata is older than metadataTtlMs(ticker). Otherwise keeps the cached
// values so a stale broker description (e.g. a reassigned ticker) cannot overwrite them.
export async function resolveHoldingMetadata(existing, ticker, providerDescription) {
  const providerDesc = providerDescription || null
  const sameTicker = existing?.ticker === ticker
  const stale =
    !existing ||
    !sameTicker ||
    existing.provider_description !== providerDesc ||
    !existing.metadata_refreshed_at ||
    Date.now() - new Date(existing.metadata_refreshed_at).getTime() > metadataTtlMs(ticker)

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
    const description = sameTicker && existing.description ? existing.description : providerDesc
    if (err.status === 429) {
      console.error('Security metadata rate limited, retrying next sync:', ticker)
      // Leave provider_description and metadata_refreshed_at unchanged so the next sync retries
      return { description }
    }
    // Never log the error message: a network error's message can include the URL with the token
    console.error('Security metadata error, not retrying until the TTL passes:', ticker, err.status ? `HTTP ${err.status}` : 'network error')
    return { description, provider_description: providerDesc, metadata_refreshed_at: new Date().toISOString() }
  }
}
