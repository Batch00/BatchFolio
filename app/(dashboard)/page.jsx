'use client'

import { useState } from 'react'
import { LayoutDashboard, Briefcase, Star, Settings, X } from 'lucide-react'
import IconRail from '@/components/IconRail'
import PrimaryPanel from '@/components/PrimaryPanel'
import Canvas from '@/components/Canvas'
import DetailPanel from '@/components/DetailPanel'

const MOBILE_NAV = [
  { id: 'portfolio', icon: LayoutDashboard, label: 'Portfolio' },
  { id: 'accounts', icon: Briefcase, label: 'Accounts' },
  { id: 'watchlist', icon: Star, label: 'Watchlist' },
  { id: 'settings', icon: Settings, label: 'Settings' },
]

export default function App() {
  const [activeSection, setActiveSection] = useState('portfolio')
  const [detailPanel, setDetailPanel] = useState(null)
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)

  function handleSectionChange(section) {
    setActiveSection(section)
    setMobilePanelOpen(true)
  }

  function handleOpenDetail(panel) {
    setDetailPanel(panel)
    setMobilePanelOpen(false)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0d1117]">
      {/* Desktop: Icon Rail */}
      <IconRail activeSection={activeSection} onChange={handleSectionChange} />

      {/* Desktop: Primary Panel */}
      <div className="hidden md:flex flex-col w-[320px] flex-shrink-0 border-r border-[#21262d] h-full overflow-hidden">
        <PrimaryPanel activeSection={activeSection} onOpenDetail={handleOpenDetail} />
      </div>

      {/* Canvas area */}
      <div className="flex-1 min-w-0 relative h-full overflow-hidden">
        <div className="h-full overflow-y-auto pb-16 md:pb-0">
          <Canvas onOpenDetail={handleOpenDetail} />
        </div>
        {/* Backdrop: clicking canvas closes detail panel on desktop */}
        {detailPanel && (
          <div
            className="absolute inset-0 z-10"
            onClick={() => setDetailPanel(null)}
          />
        )}
      </div>

      {/* Detail Panel */}
      {detailPanel && (
        <DetailPanel panel={detailPanel} onClose={() => setDetailPanel(null)} />
      )}

      {/* Mobile: Primary Panel Overlay */}
      {mobilePanelOpen && (
        <div className="md:hidden fixed inset-0 z-30 flex flex-col bg-[#0d1117]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#21262d] flex-shrink-0">
            <span className="text-sm text-[#e6edf3] font-medium capitalize">{activeSection}</span>
            <button
              onClick={() => setMobilePanelOpen(false)}
              className="text-[#7d8590] hover:text-[#e6edf3] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <PrimaryPanel
              activeSection={activeSection}
              onOpenDetail={(p) => {
                setDetailPanel(p)
                setMobilePanelOpen(false)
              }}
            />
          </div>
        </div>
      )}

      {/* Mobile: Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex bg-[#0d1117] border-t border-[#21262d]">
        {MOBILE_NAV.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => handleSectionChange(id)}
            className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs transition-colors ${
              activeSection === id ? 'text-[#10b981]' : 'text-[#7d8590]'
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}
