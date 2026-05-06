import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BookCard from '@/components/book-card'
import Pagination from '@/components/pagination'
import ShelfControls from './shelf-controls'
import { Suspense } from 'react'
import { GENRES } from '@/lib/genres'

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
  genre?: string
}

type RawBook = {
  id: string
  title: string
  author_primary: string
  cover_url: string | null
  year_published: number | null
  shelf_entries: { my_rating: number | null }[]
}

async function fetchShelfData(shelf: string, sort: string, order: string, q: string, page: number, genre: string) {
  const supabase = await createClient()
  const offset = (page - 1) * PAGE_SIZE

  const validGenre = genre && (GENRES as readonly string[]).includes(genre) ? genre : ''
  let genreBookIds: string[] | null = null
  if (validGenre) {
    const { data: genreRows } = await supabase
      .from('book_genres')
      .select('book_id')
      .eq('genre', validGenre)
    genreBookIds = (genreRows ?? []).map((r) => r.book_id)
  }

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

  if (genreBookIds !== null) {
    query = genreBookIds.length > 0
      ? query.in('id', genreBookIds)
      : query.in('id', ['00000000-0000-0000-0000-000000000000'])
  }

  const asc = order === 'asc'
  switch (sort) {
    case 'title':   query = query.order('title', { ascending: asc }); break
    case 'author':  query = query.order('author_primary', { ascending: asc }); break
    case 'year':    query = query.order('year_published', { ascending: asc, nullsFirst: false }); break
    case 'rating':  query = query.order('my_rating', { ascending: asc, nullsFirst: false, referencedTable: 'shelf_entries' }); break
    default:        query = query.order('date_added', { ascending: asc, nullsFirst: false, referencedTable: 'shelf_entries' })
  }

  query = query.range(offset, offset + PAGE_SIZE - 1)

  const { data: rawBooks, count, error } = await query
  if (error) console.error('Shelf query error:', error)

  const bookIds = rawBooks?.map((b) => b.id) ?? []
  let allEntries: { book_id: string; shelf: string }[] = []
  let allGenres: { book_id: string; genre: string }[] = []

  if (bookIds.length > 0) {
    const [{ data: entriesData }, { data: genresData }] = await Promise.all([
      supabase.from('shelf_entries').select('book_id, shelf').in('book_id', bookIds),
      supabase.from('book_genres').select('book_id, genre').in('book_id', bookIds),
    ])
    allEntries = entriesData ?? []
    allGenres = genresData ?? []
  }

  return { rawBooks: (rawBooks ?? []) as RawBook[], count: count ?? 0, allEntries, allGenres, validGenre }
}

export default async function ShelfPage({
  params,
  searchParams,
}: {
  params: Promise<{ shelf: string }>
  searchParams: Promise<SearchParams>
}) {
  const { shelf } = await params
  const { sort = 'date_added', order = 'desc', q = '', page = '1', genre = '' } = await searchParams

  if (!VALID_SHELVES.includes(shelf as ShelfParam)) notFound()

  const currentPage = Math.max(1, parseInt(page, 10) || 1)
  const { rawBooks, count, allEntries, allGenres, validGenre } = await fetchShelfData(
    shelf, sort, order, q, currentPage, genre
  )

  const shelvesMap = new Map<string, string[]>()
  const genresMap = new Map<string, string[]>()
  for (const e of allEntries) {
    const list = shelvesMap.get(e.book_id) ?? []; list.push(e.shelf); shelvesMap.set(e.book_id, list)
  }
  for (const r of allGenres) {
    const list = genresMap.get(r.book_id) ?? []; list.push(r.genre); genresMap.set(r.book_id, list)
  }

  const totalCount = count
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <main className="p-6 md:p-8">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-serif text-gray-900">{SHELF_LABELS[shelf as ShelfParam]}</h1>
        {totalCount > 0 && (
          <span className="text-sm text-gray-400">{totalCount.toLocaleString()} books</span>
        )}
      </div>

      <Suspense>
        <ShelfControls sort={sort} order={order} q={q} genre={validGenre} />
      </Suspense>

      {rawBooks.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 animate-fade-in">
            {rawBooks.map((book) => (
              <BookCard
                key={book.id}
                id={book.id}
                title={book.title}
                author={book.author_primary}
                coverUrl={book.cover_url}
                rating={book.shelf_entries[0]?.my_rating ?? null}
                year={book.year_published}
                shelves={shelvesMap.get(book.id) ?? [shelf]}
                genres={genresMap.get(book.id)}
              />
            ))}
          </div>
          <Suspense>
            <Pagination page={currentPage} totalPages={totalPages} totalCount={totalCount} pageSize={PAGE_SIZE} />
          </Suspense>
        </>
      ) : (
        <div className="text-center py-16 text-gray-400 text-sm">
          {q ? `No books matching "${q}"` : validGenre ? `No books tagged "${validGenre}" on this shelf.` : 'No books on this shelf yet.'}
        </div>
      )}
    </main>
  )
}
