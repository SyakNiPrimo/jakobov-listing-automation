import type { Metadata } from 'next'
import './globals.css'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Jakobov Listing Automation',
  description: 'Social media creative automation for The Jakobov Group',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen" style={{ background: 'var(--navy)' }}>
        <nav className="border-b" style={{ borderColor: 'rgba(201,169,110,0.2)', background: 'rgba(46,26,71,0.6)' }}>
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="font-headline text-xl tracking-wide" style={{ color: 'var(--gold)' }}>
              Jakobov Listing Automation
            </Link>
            <div className="flex gap-6 text-sm font-medium" style={{ color: 'var(--gray)' }}>
              <Link href="/" className="hover:text-[#C9A96E] transition-colors">Dashboard</Link>
              <Link href="/settings" className="hover:text-[#C9A96E] transition-colors">Settings</Link>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
