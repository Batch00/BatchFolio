declare namespace Deno {
  function serve(handler: (request: Request) => Response | Promise<Response>): void
  const env: {
    get(key: string): string | undefined
  }
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export { createClient } from '@supabase/supabase-js'
}
