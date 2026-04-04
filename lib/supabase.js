import { createBrowserClient } from '@supabase/ssr'

// Fallback placeholders prevent the client constructor from throwing during
// build-time SSR. Real values must be set in .env.local / Vercel env vars.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key',
    {
      db: { schema: 'batchfolio' },
    },
  )
}
