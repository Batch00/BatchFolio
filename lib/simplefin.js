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
