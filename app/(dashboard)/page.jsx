'use client'

import { useState, useCallback } from 'react'
import TopBar from '@/components/TopBar'
import OverviewTab from '@/components/dashboard/OverviewTab'
import AccountsTab from '@/components/dashboard/AccountsTab'
import PortfolioTab from '@/components/dashboard/PortfolioTab'
import WatchlistTab from '@/components/dashboard/WatchlistTab'
import StockDrawer from '@/components/StockDrawer'

export default function App() {
  const [activeTab, setActiveTab] = useState('overview')
  const [drawerStock, setDrawerStock] = useState(null)
  const [netWorthData, setNetWorthData] = useState({
    value: null,
    change: null,
    changePositive: true,
  })

  const handleDataLoaded = useCallback((data) => {
    setNetWorthData(data)
  }, [])

  return (
    <div className="flex flex-col h-screen bg-[#0d1117] overflow-hidden">
      <TopBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        netWorth={netWorthData.value}
        netWorthChange={netWorthData.change}
        netWorthChangePositive={netWorthData.changePositive}
      />

      <main className="flex-1 overflow-y-auto min-h-0">
        {activeTab === 'overview' && (
          <OverviewTab onOpenDrawer={setDrawerStock} onDataLoaded={handleDataLoaded} />
        )}
        {activeTab === 'accounts' && <AccountsTab onOpenDrawer={setDrawerStock} />}
        {activeTab === 'portfolio' && <PortfolioTab onOpenDrawer={setDrawerStock} />}
        {activeTab === 'watchlist' && <WatchlistTab onOpenDrawer={setDrawerStock} />}
      </main>

      {drawerStock && (
        <StockDrawer ticker={drawerStock} onClose={() => setDrawerStock(null)} />
      )}
    </div>
  )
}
