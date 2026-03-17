'use client'

import PortfolioPanel from '@/components/panels/PortfolioPanel'
import AccountsPanel from '@/components/panels/AccountsPanel'
import WatchlistPanel from '@/components/panels/WatchlistPanel'
import SettingsPanel from '@/components/panels/SettingsPanel'

export default function PrimaryPanel({ activeSection, onOpenDetail }) {
  return (
    <div className="flex flex-col h-full bg-[#0d1117] overflow-hidden">
      {activeSection === 'portfolio' && <PortfolioPanel onOpenDetail={onOpenDetail} />}
      {activeSection === 'accounts' && <AccountsPanel onOpenDetail={onOpenDetail} />}
      {activeSection === 'watchlist' && <WatchlistPanel onOpenDetail={onOpenDetail} />}
      {activeSection === 'settings' && <SettingsPanel />}
    </div>
  )
}
