import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#10b981',
}

export const metadata = {
  title: 'BatchFolio',
  description: 'Investment portfolio tracker by Batch Apps',
  manifest: '/manifest.json',
  themeColor: '#10b981',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BatchFolio',
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/icon-192.png',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-[#0d1117] text-[#e6edf3]`}>
        {children}
      </body>
    </html>
  )
}
