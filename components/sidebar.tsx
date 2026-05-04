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
      <aside className="hidden md:flex flex-col w-52 shrink-0 border-r border-gray-100 min-h-screen sticky top-0 h-screen" style={{ backgroundColor: '#FAF7F2' }}>
        <div className="px-4 py-5 border-b border-gray-100">
          <span className="text-lg font-serif font-semibold text-gray-900">Masterdatashelf</span>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-0.5">
          {NAV_ITEMS.map(({ label, href, shelf }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            const count = shelf ? counts[shelf] : null
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'font-medium text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
                style={active ? { backgroundColor: '#2C5F2D' } : {}}
              >
                <span>{label}</span>
                {count !== null && count > 0 && (
                  <span className={`text-xs tabular-nums ${active ? 'text-green-100' : 'text-gray-400'}`}>
                    {count.toLocaleString()}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="px-2 pb-4 space-y-0.5 border-t border-gray-100 pt-4">
          <Link
            href="/settings"
            className={`flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname === '/settings'
                ? 'font-medium text-white'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
            style={pathname === '/settings' ? { backgroundColor: '#2C5F2D' } : {}}
          >
            Settings
          </Link>
          <button
            onClick={signOut}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 z-10" style={{ backgroundColor: '#FAF7F2' }}>
        <span className="text-base font-serif font-semibold text-gray-900">Masterdatashelf</span>
        <nav className="flex gap-1 overflow-x-auto text-xs">
          {NAV_ITEMS.map(({ label, href }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={`px-2.5 py-1.5 rounded-md whitespace-nowrap transition-colors ${
                  active ? 'text-white' : 'text-gray-500 hover:text-gray-800'
                }`}
                style={active ? { backgroundColor: '#2C5F2D' } : {}}
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
