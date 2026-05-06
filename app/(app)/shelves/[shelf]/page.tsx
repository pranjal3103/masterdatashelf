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

type RawEntry = {
  book_id: string
  date_added: string | null
  my_rating: number | null
  books: {
    id: string
    title: string
    author_primary: string
    cover_url: string | null
    year_published: number | null
  } | null
}

// Query from shelf_entries → books so that date_added and my_rating are
// direct columns, making ORDER BY reliable across all sort options.
async function fetchShelfData(shelf: string, sort: string, order: string, q: string, page: number, genre: string) {
  const supabase = await createClient()
  const offset = (page - 1) * PAGE_SIZE
  const asc = order === 'asc'

  const validGenre = genre && (GENRES as readonly string[]).includes(genre) ? genre : ''

  // Run genre + search pre-filters in parallel to get allowed book IDs.
  const [genreResult, searchResult] = await Promise.all([
    validGenre
      ? supabase.from('book_genres').select('book_id').eq('genre', validGenre)
      : Promise.resolve({ data: null }),
    q.trim()
      ? supabase.from('books').select('id').or(`title.ilike.%${q.trim()}%,author_primary.ilike.%${q.trim()}%`)
      : Promise.resolve({ data: null }),
  ])

  const genreBookIds = genreResult.data ? genreResult.data.map((r) => r.book_id) : null
  const searchBookIds = searchResult.data ? searchResult.data.map((r) => r.id) : null

  // Main query: shelf_entries is the root so date_added / my_rating sort directly.
  let query = supabase
    .from('shelf_entries')
    .select(
      `book_id, date_added, my_rating,
       books!inner(id, title, author_primary, cover_url, year_published)`,
      { count: 'exact' }
    )
    .eq('shelf', shelf)

  // Genre filter
  if (genreBookIds !== null) {
    query = genreBookIds.length > 0
      ? query.in('book_id', genreBookIds)
      : query.in('book_id', ['00000000-0000-0000-0000-000000000000'])
  }

  // Search filter
  if (searchBookIds !== null) {
    query = searchBookIds.length > 0
      ? query.in('book_id', searchBookIds)
      : query.in('book_id', ['00000000-0000-0000-0000-000000000000'])
  }

  // Sort — date_added and my_rating are direct columns; title/author/year use referencedTable.
  switch (sort) {
    case 'title':  query = query.order('title', { ascending: asc, referencedTable: 'books' }); break
    case 'author': query = query.order('author_primary', { ascending: asc, referencedTable: 'books' }); break
    case 'year':   query = query.order('year_published', { ascending: asc, nullsFirst: false, referencedTable: 'books' }); break
    case 'rating': query = query.order('my_rating', { ascending: asc, nullsFirst: false }); break
    default:       query = query.order('date_added', { ascending: asc, nullsFirst: false })
  }

  query = query.range(offset, offset + PAGE_SIZE - 1)

  const { data: rawEntries, count, error } = await query
  if (error) console.error('Shelf query error:', error)

  const entries = (rawEntries ?? []) as unknown as RawEntry[]
  const bookIds = entries.flatMap((e) => (e.books ? [e.books.id] : []))

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

  return { entries, count: count ?? 0, allEntries, allGenres, validGenre }
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
  const { entries, count, allEntries, allGenres, validGenre } = await fetchShelfData(
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

  const totalPages = Math.ceil(count / PAGE_SIZE)

  return (
    <main className="p-6 md:p-8">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-serif text-gray-900">{SHELF_LABELS[shelf as ShelfParam]}</h1>
        {count > 0 && (
          <span className="text-sm text-gray-400">{count.toLocaleString()} books</span>
        )}
      </div>

      <Suspense>
        <ShelfControls sort={sort} order={order} q={q} genre={validGenre} />
      </Suspense>

      {entries.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 animate-fade-in">
            {entries.map((entry) => {
              if (!entry.books) return null
              const book = entry.books
              return (
                <BookCard
                  key={book.id}
                  id={book.id}
                  title={book.title}
                  author={book.author_primary}
                  coverUrl={book.cover_url}
                  rating={entry.my_rating ?? null}
                  year={book.year_published}
                  shelves={shelvesMap.get(book.id) ?? [shelf]}
                  genres={genresMap.get(book.id)}
                />
              )
            })}
          </div>
          <Suspense>
            <Pagination page={currentPage} totalPages={totalPages} totalCount={count} pageSize={PAGE_SIZE} />
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
