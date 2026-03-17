'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, CreditCard, PieChart, Star, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase'

const navItems = [
  { href: '/',           label: 'Dashboard', icon: LayoutDashboard },
  { href: '/accounts',   label: 'Accounts',  icon: CreditCard       },
  { href: '/portfolio',  label: 'Portfolio', icon: PieChart         },
  { href: '/watchlist',  label: 'Watchlist', icon: Star             },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="hidden md:flex flex-col w-[240px] min-h-screen bg-[#0d1117] border-r border-[#21262d] fixed top-0 left-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#21262d]">
        <span className="text-lg font-semibold">
          <span className="text-[#7d8590]">Batch</span>
          <span className="text-[#10b981]">Folio</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 text-sm rounded-sm transition-colors border-l-2',
                isActive
                  ? 'border-l-[#10b981] bg-[rgba(16,185,129,0.06)] text-[#e6edf3]'
                  : 'border-l-transparent text-[#7d8590] hover:text-[#e6edf3] hover:bg-[#21262d]/30',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t border-[#21262d]">
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 px-3 py-2 text-sm text-[#7d8590] hover:text-[#e6edf3] rounded-sm transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
