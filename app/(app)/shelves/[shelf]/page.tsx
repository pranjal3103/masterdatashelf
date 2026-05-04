import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BookCard from '@/components/book-card'
import Pagination from '@/components/pagination'
import ShelfControls from './shelf-controls'
import { Suspense } from 'react'

const VALID_SHELVES = ['read', 'to-read', 'currently-reading', 'owned'] as const
type ShelfParam = typeof VALID_SHELVES[number]

const SHELF_LABELS: Record<ShelfParam, string> = {
  'read': 'Read',
  'to-read': 'To Read',
  'currently-reading': 'Currently Reading',
  'owned': 'Owned',
}

const PAGE_SIZE = 48

type SearchParams = {
  sort?: string
  order?: string
  q?: string
  page?: string
}

export default async function ShelfPage({
  params,
  searchParams,
}: {
  params: Promise<{ shelf: string }>
  searchParams: Promise<SearchParams>
}) {
  const { shelf } = await params
  const { sort = 'date_added', order = 'desc', q = '', page = '1' } = await searchParams

  if (!VALID_SHELVES.includes(shelf as ShelfParam)) notFound()

  const supabase = await createClient()
  const currentPage = Math.max(1, parseInt(page, 10) || 1)
  const offset = (currentPage - 1) * PAGE_SIZE

  // Step 1: paginated query.
  // The !inner + .eq filter on shelf_entries does two things in PostgREST:
  // (a) only return books that have a matching shelf entry, and
  // (b) only return THAT shelf's entry in the result — hiding other shelf memberships.
  // We accept (b) here and fix it in Step 2.
  let query = supabase
    .from('books')
    .select(
      `id, title, author_primary, cover_url, year_published,
       shelf_entries!inner(shelf, date_read, date_added, my_rating)`,
      { count: 'exact' }
    )
    .eq('shelf_entries.shelf', shelf)

  if (q.trim()) {
    query = query.or(`title.ilike.%${q.trim()}%,author_primary.ilike.%${q.trim()}%`)
  }

  const asc = order === 'asc'
  switch (sort) {
    case 'title':
      query = query.order('title', { ascending: asc })
      break
    case 'author':
      query = query.order('author_primary', { ascending: asc })
      break
    case 'year':
      query = query.order('year_published', { ascending: asc, nullsFirst: false })
      break
    case 'rating':
      query = query.order('my_rating', { ascending: asc, nullsFirst: false, referencedTable: 'shelf_entries' })
      break
    default:
      query = query.order('date_added', { ascending: asc, nullsFirst: false, referencedTable: 'shelf_entries' })
  }

  query = query.range(offset, offset + PAGE_SIZE - 1)

  const { data: rawBooks, count, error } = await query

  if (error) console.error('Shelf query error:', error)

  // Step 2: fetch ALL shelf memberships for these books in one small query.
  // This is the fix — we now know every shelf each book belongs to.
  const bookIds = rawBooks?.map((b) => b.id) ?? []
  const shelvesMap = new Map<string, string[]>()

  if (bookIds.length > 0) {
    const { data: allEntries } = await supabase
      .from('shelf_entries')
      .select('book_id, shelf')
      .in('book_id', bookIds)

    for (const entry of allEntries ?? []) {
      const list = shelvesMap.get(entry.book_id) ?? []
      list.push(entry.shelf)
      shelvesMap.set(entry.book_id, list)
    }
  }

  const totalCount = count ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  type RawBook = {
    id: string
    title: string
    author_primary: string
    cover_url: string | null
    year_published: number | null
    shelf_entries: { my_rating: number | null }[]
  }

  return (
    <main className="p-6 md:p-8">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-serif text-gray-900">{SHELF_LABELS[shelf as ShelfParam]}</h1>
        {totalCount > 0 && (
          <span className="text-sm text-gray-400">{totalCount.toLocaleString()} books</span>
        )}
      </div>

      <Suspense>
        <ShelfControls sort={sort} order={order} q={q} />
      </Suspense>

      {rawBooks && rawBooks.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {(rawBooks as RawBook[]).map((book) => (
              <BookCard
                key={book.id}
                id={book.id}
                title={book.title}
                author={book.author_primary}
                coverUrl={book.cover_url}
                rating={book.shelf_entries[0]?.my_rating ?? null}
                year={book.year_published}
                shelves={shelvesMap.get(book.id) ?? [shelf]}
              />
            ))}
          </div>

          <Suspense>
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={PAGE_SIZE}
            />
          </Suspense>
        </>
      ) : (
        <div className="text-center py-16 text-gray-400 text-sm">
          {q ? `No books matching "${q}"` : 'No books on this shelf yet.'}
        </div>
      )}
    </main>
  )
}
