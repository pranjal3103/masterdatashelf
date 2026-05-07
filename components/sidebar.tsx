'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Counts = {
  read: number
  'to-read': number
  'currently-reading': number
  owned: number
}

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', shelf: null },
  { label: 'Read', href: '/shelves/read', shelf: 'read' as const },
  { label: 'To Read', href: '/shelves/to-read', shelf: 'to-read' as const },
  { label: 'Currently Reading', href: '/shelves/currently-reading', shelf: 'currently-reading' as const },
  { label: 'Owned', href: '/shelves/owned', shelf: 'owned' as const },
]

export default function Sidebar({ counts }: { counts: Counts }) {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-52 shrink-0 min-h-screen sticky top-0 h-screen" style={{ backgroundColor: '#faf9f5', borderRight: '1px solid #e9e8e4' }}>
        <div className="px-4 py-5" style={{ borderBottom: '1px solid #e9e8e4' }}>
          <span className="text-lg font-serif font-semibold" style={{ color: '#04152e' }}>Masterdatashelf</span>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-0.5">
          {NAV_ITEMS.map(({ label, href, shelf }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            const count = shelf ? counts[shelf] : null
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center justify-between px-3 py-2 rounded text-sm transition-colors ${
                  active
                    ? 'font-medium text-white'
                    : 'hover:bg-[#efeeea]'
                }`}
                style={active ? { backgroundColor: '#04152e' } : { color: '#44474d' }}
              >
                <span>{label}</span>
                {count !== null && count > 0 && (
                  <span className={`text-xs tabular-nums ${active ? 'text-blue-200' : ''}`}
                    style={!active ? { color: '#75777e' } : {}}>
                    {count.toLocaleString()}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="px-2 pb-4 space-y-0.5 pt-4" style={{ borderTop: '1px solid #e9e8e4' }}>
          <Link
            href="/settings"
            className={`flex items-center px-3 py-2 rounded text-sm transition-colors ${
              pathname === '/settings'
                ? 'font-medium text-white'
                : 'hover:bg-[#efeeea]'
            }`}
            style={pathname === '/settings' ? { backgroundColor: '#04152e' } : { color: '#44474d' }}
          >
            Settings
          </Link>
          <button
            onClick={signOut}
            className="w-full text-left px-3 py-2 rounded text-sm transition-colors hover:bg-[#efeeea]"
            style={{ color: '#75777e' }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-10" style={{ backgroundColor: '#faf9f5', borderBottom: '1px solid #e9e8e4' }}>
        <span className="text-base font-serif font-semibold" style={{ color: '#04152e' }}>Masterdatashelf</span>
        <nav className="flex gap-1 overflow-x-auto text-xs">
          {NAV_ITEMS.map(({ label, href }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={`px-2.5 py-1.5 rounded whitespace-nowrap transition-colors ${
                  active ? 'text-white' : 'hover:bg-[#efeeea]'
                }`}
                style={active ? { backgroundColor: '#04152e' } : { color: '#44474d' }}
              >
                {label}
              </Link>
            )
          })}
        </nav>
      </div>
    </>
  )
}
