// Deploy with:
// supabase functions deploy nightly-snapshot
// Runs nightly at 23:00 UTC from a pg_cron job (cron: 0 23 * * *), and again at 23:30 UTC
// from the nightly-snapshot-retry job (cron: 30 23 * * *, see
// supabase/manual/2026-11-23_nightly_snapshot_retry.sql). The retry skips the sync when the
// first run already synced within SYNC_FRESH_MS, and redoes it when the first run timed out.
// Both jobs must send an x-cron-secret header matching CRON_SECRET.
// Required secrets: FINNHUB_API_KEY, APP_SUPABASE_URL,
// SERVICE_ROLE_KEY, CRON_SECRET, DEMO_USER_ID (optional - skips demo user)
//
// Required SQL migrations (run in Supabase SQL editor before deploying):
// alter table batchfolio.accounts add column if not exists is_excluded boolean default false;
// alter table batchfolio.liabilities add column if not exists simplefin_id text unique;
// alter table batchfolio.liabilities add column if not exists is_synced boolean default false;
// alter table batchfolio.holdings add column if not exists security_type text;
// alter table batchfolio.holdings add column if not exists provider_description text;
// alter table batchfolio.holdings add column if not exists metadata_refreshed_at timestamptz;
// supabase/manual/2026-11-19_snapshot_runs.sql (creates batchfolio.snapshot_runs)
//
// Order of a run: for each user, sync SimpleFIN within SYNC_BUDGET_MS, then always write
// that user's snapshots from whatever is stored. Finnhub metadata refreshes run last, only
// while the run is inside RUN_BUDGET_MS.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function detectAccountType(name: string, orgName?: string): string {
  const lower = (name || '').toLowerCase()
  const org = (orgName || '').toLowerCase()

  if (/401k|401\(k\)|ira|roth|retirement|pension|403b|457|hsa|health savings|sep|simple ira|annuity|profit sharing/.test(lower)) return 'retirement'

  if (/checking|savings|chequing|money market|mmda|share draft|deposit/.test(lower)) return 'bank'

  if (/horicon|community bank|credit union|chase bank|bank of america|wells fargo|citibank|us bank|pnc|td bank|capital one/.test(org)) {
    if (!/brokerage|investment|trading|ira|401/.test(lower)) return 'bank'
  }

  return 'brokerage'
}

function isCreditCardAccount(name: string, balance?: string): boolean {
  const lower = (name || '').toLowerCase()
  return (
    /credit|card|freedom|sapphire|venture|cash back|quicksilver|slate|ink|reserve/.test(lower) ||
    parseFloat(balance ?? '0') < 0
  )
}

const SIMPLEFIN_HOSTS = ['bridge.simplefin.org', 'beta-bridge.simplefin.org']

// Mirrors isSimplefinUrl in lib/simplefin.js - keep in sync.
// True only for an https URL on a SimpleFIN Bridge host.
function isSimplefinUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && SIMPLEFIN_HOSTS.includes(url.host)
  } catch {
    return false
  }
}

const TICKER_REGEX = /^[A-Z0-9.\-]{1,10}$/
const DAY_MS = 24 * 60 * 60 * 1000
const METADATA_TTL_MIN_MS = 5 * DAY_MS
const METADATA_TTL_SPREAD_MS = 4 * DAY_MS
const FINNHUB_SPACING_MS = 1000
const FINNHUB_TIMEOUT_MS = 5000
const METADATA_REFRESH_BUDGET = 20
// Time a single user's SimpleFIN sync may take before it stops and the snapshot is written.
// SimpleFIN can take over 60s to answer, so most of the run is given to it.
const SYNC_BUDGET_MS = 100_000
// Time from the start of the run after which no sync continues and no metadata refresh starts.
// Snapshots are still written after it. Kept well under the 150s Edge Function limit.
const RUN_BUDGET_MS = 135_000
// A user synced within this long (by this function or the Sync Now button) is not synced
// again. Matches SYNC_RATE_LIMIT_MS in app/api/simplefin/sync/route.js, and makes the
// 23:30 UTC retry job skip the sync when the 23:00 run already did it.
const SYNC_FRESH_MS = 60 * 60 * 1000
const UPSERT_CHUNK_SIZE = 500
let finnhubQueue: Promise<void> = Promise.resolve()
let lastFinnhubStart = 0

// Mirrors metadataTtlMs in lib/security-metadata.js - keep in sync.
// Effective metadata TTL between 5 and 9 days, fixed per ticker by an FNV-1a hash, so
// holdings refreshed on the same night do not all expire on the same night again.
function metadataTtlMs(ticker: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < ticker.length; i++) {
    hash ^= ticker.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return METADATA_TTL_MIN_MS + ((hash >>> 0) % (METADATA_TTL_SPREAD_MS + 1))
}

type SecurityMeta = { name: string | null; searchName: string | null; type: string | null }
type MetaLookup =
  | { kind: 'ok'; meta: SecurityMeta | null }
  | { kind: 'rateLimited' }
  | { kind: 'failed' }

// A holding whose metadata is due for a Finnhub refresh. The refresh runs after every
// user's snapshot is written (see refreshMetadata).
type MetadataTask = {
  accountId: string
  simplefinId: string
  ticker: string
  providerDesc: string | null
  keptDescription: string | null
}

// State for one invocation. The quote cache makes each ticker's quote happen at most once
// per run, shared across users and accounts. Metadata lookups are queued during the sync
// and done once per ticker at the end.
type Run = {
  quotes: Map<string, Promise<number | null>>
  metadataQueue: MetadataTask[]
  metadataRefreshesLeft: number
  metadataRefreshed: number
  metadataDeferred: Set<string>
  finnhubCalls: number
  finnhub429s: number
  quoteFallbacks: number
  accountsNeedingAttention: number
}

function newRun(): Run {
  return {
    quotes: new Map(),
    metadataQueue: [],
    metadataRefreshesLeft: METADATA_REFRESH_BUDGET,
    metadataRefreshed: 0,
    metadataDeferred: new Set(),
    finnhubCalls: 0,
    finnhub429s: 0,
    quoteFallbacks: 0,
    accountsNeedingAttention: 0,
  }
}

// Every Finnhub call in this function goes through here. Calls wait their turn in a queue
// and start at least FINNHUB_SPACING_MS after the previous call started, parallel callers too.
// Throws on a non-2xx response with the HTTP status on err.status. Each call is aborted after
// FINNHUB_TIMEOUT_MS and then throws with no status, like a network error, so a hung call
// cannot push the run past the time limit.
async function finnhubFetch(run: Run, path: string, finnhubKey: string): Promise<any> {
  const turn = finnhubQueue.then(async () => {
    const wait = lastFinnhubStart + FINNHUB_SPACING_MS - Date.now()
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    lastFinnhubStart = Date.now()
  })
  finnhubQueue = turn
  await turn
  run.finnhubCalls++
  const res = await fetch(`https://finnhub.io/api/v1${path}&token=${finnhubKey}`, {
    signal: AbortSignal.timeout(FINNHUB_TIMEOUT_MS),
  })
  if (res.status === 429) run.finnhub429s++
  if (!res.ok) throw Object.assign(new Error(`Finnhub error ${res.status}`), { status: res.status })
  return res.json()
}

// One quote per ticker per run. Resolves to null when the quote failed or came back empty
// (Finnhub returns c = 0 for symbols it does not know).
function getQuote(run: Run, ticker: string, finnhubKey: string): Promise<number | null> {
  let quote = run.quotes.get(ticker)
  if (!quote) {
    quote = TICKER_REGEX.test(ticker)
      ? finnhubFetch(run, `/quote?symbol=${ticker}`, finnhubKey)
        .then((data) => (typeof data.c === 'number' && data.c > 0 ? data.c : null))
        .catch(() => null)
      : Promise.resolve(null)
    run.quotes.set(ticker, quote)
  }
  return quote
}

// One metadata refresh: search, plus profile2 when the search matched.
async function lookupSecurityMetadata(run: Run, ticker: string, finnhubKey: string): Promise<MetaLookup> {
  try {
    const search = await finnhubFetch(run, `/search?q=${ticker}`, finnhubKey)
    const match = (search.result || []).find((r: any) => r.symbol === ticker)
    if (!match) return { kind: 'ok', meta: null }
    // profile2 is empty for ETFs and 403s for some symbols; fall back to other names.
    // A 429 is rethrown so the whole lookup is retried next run.
    const profile = await finnhubFetch(run, `/stock/profile2?symbol=${ticker}`, finnhubKey).catch((err) => {
      if (err.status === 429) throw err
      return {}
    })
    return { kind: 'ok', meta: { name: profile.name || null, searchName: match.description || null, type: match.type || null } }
  } catch (err) {
    if ((err as any).status === 429) {
      console.error('Security metadata rate limited, retrying next run:', ticker)
      return { kind: 'rateLimited' }
    }
    // Never log the error message: a network error's message includes the URL with the token.
    // A timeout counts as failed, not rate limited.
    const status = (err as any).status
    const reason = status ? `HTTP ${status}` : (err as Error)?.name === 'TimeoutError' ? 'timeout' : 'network error'
    console.error('Security metadata error, not retrying until the TTL passes:', ticker, reason)
    return { kind: 'failed' }
  }
}

// Fields to store after a metadata lookup. Null when the lookup was rate limited: the stored
// provider_description and metadata_refreshed_at stay unchanged so the next run retries.
function metadataFromLookup(
  lookup: MetaLookup,
  keptDescription: string | null,
  providerDesc: string | null,
): Record<string, string | null> | null {
  if (lookup.kind === 'rateLimited') return null
  if (lookup.kind === 'failed') {
    return { description: keptDescription, provider_description: providerDesc, metadata_refreshed_at: new Date().toISOString() }
  }
  const meta = lookup.meta
  return {
    // Search names are all caps and truncated, so prefer SimpleFIN's name over them
    description: meta?.name || providerDesc || meta?.searchName || null,
    security_type: meta?.type || null,
    provider_description: providerDesc,
    metadata_refreshed_at: new Date().toISOString(),
  }
}

// Mirrors the refresh rule and field mapping of resolveHoldingMetadata in
// lib/security-metadata.js - keep in sync. Unlike that route, this never calls Finnhub
// during the sync: when a lookup is due it keeps the stored metadata unmarked and returns
// lookup: true, and refreshMetadata does the lookup after every snapshot is written.
// A refresh is due when the holding is new, its ticker or SimpleFIN name changed, or the
// cache is older than metadataTtlMs(ticker). Otherwise keeps the cached values so a stale
// broker description (e.g. a reassigned ticker) cannot overwrite them.
function planHoldingMetadata(
  existing: any,
  ticker: string,
  providerDescription: string | undefined,
): { fields: Record<string, string | null>; lookup: boolean } {
  const providerDesc = providerDescription || null
  const sameTicker = existing?.ticker === ticker
  const stale =
    !existing ||
    !sameTicker ||
    existing.provider_description !== providerDesc ||
    !existing.metadata_refreshed_at ||
    Date.now() - new Date(existing.metadata_refreshed_at).getTime() > metadataTtlMs(ticker)

  if (!stale) {
    return { fields: { description: existing.description, provider_description: providerDesc }, lookup: false }
  }

  const keptDescription = sameTicker && existing.description ? existing.description : providerDesc
  if (ticker && ticker !== 'CASH' && TICKER_REGEX.test(ticker)) {
    return { fields: { description: keptDescription }, lookup: true }
  }
  // Not a Finnhub symbol (e.g. a mutual fund), so there is nothing to look up
  return { fields: metadataFromLookup({ kind: 'ok', meta: null }, keptDescription, providerDesc)!, lookup: false }
}

// Runs after every user's snapshot is written. Looks up each queued ticker once while the
// run is before the deadline and METADATA_REFRESH_BUDGET lasts. Tickers left over keep
// their stored metadata unmarked so a later night picks them up.
async function refreshMetadata(run: Run, supabase: any, finnhubKey: string, deadline: number): Promise<void> {
  const byTicker = new Map<string, MetadataTask[]>()
  for (const task of run.metadataQueue) {
    const tasks = byTicker.get(task.ticker) ?? []
    tasks.push(task)
    byTicker.set(task.ticker, tasks)
  }

  for (const [ticker, tasks] of byTicker) {
    if (Date.now() >= deadline || run.metadataRefreshesLeft <= 0) {
      run.metadataDeferred.add(ticker)
      continue
    }
    run.metadataRefreshesLeft--
    const lookup = await lookupSecurityMetadata(run, ticker, finnhubKey)
    for (const task of tasks) {
      const fields = metadataFromLookup(lookup, task.keptDescription, task.providerDesc)
      if (!fields) continue
      const { error } = await supabase.schema('batchfolio').from('holdings')
        .update(fields)
        .eq('account_id', task.accountId)
        .eq('simplefin_id', task.simplefinId)
      if (error) console.error('[nightly] Security metadata update failed:', ticker, error.message)
    }
    run.metadataRefreshed++
  }
}

// Upserts rows into a batchfolio table, UPSERT_CHUNK_SIZE rows per call. Returns the first
// error message, or null. Every row in one call must have the same keys: supabase-js sends
// the union of keys and writes null for any key a row leaves out.
async function upsertRows(supabase: any, table: string, rows: Record<string, unknown>[], onConflict: string): Promise<string | null> {
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
    const { error } = await supabase.schema('batchfolio').from(table)
      .upsert(rows.slice(i, i + UPSERT_CHUNK_SIZE), { onConflict })
    if (error) return error.message
  }
  return null
}

type SfTransaction = {
  id: string
  posted?: number
  transacted_at?: string
  amount?: string
  description?: string
  payee?: string
  memo?: string
  pending?: boolean
}

// Transaction rows for one account, skipping rows with no id or a zero or unparseable amount.
// Keyed by simplefin_id so a repeated id cannot fail the batch; the last copy wins, as it
// did when each row was upserted on its own.
function transactionRows(sfTransactions: SfTransaction[], base: Record<string, string>): Record<string, unknown>[] {
  const rows = new Map<string, Record<string, unknown>>()
  for (const tx of sfTransactions) {
    if (!tx.id) continue
    const amount = parseFloat(tx.amount ?? '0')
    if (amount === 0 || isNaN(amount)) continue

    rows.set(tx.id, {
      ...base,
      simplefin_id: tx.id,
      posted_at: tx.posted
        ? new Date(tx.posted * 1000).toISOString()
        : null,
      transacted_at: tx.transacted_at
        ? new Date(tx.transacted_at * 1000).toISOString()
        : null,
      amount,
      description: tx.description || null,
      payee: tx.payee || null,
      memo: tx.memo || null,
      pending: tx.pending || false,
      tx_type: amount > 0 ? 'credit' : 'debit',
    })
  }
  return [...rows.values()]
}

class SyncBudgetExceeded extends Error {}

type SfError = { code?: string; msg?: string; message?: string; conn_id?: string; account_id?: string }

// Mirrors simplefinAccountSkipReason in lib/simplefin.js - keep in sync.
// Returns why an account SimpleFIN returned should keep its stored data this sync, or null to
// sync it. A connection that needs re-auth (RBC does every so often) can come back with an
// error, an empty balance or an old balance date. Writing that would zero the balance, delete
// its holdings as sold or rewrite its cash, so the stored data is kept until it works again.
// stored is the account's current row, or null when it is new or a credit card.
function simplefinAccountSkipReason(
  sfAcc: { id: string; conn_id?: string; balance?: string; 'balance-date'?: number },
  errors: SfError[],
  stored: { balance?: number | null; last_balance_date?: string | null } | null,
): string | null {
  const hasError = errors.some((e) =>
    (e.account_id && e.account_id === sfAcc.id) ||
    (e.conn_id && sfAcc.conn_id && e.conn_id === sfAcc.conn_id))
  if (hasError) return 'connection error'
  if (!stored) return null
  const balance = parseFloat(sfAcc.balance ?? '')
  if (Number(stored.balance) > 0 && (!Number.isFinite(balance) || balance === 0)) return 'empty balance'
  const newDate = sfAcc['balance-date'] ? sfAcc['balance-date'] * 1000 : null
  if (newDate && stored.last_balance_date && newDate < new Date(stored.last_balance_date).getTime()) {
    return 'older balance date'
  }
  return null
}

type SyncOutcome = {
  status: 'none' | 'ok' | 'failed' | 'budget' | 'fresh'
  accountsDone: number
  accountsTotal: number
}

// Syncs one user's SimpleFIN data. Returns status 'fresh' without syncing when the user was
// synced within SYNC_FRESH_MS. Stops with status 'budget' once Date.now() passes
// deadline: checked before the request, between accounts, and on the request itself.
// Never throws for a sync problem, so the caller can always go on to the snapshot.
async function syncSimpleFINForUser(
  run: Run,
  supabase: ReturnType<typeof createClient>,
  uid: string,
  deadline: number,
): Promise<SyncOutcome> {
  const progress: SyncOutcome = { status: 'none', accountsDone: 0, accountsTotal: 0 }
  const checkDeadline = () => {
    if (Date.now() >= deadline) throw new SyncBudgetExceeded()
  }

  const { data: conn } = await (supabase as any).schema('batchfolio').from('simplefin_connections')
    .select('access_url, last_synced_at')
    .eq('user_id', uid)
    .maybeSingle()

  if (!conn?.access_url) return progress

  if (conn.last_synced_at && Date.now() - new Date(conn.last_synced_at).getTime() < SYNC_FRESH_MS) {
    return { ...progress, status: 'fresh' }
  }

  // Refuse to send credentials anywhere but a SimpleFIN host. Never log the URL itself.
  if (!isSimplefinUrl(conn.access_url)) {
    console.error('[nightly] Stored SimpleFIN URL failed the host check, skipping sync for', uid)
    return { ...progress, status: 'failed' }
  }

  try {
    checkDeadline()
    const url = new URL(conn.access_url)
    const username = url.username
    const password = url.password
    const baseUrl = `${url.protocol}//${url.host}${url.pathname}`
    const credentials = btoa(`${username}:${password}`)

    // Fetch 90 days of data including transactions. The request is aborted at the deadline.
    const startDate = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000)
    let sfData: any
    const requestStart = Date.now()
    try {
      const sfRes = await fetch(`${baseUrl}/accounts?version=2&start-date=${startDate}`, {
        headers: { Authorization: `Basic ${credentials}` },
        signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())),
      })
      if (!sfRes.ok) {
        console.error('[nightly] SimpleFIN returned HTTP', sfRes.status, 'for', uid)
        return { ...progress, status: 'failed' }
      }
      sfData = await sfRes.json()
    } catch (err) {
      const name = (err as Error)?.name
      if (name === 'TimeoutError' || name === 'AbortError') {
        console.error('[nightly] SimpleFIN request timed out after', `${Math.round((Date.now() - requestStart) / 1000)}s`, 'for', uid)
        throw new SyncBudgetExceeded()
      }
      // Never pass the fetch error on: its message can include the SimpleFIN URL
      throw new Error('SimpleFIN request failed')
    }

    // Parse connection errors from SimpleFIN response
    const sfErrors: SfError[] = sfData.errlist ?? sfData.errors ?? []
    const connectionErrors = sfErrors
      .filter((e) => e.code && (e.msg || e.message))
      .map((e) => ({
        code: e.code,
        message: e.msg || e.message,
        conn_id: e.conn_id || null,
        detected_at: new Date().toISOString(),
      }))

    const sfAccounts: {
      id: string
      conn_id?: string
      name: string
      balance?: string
      'available-balance'?: string
      'balance-date'?: number
      currency?: string
      org?: { name?: string; url?: string }
      holdings?: {
        id: string
        symbol: string
        shares?: string
        cost_basis?: string
        purchase_price?: string
        description?: string
        currency?: string
        market_value?: string
      }[]
      transactions?: SfTransaction[]
    }[] = sfData.accounts ?? []

    progress.accountsTotal = sfAccounts.length

    for (const [index, sfAcc] of sfAccounts.entries()) {
      progress.accountsDone = index
      checkDeadline()

      // Route credit cards to liabilities + sync transactions via shadow account
      if (isCreditCardAccount(sfAcc.name, sfAcc.balance)) {
        if (simplefinAccountSkipReason(sfAcc, sfErrors, null)) {
          run.accountsNeedingAttention++
          console.log('[nightly] skipped account needing attention:', sfAcc.id, 'connection error')
          continue
        }
        const balanceAbs = Math.abs(parseFloat(sfAcc.balance ?? '0') || 0)
        try {
          // 1. Upsert liability
          let liabilityId: string | null = null
          const { data: existingLiab } = await (supabase as any).schema('batchfolio').from('liabilities')
            .select('id')
            .eq('user_id', uid)
            .eq('simplefin_id', sfAcc.id)
            .maybeSingle()

          if (existingLiab) {
            await (supabase as any).schema('batchfolio').from('liabilities')
              .update({ balance: balanceAbs, is_synced: true })
              .eq('id', existingLiab.id)
            liabilityId = existingLiab.id
          } else {
            const { data: newLiab } = await (supabase as any).schema('batchfolio').from('liabilities').insert({
              user_id: uid,
              name: sfAcc.name,
              type: 'credit card',
              balance: balanceAbs,
              interest_rate: null,
              simplefin_id: sfAcc.id,
              is_synced: true,
            }).select('id').single()
            liabilityId = newLiab?.id ?? null
          }

          // 2. Delete any old non-shadow account for this SimpleFIN ID
          const { data: existingCCAccount } = await (supabase as any).schema('batchfolio').from('accounts')
            .select('id')
            .eq('user_id', uid)
            .eq('simplefin_id', sfAcc.id)
            .maybeSingle()

          if (existingCCAccount) {
            await (supabase as any).schema('batchfolio').from('holdings').delete().eq('account_id', existingCCAccount.id)
            await (supabase as any).schema('batchfolio').from('accounts').delete().eq('id', existingCCAccount.id)
          }

          // 3. Upsert hidden shadow account to hold transactions
          if (liabilityId) {
            const { data: shadowAcc } = await (supabase as any).schema('batchfolio').from('accounts')
              .upsert(
                {
                  user_id: uid,
                  name: sfAcc.name + ' (Transactions)',
                  provider: sfAcc.org?.name || 'SimpleFIN',
                  provider_url: sfAcc.org?.url || null,
                  type: 'bank',
                  simplefin_id: sfAcc.id + '-txn',
                  is_synced: true,
                  is_hidden: true,
                  balance: 0,
                },
                { onConflict: 'user_id,simplefin_id' },
              )
              .select('id')
              .maybeSingle()

            // 4. Sync credit card transactions in one batch
            if (shadowAcc?.id) {
              const rows = transactionRows(sfAcc.transactions ?? [], {
                account_id: shadowAcc.id,
                liability_id: liabilityId,
                user_id: uid,
              })
              const txErr = await upsertRows(supabase, 'transactions', rows, 'simplefin_id')
              if (txErr) console.error('[nightly] Credit card transactions upsert failed for', uid, txErr)
            }
          }
        } catch {
          // simplefin_id column may not exist yet - skip gracefully
        }
        continue
      }

      const balanceNum = parseFloat(sfAcc.balance ?? '0') || 0
      const availableBalanceNum = parseFloat(sfAcc['available-balance'] ?? '0') || 0
      const currency = sfAcc.currency || 'USD'
      const lastBalanceDate = sfAcc['balance-date']
        ? new Date(sfAcc['balance-date'] * 1000).toISOString()
        : null

      // Preserve user-edited names: check before update, never overwrite name
      const { data: existingAcc } = await (supabase as any).schema('batchfolio').from('accounts')
        .select('id, type, balance, last_balance_date')
        .eq('user_id', uid)
        .eq('simplefin_id', sfAcc.id)
        .maybeSingle()

      // Keep an account's stored balance, holdings and cash while its connection needs re-auth
      const skipReason = simplefinAccountSkipReason(sfAcc, sfErrors, existingAcc ?? null)
      if (skipReason) {
        run.accountsNeedingAttention++
        console.log('[nightly] skipped account needing attention:', sfAcc.id, skipReason)
        continue
      }

      const newType = detectAccountType(sfAcc.name, sfAcc.org?.name)
      let accountId: string | null = null

      if (existingAcc) {
        // Update balance fields only - preserve user-edited name
        // Also update type if it was auto-detected as brokerage but new detection says otherwise
        await (supabase as any).schema('batchfolio').from('accounts')
          .update({
            balance: balanceNum,
            available_balance: availableBalanceNum,
            currency,
            last_balance_date: lastBalanceDate,
            is_synced: true,
            ...((existingAcc as { type?: string }).type === 'brokerage' && newType !== 'brokerage' ? { type: newType } : {}),
          })
          .eq('id', existingAcc.id)
        accountId = existingAcc.id
      } else {
        // New account - insert with name from SimpleFIN
        const { data: newAcc } = await (supabase as any).schema('batchfolio').from('accounts')
          .insert({
            user_id: uid,
            name: sfAcc.name,
            provider: sfAcc.org?.name ?? 'SimpleFIN',
            provider_url: sfAcc.org?.url || null,
            type: newType,
            simplefin_id: sfAcc.id,
            is_synced: true,
            balance: balanceNum,
            available_balance: availableBalanceNum,
            currency,
            last_balance_date: lastBalanceDate,
          })
          .select('id')
          .maybeSingle()
        accountId = newAcc?.id ?? null
      }

      if (!accountId) continue
      const sfHoldings = sfAcc.holdings ?? []

      if (sfHoldings.length > 0) {
        const { data: cachedHoldings } = await (supabase as any).schema('batchfolio').from('holdings')
          .select('simplefin_id, ticker, description, security_type, provider_description, metadata_refreshed_at')
          .eq('account_id', accountId)
        const cachedById = new Map((cachedHoldings || []).map((c: any) => [c.simplefin_id, c]))
        const updatedAt = new Date().toISOString()

        // Keyed by simplefin_id so a repeated id cannot fail the batch; the last copy wins
        const holdingRows = new Map<string, Record<string, unknown>>()
        for (const h of sfHoldings) {
          const sh = parseFloat(h.shares ?? '0')
          const sharesNum = !isNaN(sh) ? sh : 0
          const costBasisTotal = parseFloat(h.cost_basis ?? '0') > 0 ? parseFloat(h.cost_basis ?? '0') : null
          const purchasePrice = parseFloat(h.purchase_price ?? '0') > 0 ? parseFloat(h.purchase_price ?? '0') : null
          const mv = parseFloat(h.market_value ?? '0')

          let avgCost: number
          if (costBasisTotal && costBasisTotal > 0 && sharesNum > 0) {
            avgCost = costBasisTotal / sharesNum
          } else if (purchasePrice && purchasePrice > 0) {
            avgCost = purchasePrice
          } else {
            avgCost = 0
          }

          const lastSyncedPrice = (!isNaN(mv) && !isNaN(sh) && sh > 0)
            ? mv / sh
            : (!isNaN(mv) && mv > 0 ? mv : null)

          const existing: any = cachedById.get(h.id)
          const metadata = planHoldingMetadata(existing, h.symbol, h.description)
          if (metadata.lookup) {
            run.metadataQueue.push({
              accountId,
              simplefinId: h.id,
              ticker: h.symbol,
              providerDesc: h.description || null,
              keptDescription: metadata.fields.description,
            })
          }

          holdingRows.set(h.id, {
            account_id: accountId,
            ticker: h.symbol,
            shares: sharesNum,
            avg_cost_basis: avgCost,
            simplefin_id: h.id,
            is_synced: true,
            last_synced_price: lastSyncedPrice,
            // Every row carries all four metadata columns, stored values unless planHoldingMetadata
            // changed them, so the batch never nulls a column one row leaves out
            description: existing?.description ?? null,
            security_type: existing?.security_type ?? null,
            provider_description: existing?.provider_description ?? null,
            metadata_refreshed_at: existing?.metadata_refreshed_at ?? null,
            ...metadata.fields,
            cost_basis_total: costBasisTotal,
            currency: h.currency || 'USD',
            purchase_price: purchasePrice,
            updated_at: updatedAt,
          })
        }

        const holdErr = await upsertRows(supabase, 'holdings', [...holdingRows.values()], 'account_id,simplefin_id')
        if (holdErr) console.error('[nightly] Holdings upsert failed for', uid, holdErr)

        // Calculate cash gap between account balance and holdings market values
        const holdingsTotal = sfHoldings.reduce((sum: number, h: any) => {
          const mv = parseFloat(h.market_value ?? '0')
          return sum + (isNaN(mv) ? 0 : mv)
        }, 0)
        const cashGap = balanceNum - holdingsTotal

        if (cashGap > 1) {
          await (supabase as any).schema('batchfolio').from('holdings').upsert(
            {
              account_id: accountId,
              ticker: 'CASH',
              shares: 1,
              avg_cost_basis: cashGap,
              last_synced_price: cashGap,
              simplefin_id: `${sfAcc.id}-cash`,
              is_synced: true,
              description: 'Uninvested Cash',
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'account_id,simplefin_id' },
          )
        } else {
          await (supabase as any).schema('batchfolio').from('holdings')
            .delete()
            .eq('account_id', accountId)
            .eq('simplefin_id', `${sfAcc.id}-cash`)
        }

        // Delete synced holdings no longer returned by SimpleFIN (sold positions)
        const returnedHoldingIds = new Set(sfHoldings.map((h: any) => h.id))
        const { data: existingHoldings } = await (supabase as any).schema('batchfolio').from('holdings')
          .select('id, simplefin_id, ticker')
          .eq('account_id', accountId)
          .eq('is_synced', true)
          .not('simplefin_id', 'like', '%-cash')
        const toDelete = ((existingHoldings as any[] | null) ?? []).filter(
          (h: any) => h.simplefin_id && !returnedHoldingIds.has(h.simplefin_id)
        )
        if (toDelete.length > 0) {
          const { error: delErr } = await (supabase as any).schema('batchfolio').from('holdings')
            .delete()
            .in('id', toDelete.map((h: any) => h.id))
          if (delErr) {
            console.error('[nightly] Stale holdings delete failed for', uid, delErr.message)
          } else {
            for (const h of toDelete) console.log('Removed stale holding:', h.ticker, h.simplefin_id)
          }
        }
      } else if (sfAcc.balance != null) {
        await (supabase as any).schema('batchfolio').from('holdings').upsert(
          {
            account_id: accountId,
            ticker: 'CASH',
            shares: 1,
            avg_cost_basis: parseFloat(sfAcc.balance),
            simplefin_id: `${sfAcc.id}-cash`,
            is_synced: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'account_id,simplefin_id' },
        )
      }

      // Sync transactions in one batch
      const rows = transactionRows(sfAcc.transactions ?? [], { account_id: accountId, user_id: uid })
      const txErr = await upsertRows(supabase, 'transactions', rows, 'simplefin_id')
      if (txErr) console.error('[nightly] Transactions upsert failed for', uid, txErr)
    }
    progress.accountsDone = sfAccounts.length

    await (supabase as any).schema('batchfolio').from('simplefin_connections')
      .update({
        last_synced_at: new Date().toISOString(),
        connection_errors: connectionErrors.length > 0 ? connectionErrors : null,
      })
      .eq('user_id', uid)
    return { ...progress, status: 'ok' }
  } catch (err) {
    if (err instanceof SyncBudgetExceeded) {
      console.error('[nightly] sync budget exceeded', uid, `${progress.accountsDone} of ${progress.accountsTotal} accounts synced`)
      return { ...progress, status: 'budget' }
    }
    console.error('[nightly] SimpleFIN sync failed for', uid, String(err))
    return { ...progress, status: 'failed' }
  }
}

const USER_PAGE_SIZE = 1000

// Distinct user_ids with a row in batchfolio.accounts or batchfolio.simplefin_connections.
// Reads in pages so the project's max rows setting cannot truncate the list.
async function listBatchFolioUserIds(supabase: any): Promise<string[]> {
  const ids = new Set<string>()
  // Each table is ordered by a unique column so pages do not overlap or skip rows
  for (const [table, orderBy] of [['accounts', 'id'], ['simplefin_connections', 'user_id']]) {
    for (let from = 0; ; from += USER_PAGE_SIZE) {
      const { data, error } = await supabase.schema('batchfolio').from(table)
        .select('user_id')
        .order(orderBy)
        .range(from, from + USER_PAGE_SIZE - 1)
      if (error) throw new Error(error.message)
      for (const row of data ?? []) ids.add(row.user_id)
      if (!data || data.length < USER_PAGE_SIZE) break
    }
  }
  return [...ids]
}

// Constant-time check of the x-cron-secret header against CRON_SECRET.
// Both values are hashed first so the comparison does not leak their lengths.
async function hasValidCronSecret(req: Request): Promise<boolean> {
  const secret = Deno.env.get('CRON_SECRET')
  const provided = req.headers.get('x-cron-secret')
  if (!secret || !provided) return false
  const enc = new TextEncoder()
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(secret)),
    crypto.subtle.digest('SHA-256', enc.encode(provided)),
  ])
  const x = new Uint8Array(a)
  const y = new Uint8Array(b)
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i]
  return diff === 0
}

Deno.serve(async (req) => {
  if (!(await hasValidCronSecret(req))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('APP_SUPABASE_URL')!,
    Deno.env.get('SERVICE_ROLE_KEY')!,
  ) as any

  const finnhubKey = Deno.env.get('FINNHUB_API_KEY')!
  const today = new Date().toISOString().split('T')[0]
  const startedAt = Date.now()
  const runDeadline = startedAt + RUN_BUDGET_MS
  const run = newRun()

  // Record the run in batchfolio.snapshot_runs (counts only, no user data). A failure to
  // record it is logged and never stops the run.
  const { data: runRow, error: runRowErr } = await supabase.schema('batchfolio').from('snapshot_runs')
    .insert({ started_at: new Date(startedAt).toISOString(), run_date: today })
    .select('id')
    .single()
  if (runRowErr) console.error('[nightly] Could not record run start:', runRowErr.message)
  const finishRunRow = async (fields: Record<string, unknown>) => {
    if (!runRow?.id) return
    const { error } = await supabase.schema('batchfolio').from('snapshot_runs')
      .update({
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAt,
        finnhub_calls: run.finnhubCalls,
        ...fields,
      })
      .eq('id', runRow.id)
    if (error) console.error('[nightly] Could not record run end:', error.message)
  }

  // BatchFolio users only. The auth pool is shared with other apps, so list users from this schema.
  let userIds: string[]
  try {
    userIds = await listBatchFolioUserIds(supabase)
  } catch (err) {
    console.error('[nightly] Failed to list users:', (err as Error).message)
    await finishRunRow({ notes: 'Failed to list users' })
    return new Response(JSON.stringify({ error: 'Failed to list users' }), { status: 500 })
  }

  // Find demo user ID - check by email as fallback if DEMO_USER_ID env var is not set
  let DEMO_USER_ID = Deno.env.get('DEMO_USER_ID') || ''
  if (!DEMO_USER_ID) {
    for (const uid of userIds) {
      const { data, error } = await supabase.auth.admin.getUserById(uid)
      if (error) {
        await finishRunRow({ notes: 'Failed to look up users' })
        return new Response(JSON.stringify({ error: 'Failed to look up users' }), { status: 500 })
      }
      if (data.user?.email === 'demo@batchfolio.app') {
        DEMO_USER_ID = uid
        break
      }
    }
  }

  const results: { uid: string; ok: boolean; skipped?: boolean; error?: string }[] = []
  let budgetExceeded = 0
  let syncFailed = 0
  let syncFresh = 0

  for (const uid of userIds) {
    // Skip demo user - their snapshot history is seeded and should not be overwritten
    if (DEMO_USER_ID && uid === DEMO_USER_ID) {
      results.push({ uid, ok: true, skipped: true })
      continue
    }

    // Sync SimpleFIN data first (if user has a connection), within this user's budget and
    // the run's. A sync failure or timeout never stops the snapshot below, which then uses
    // the balances and holdings already stored.
    try {
      const outcome = await syncSimpleFINForUser(run, supabase, uid, Math.min(Date.now() + SYNC_BUDGET_MS, runDeadline))
      if (outcome.status === 'budget') budgetExceeded++
      if (outcome.status === 'failed') syncFailed++
      if (outcome.status === 'fresh') syncFresh++
    } catch (err) {
      syncFailed++
      console.error('[nightly] SimpleFIN sync failed for', uid, String(err))
    }

    try {
      // Fetch accounts for this user (include balance for synced accounts, exclude excluded accounts)
      const { data: accounts } = await supabase.schema('batchfolio').from('accounts')
        .select('id, is_synced, balance, is_excluded, is_hidden')
        .eq('user_id', uid)

      const accountList = (accounts ?? []) as { id: string; is_synced: boolean; balance: number; is_excluded: boolean; is_hidden: boolean }[]

      // Filter out excluded and hidden accounts from all calculations
      const activeAccounts = accountList.filter((a: { is_excluded: boolean; is_hidden: boolean }) => !a.is_excluded && !a.is_hidden)

      // Calculate synced assets total directly from account balances
      const syncedAssetsTotal = activeAccounts
        .filter((a: { is_synced: boolean; balance: number }) => a.is_synced && (a.balance as number) > 0)
        .reduce((sum: number, a: { balance: number }) => sum + (a.balance as number), 0)

      // Fetch holdings for non-synced accounts (manual)
      const manualAccountIds = activeAccounts.filter((a: { is_synced: boolean }) => !a.is_synced).map((a: { id: string }) => a.id)
      let manualHoldings: { ticker: string; shares: number; avg_cost_basis: number; account_id: string; last_synced_price: number | null }[] = []

      if (manualAccountIds.length > 0) {
        const { data: holdingRows } = await supabase.schema('batchfolio').from('holdings')
          .select('ticker, shares, avg_cost_basis, account_id, last_synced_price')
          .in('account_id', manualAccountIds)
        manualHoldings = holdingRows ?? []
      }

      // Get unique tickers for manual holdings (skip CASH) and fetch live prices
      const tickers = [...new Set(manualHoldings.map((h) => h.ticker))].filter((t) => t !== 'CASH')
      const priceMap: Record<string, number> = {}

      await Promise.all(
        tickers.map(async (ticker) => {
          const quote = await getQuote(run, ticker, finnhubKey)
          if (quote !== null) {
            priceMap[ticker] = quote
            return
          }
          // A failed quote must not value the position at 0. Fall back to a price stored on
          // one of the user's holdings, then to the latest holding snapshot before today.
          let fallback = Number(manualHoldings.find((h) => h.ticker === ticker && Number(h.last_synced_price) > 0)?.last_synced_price) || 0
          if (!fallback) {
            const { data: lastSnap } = await supabase.schema('batchfolio').from('holding_snapshots')
              .select('price')
              .eq('user_id', uid)
              .eq('ticker', ticker)
              .lt('date', today)
              .gt('price', 0)
              .order('date', { ascending: false })
              .limit(1)
              .maybeSingle()
            fallback = Number(lastSnap?.price) || 0
          }
          if (fallback > 0) {
            run.quoteFallbacks++
          } else {
            console.error('[nightly] Quote failed and no earlier price is known, valuing at 0:', ticker)
          }
          priceMap[ticker] = fallback
        }),
      )

      // Calculate manual assets total
      const manualAssetsTotal = manualHoldings.reduce((sum, h) => {
        if (h.ticker === 'CASH') return sum + (h.avg_cost_basis ?? 0)
        return sum + h.shares * (priceMap[h.ticker] ?? 0)
      }, 0)

      const totalAssets = syncedAssetsTotal + manualAssetsTotal

      // Fetch total liabilities balance
      const { data: liabRows } = await supabase.schema('batchfolio').from('liabilities')
        .select('balance')
        .eq('user_id', uid)

      const totalLiabilities = (liabRows ?? []).reduce(
        (sum: number, l: { balance: number }) => sum + l.balance,
        0,
      )

      const netWorth = totalAssets - totalLiabilities

      // Upsert snapshot for today
      const { error: upsertErr } = await supabase.schema('batchfolio').from('net_worth_snapshots').upsert(
        {
          user_id: uid,
          date: today,
          total_assets: totalAssets,
          total_liabilities: totalLiabilities,
          net_worth: netWorth,
        },
        { onConflict: 'user_id,date' },
      )

      if (upsertErr) throw new Error(upsertErr.message)

      // Account balance snapshots, written in one batch
      const accountSnapshotRows: Record<string, unknown>[] = []
      for (const account of activeAccounts) {
        let balance = 0

        if (account.is_synced && (account.balance as number) > 0) {
          balance = account.balance as number
        } else if (!account.is_synced) {
          const acctHoldings = manualHoldings.filter(
            (h: { account_id?: string }) => (h as any).account_id === account.id
          )
          balance = acctHoldings.reduce((sum: number, h: { ticker: string; shares: number; avg_cost_basis: number }) => {
            if (h.ticker === 'CASH') return sum + (h.avg_cost_basis ?? 0)
            return sum + h.shares * (priceMap[h.ticker] ?? 0)
          }, 0)
        }

        if (balance <= 0) continue

        accountSnapshotRows.push({
          user_id: uid,
          account_id: account.id,
          balance,
          date: today,
        })
      }

      // Per-holding snapshots for time-based return calculations, written in one batch
      const { data: allHoldings } = await (supabase as any)
        .schema('batchfolio')
        .from('holdings')
        .select('id, ticker, shares, last_synced_price, avg_cost_basis, account_id')
        .in('account_id', activeAccounts.map((a: { id: string }) => a.id))

      const holdingSnapshotRows: Record<string, unknown>[] = []
      for (const holding of (allHoldings ?? []) as {
        id: string; ticker: string; shares: number;
        last_synced_price: number | null; avg_cost_basis: number; account_id: string
      }[]) {
        if (holding.ticker === 'CASH') continue

        let price = holding.last_synced_price || 0
        if (!price && priceMap[holding.ticker]) {
          price = priceMap[holding.ticker]
        }
        if (price <= 0) continue

        holdingSnapshotRows.push({
          user_id: uid,
          holding_id: holding.id,
          ticker: holding.ticker,
          price,
          market_value: holding.shares * price,
          date: today,
        })
      }

      const snapshotErrors: string[] = []
      const accountSnapErr = await upsertRows(supabase, 'account_snapshots', accountSnapshotRows, 'account_id,date')
      if (accountSnapErr) snapshotErrors.push(`account_snapshots: ${accountSnapErr}`)
      const holdingSnapErr = await upsertRows(supabase, 'holding_snapshots', holdingSnapshotRows, 'holding_id,date')
      if (holdingSnapErr) snapshotErrors.push(`holding_snapshots: ${holdingSnapErr}`)
      if (snapshotErrors.length > 0) throw new Error(snapshotErrors.join('; '))

      results.push({ uid, ok: true })
    } catch (err) {
      results.push({ uid, ok: false, error: String(err) })
    }
  }

  // Metadata refreshes run only now that every snapshot is written, and only inside the run budget
  try {
    await refreshMetadata(run, supabase, finnhubKey, runDeadline)
  } catch (err) {
    console.error('[nightly] Security metadata refresh failed:', (err as Error)?.name)
  }

  const processed = results.filter((r) => r.ok && !r.skipped).length
  const skipped = results.filter((r) => r.skipped).length
  const failed = results.filter((r) => !r.ok).length

  // Run totals only, no user data
  console.log('[nightly] Run summary', JSON.stringify({
    durationMs: Date.now() - startedAt,
    finnhubCalls: run.finnhubCalls,
    finnhub429s: run.finnhub429s,
    quoteFallbacks: run.quoteFallbacks,
    budgetExceeded,
    syncFailed,
    syncFresh,
    accountsNeedingAttention: run.accountsNeedingAttention,
    metadataRefreshed: run.metadataRefreshed,
    metadataDeferred: run.metadataDeferred.size,
  }))

  await finishRunRow({
    processed,
    skipped,
    failed,
    budget_exceeded: budgetExceeded,
    notes: JSON.stringify({
      finnhub429s: run.finnhub429s,
      quoteFallbacks: run.quoteFallbacks,
      syncFailed,
      syncFresh,
      accountsNeedingAttention: run.accountsNeedingAttention,
      metadataRefreshed: run.metadataRefreshed,
      metadataDeferred: run.metadataDeferred.size,
    }),
  })

  return new Response(
    JSON.stringify({ date: today, processed, skipped, failed, budgetExceeded, results }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
