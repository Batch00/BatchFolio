import Sidebar from '@/components/Sidebar'
import BottomNav from '@/components/BottomNav'

export const dynamic = 'force-dynamic'

export default function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#0d1117]">
      <Sidebar />
      <BottomNav />
      <main className="md:pl-[240px] pb-16 md:pb-0">
        {children}
      </main>
    </div>
  )
}
