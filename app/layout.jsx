import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata = {
  title: 'BatchFolio',
  description: 'Investment portfolio tracker - part of the Batch Apps umbrella',
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
