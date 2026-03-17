'use client'

import { LayoutDashboard, Briefcase, Star, Settings, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const SECTIONS = [
  { id: 'portfolio', icon: LayoutDashboard, label: 'Portfolio' },
  { id: 'accounts', icon: Briefcase, label: 'Accounts' },
  { id: 'watchlist', icon: Star, label: 'Watchlist' },
  { id: 'settings', icon: Settings, label: 'Settings' },
]

export default function IconRail({ activeSection, onChange }) {
  const supabase = createClient()
  const router = useRouter()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="hidden md:flex flex-col w-[52px] h-full bg-[#0d1117] border-r border-[#21262d] flex-shrink-0">
      {/* Logo mark */}
      <div className="h-[52px] flex items-center justify-center border-b border-[#21262d] flex-shrink-0">
        <span className="font-mono text-xs font-bold leading-none">
          <span style={{ color: '#7d8590' }}>B</span>
          <span style={{ color: '#10b981' }}>F</span>
        </span>
      </div>

      {/* Nav icons */}
      <nav className="flex-1 flex flex-col items-stretch pt-1">
        {SECTIONS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            title={label}
            onClick={() => onChange(id)}
            className={`relative w-full h-10 flex items-center justify-center border-l-2 transition-colors ${
              activeSection === id
                ? 'border-l-[#10b981] text-[#10b981]'
                : 'border-l-transparent text-[#7d8590] hover:text-[#e6edf3]'
            }`}
          >
            <Icon size={16} />
          </button>
        ))}
      </nav>

      {/* Sign out */}
      <button
        title="Sign out"
        onClick={handleSignOut}
        className="h-10 flex items-center justify-center text-[#7d8590] hover:text-[#f87171] transition-colors mb-2"
      >
        <LogOut size={16} />
      </button>
    </aside>
  )
}
