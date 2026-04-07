'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import TopBar from '@/components/TopBar'
import OverviewTab from '@/components/dashboard/OverviewTab'
import AccountsTab from '@/components/dashboard/AccountsTab'
import PortfolioTab from '@/components/dashboard/PortfolioTab'
import WatchlistTab from '@/components/dashboard/WatchlistTab'
import StockDrawer from '@/components/StockDrawer'
import { LayoutDashboard, Briefcase, PieChart, Star, X } from 'lucide-react'

const TABS = [
  { id: 'overview',  label: 'Overview',  icon: LayoutDashboard },
  { id: 'accounts',  label: 'Accounts',  icon: Briefcase },
  { id: 'portfolio', label: 'Portfolio', icon: PieChart },
  { id: 'watchlist', label: 'Watchlist', icon: Star },
]

export default function App() {
  const supabase = createClient()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('overview')
  const [drawerStock, setDrawerStock] = useState(null)
  const [netWorthData, setNetWorthData] = useState({
    value: null,
    change: null,
    changePositive: true,
  })
  const [user, setUser] = useState(null)

  // Version polling for auto-refresh banner
  const initialVersionRef = useRef(null)
  const [currentVersion, setCurrentVersion] = useState(null)
  const [updateDismissed, setUpdateDismissed] = useState(false)

  // Demo toast
  const [demoToast, setDemoToast] = useState(false)
  const demoToastTimerRef = useRef(null)

  const isDemo = user?.email === 'demo@batchfolio.app'
  const updateAvailable =
    initialVersionRef.current &&
    currentVersion &&
    initialVersionRef.current !== currentVersion

  // Load current user — redirect to /set-password on first invite login
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (u) {
        const meta = u.app_metadata ?? {}
        const isInviteUser =
          meta.provider === 'email' &&
          Array.isArray(meta.providers) &&
          meta.providers.length === 1 &&
          meta.providers[0] === 'email'
        const noUserMetadata = Object.keys(u.user_metadata ?? {}).length === 0
        if (isInviteUser && noUserMetadata) {
          router.replace('/set-password')
          return
        }
      }
      setUser(u)
    })
  }, [])

  // Version polling
  useEffect(() => {
    async function fetchVersion() {
      try {
        const res = await fetch('/api/version')
        const { version } = await res.json()
        if (!initialVersionRef.current) {
          initialVersionRef.current = version
        }
        setCurrentVersion(version)
      } catch {
        // network error - ignore
      }
    }

    fetchVersion()
    const interval = setInterval(fetchVersion, 60_000)
    return () => clearInterval(interval)
  }, [])

  const handleDataLoaded = useCallback((data) => {
    setNetWorthData(data)
  }, [])

  function showDemoToast() {
    setDemoToast(true)
    if (demoToastTimerRef.current) clearTimeout(demoToastTimerRef.current)
    demoToastTimerRef.current = setTimeout(() => setDemoToast(false), 3500)
  }

  return (
    <div className="flex flex-col h-screen bg-[#0d1117] overflow-hidden">
      <TopBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        netWorth={netWorthData.value}
        netWorthChange={netWorthData.change}
        netWorthChangePositive={netWorthData.changePositive}
        user={user}
        isDemo={isDemo}
        onDemoBlock={showDemoToast}
      />

      {/* Version update banner */}
      {updateAvailable && !updateDismissed && (
        <div
          className="flex items-center justify-between px-4 py-2 flex-shrink-0"
          style={{
            background: 'rgba(16,185,129,0.08)',
            borderBottom: '1px solid rgba(16,185,129,0.2)',
          }}
        >
          <span style={{ color: '#10b981', fontSize: 12 }}>A new version is available</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="text-xs font-medium px-2.5 py-1 rounded border transition-colors"
              style={{
                color: '#10b981',
                borderColor: 'rgba(16,185,129,0.4)',
                background: 'rgba(16,185,129,0.1)',
                fontSize: 12,
              }}
            >
              Refresh
            </button>
            <button
              onClick={() => setUpdateDismissed(true)}
              style={{ color: '#10b981' }}
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Demo mode banner */}
      {isDemo && (
        <div
          className="flex items-center px-4 py-2 flex-shrink-0"
          style={{
            background: 'rgba(251,191,36,0.08)',
            borderBottom: '1px solid rgba(251,191,36,0.2)',
          }}
        >
          <span style={{ color: '#fbbf24', fontSize: 12 }}>
            You are in demo mode - data resets nightly.{' '}
            <a
              href="https://www.batch-apps.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:opacity-80 transition-opacity"
              style={{ color: '#fbbf24' }}
            >
              Request access at batch-apps.com
            </a>{' '}
            to save your own portfolio.
          </span>
        </div>
      )}

      <main className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 pb-20 md:pb-0">
        {activeTab === 'overview' && (
          <OverviewTab
            onOpenDrawer={setDrawerStock}
            onDataLoaded={handleDataLoaded}
            isMobile={true}
            netWorthData={netWorthData}
          />
        )}
        {activeTab === 'accounts' && (
          <AccountsTab
            onOpenDrawer={setDrawerStock}
            isDemo={isDemo}
            onDemoBlock={showDemoToast}
          />
        )}
        {activeTab === 'portfolio' && <PortfolioTab onOpenDrawer={setDrawerStock} />}
        {activeTab === 'watchlist' && (
          <WatchlistTab
            onOpenDrawer={setDrawerStock}
            isDemo={isDemo}
            onDemoBlock={showDemoToast}
          />
        )}
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-stretch border-t"
        style={{
          background: '#0d1117',
          borderColor: '#21262d',
          paddingBottom: 'env(safe-area-inset-bottom)',
          minHeight: 'calc(56px + env(safe-area-inset-bottom))',
        }}
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors relative"
              style={{ color: active ? '#10b981' : '#7d8590', minHeight: 56 }}
            >
              <Icon className="h-5 w-5" />
              <span
                className="uppercase tracking-wider"
                style={{ fontSize: 9, fontWeight: 500 }}
              >
                {label}
              </span>
              {active && (
                <span
                  className="absolute bottom-0 left-1/2 -translate-x-1/2"
                  style={{ width: 20, height: 2, background: '#10b981', borderRadius: 1 }}
                />
              )}
            </button>
          )
        })}
      </nav>

      {/* Demo write-blocked toast */}
      {demoToast && (
        <div
          className="fixed bottom-20 md:bottom-6 right-4 z-50 px-4 py-3 rounded-md border shadow-lg max-w-xs"
          style={{
            background: '#161b22',
            borderColor: '#21262d',
          }}
        >
          <p className="text-sm text-[#e6edf3]">
            This is a demo account.{' '}
            <a
              href="https://www.batch-apps.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#10b981] hover:text-[#34d399] transition-colors"
            >
              Request access at batch-apps.com
            </a>{' '}
            to save your own data.
          </p>
        </div>
      )}

      {drawerStock && (
        <StockDrawer ticker={drawerStock} onClose={() => setDrawerStock(null)} />
      )}
    </div>
  )
}
