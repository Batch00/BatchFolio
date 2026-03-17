'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CreditCard, PieChart, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/',          label: 'Dashboard', icon: LayoutDashboard },
  { href: '/accounts',  label: 'Accounts',  icon: CreditCard       },
  { href: '/portfolio', label: 'Portfolio', icon: PieChart         },
  { href: '/watchlist', label: 'Watchlist', icon: Star             },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex bg-[#0d1117] border-t border-[#21262d]">
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 py-3 text-xs transition-colors',
              isActive ? 'text-[#10b981]' : 'text-[#7d8590]',
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
