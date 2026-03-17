'use client'

import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { LogOut, ExternalLink } from 'lucide-react'

export default function SettingsPanel() {
  const supabase = createClient()
  const router = useRouter()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b border-[#21262d] flex-shrink-0">
        <p className="text-xs text-[#7d8590] uppercase tracking-wider">Settings</p>
      </div>

      <div className="flex-1 p-4 space-y-3">
        <div className="bg-[#161b22] border border-[#21262d] rounded-md overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#21262d]">
            <p className="text-xs text-[#7d8590] uppercase tracking-wider mb-1">Display</p>
            <p className="text-xs text-[#e6edf3]">Dark mode</p>
            <p className="text-xs text-[#7d8590] mt-0.5">BatchFolio uses dark mode only.</p>
          </div>
        </div>

        <div className="bg-[#161b22] border border-[#21262d] rounded-md overflow-hidden">
          <a
            href="https://batch-apps.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-4 py-3 text-sm text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#21262d]/30 transition-colors"
          >
            <span>batch-apps.com</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="bg-[#161b22] border border-[#21262d] rounded-md overflow-hidden">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-[#7d8590] hover:text-[#f87171] hover:bg-[#21262d]/30 transition-colors"
          >
            <span>Sign out</span>
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
