// Keep in sync with isSimplefinUrl in supabase/functions/nightly-snapshot/index.ts

const SIMPLEFIN_HOSTS = ['bridge.simplefin.org', 'beta-bridge.simplefin.org']

// True only for an https URL on a SimpleFIN Bridge host. Used for the claim URL,
// the access URL returned by the claim, and the stored access URL before each sync.
export function isSimplefinUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && SIMPLEFIN_HOSTS.includes(url.host)
  } catch {
    return false
  }
}

// Mirrors simplefinAccountSkipReason in supabase/functions/nightly-snapshot/index.ts - keep in sync.
// Returns why an account SimpleFIN returned should keep its stored data this sync, or null to
// sync it. A connection that needs re-auth (RBC does every so often) can come back with an
// error, an empty balance or an old balance date. Writing that would zero the balance, delete
// its holdings as sold or rewrite its cash, so the stored data is kept until it works again.
// stored is the account's current row, or null when it is new or a credit card.
export function simplefinAccountSkipReason(sfAcc, errors, stored) {
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
