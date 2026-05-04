import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/sidebar'
import AddBookButton from '@/components/add-book-button'

async function getShelfCounts(supabase: Awaited<ReturnType<typeof createClient>>) {
  const shelves = ['read', 'to-read', 'currently-reading', 'owned'] as const
  const results = await Promise.all(
    shelves.map((shelf) =>
      supabase
        .from('shelf_entries')
        .select('*', { count: 'exact', head: true })
        .eq('shelf', shelf)
    )
  )
  return {
    read: results[0].count ?? 0,
    'to-read': results[1].count ?? 0,
    'currently-reading': results[2].count ?? 0,
    owned: results[3].count ?? 0,
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const counts = await getShelfCounts(supabase)

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#FAF7F2' }}>
      <Sidebar counts={counts} />
      <div className="flex-1 min-w-0 flex flex-col">
        {children}
      </div>
      <AddBookButton />
    </div>
  )
}
