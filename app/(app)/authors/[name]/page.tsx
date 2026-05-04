import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import BookCard from '@/components/book-card'

type BookRow = {
  id: string
  title: string
  author_primary: string
  cover_url: string | null
  year_published: number | null
  shelf_entries: { shelf: string; my_rating: number | null; date_read: string | null }[]
}

export default async function AuthorPage({
  params,
}: {
  params: Promise<{ name: string }>
}) {
  const { name } = await params
  const authorName = decodeURIComponent(name)

  const supabase = await createClient()

  const { data: books } = await supabase
    .from('books')
    .select('id, title, author_primary, cover_url, year_published, shelf_entries(shelf, my_rating, date_read)')
    .ilike('author_primary', authorName)
    .order('year_published', { ascending: true, nullsFirst: false })

  if (!books || books.length === 0) notFound()

  // ── Stats ──────────────────────────────────────────────────────────────────

  const allShelves = (books as BookRow[]).flatMap((b) => b.shelf_entries.map((e) => e.shelf))
  const readCount = allShelves.filter((s) => s === 'read').length
  const tbrCount = allShelves.filter((s) => s === 'to-read').length
  const ownedCount = allShelves.filter((s) => s === 'owned').length

  const ratings = (books as BookRow[])
    .flatMap((b) => b.shelf_entries.map((e) => e.my_rating))
    .filter((r): r is number => r !== null && r > 0)
  const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null

  // Sort: read books first, then TBR, then untracked
  const sorted = [...(books as BookRow[])].sort((a, b) => {
    const shelfOrder = (book: BookRow) => {
      const shelves = book.shelf_entries.map((e) => e.shelf)
      if (shelves.includes('read')) return 0
      if (shelves.includes('currently-reading')) return 1
      if (shelves.includes('owned')) return 2
      if (shelves.includes('to-read')) return 3
      return 4
    }
    return shelfOrder(a) - shelfOrder(b)
  })

  return (
    <main className="p-6 md:p-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-gray-400 mb-6">
        <Link href="/dashboard" className="hover:text-gray-700 transition-colors">Dashboard</Link>
        <span>/</span>
        <span className="text-gray-600">{authorName}</span>
      </nav>

      {/* Author header */}
      <div className="mb-8">
        <h1 className="text-2xl font-serif text-gray-900 mb-4">{authorName}</h1>

        {/* Stats row */}
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="bg-white rounded-lg border border-gray-100 px-4 py-2.5 shadow-sm text-center min-w-[80px]">
            <p className="text-xl font-serif font-semibold text-gray-900">{books.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">In library</p>
          </div>
          {readCount > 0 && (
            <div className="bg-white rounded-lg border border-gray-100 px-4 py-2.5 shadow-sm text-center min-w-[80px]">
              <p className="text-xl font-serif font-semibold text-gray-900">{readCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">Read</p>
            </div>
          )}
          {avgRating && (
            <div className="bg-white rounded-lg border border-gray-100 px-4 py-2.5 shadow-sm text-center min-w-[80px]">
              <p className="text-xl font-serif font-semibold text-gray-900">★ {avgRating}</p>
              <p className="text-xs text-gray-400 mt-0.5">Avg rating</p>
            </div>
          )}
          {tbrCount > 0 && (
            <div className="bg-white rounded-lg border border-gray-100 px-4 py-2.5 shadow-sm text-center min-w-[80px]">
              <p className="text-xl font-serif font-semibold text-gray-900">{tbrCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">To read</p>
            </div>
          )}
          {ownedCount > 0 && (
            <div className="bg-white rounded-lg border border-gray-100 px-4 py-2.5 shadow-sm text-center min-w-[80px]">
              <p className="text-xl font-serif font-semibold text-gray-900">{ownedCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">Owned</p>
            </div>
          )}
        </div>
      </div>

      {/* Book grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {sorted.map((book) => (
          <BookCard
            key={book.id}
            id={book.id}
            title={book.title}
            author={book.author_primary}
            coverUrl={book.cover_url}
            rating={book.shelf_entries.find((e) => e.my_rating && e.my_rating > 0)?.my_rating ?? null}
            year={book.year_published}
            shelves={book.shelf_entries.map((e) => e.shelf)}
          />
        ))}
      </div>
    </main>
  )
}
