import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { count: total } = await supabase
    .from('books')
    .select('*', { count: 'exact', head: true })

  return (
    <main className="p-6 md:p-8">
      <h1 className="text-2xl font-serif text-gray-900 mb-6">Dashboard</h1>

      {total === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center shadow-sm">
          <p className="text-gray-500 text-sm">Your library is empty.</p>
          <a
            href="/settings"
            className="mt-3 inline-block text-sm font-medium underline underline-offset-2"
            style={{ color: '#2C5F2D' }}
          >
            Import your Goodreads CSV →
          </a>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 px-6 py-4 shadow-sm inline-flex items-center gap-2">
          <span className="text-2xl font-serif font-semibold text-gray-900">
            {(total ?? 0).toLocaleString()}
          </span>
          <span className="text-sm text-gray-400">books in your library</span>
        </div>
      )}
    </main>
  )
}
