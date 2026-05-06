import { createClient } from '@/lib/supabase/server'
import ReadingChart from '@/components/reading-chart-wrapper'
import type { YearStat, DrillBook } from '@/components/reading-chart'
import BookStrip from '@/components/book-strip'
import NextReadWidget from '@/components/next-read-widget'
import { GENRE_LABELS } from '@/lib/genres'
import type { Genre } from '@/lib/genres'
import Link from 'next/link'

type RawEntry = {
  date_read: string
  my_rating: number | null
  books: {
    id: string
    title: string
    author_primary: string
    cover_url: string | null
    pages: number | null
    book_genres: { genre: string }[]
  } | null
}

type RecentBook = {
  id: string
  title: string
  author_primary: string
  cover_url: string | null
  shelf_entries: { shelf: string }[]
}

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 px-5 py-4 shadow-sm text-center min-w-[90px]">
      <p className="text-2xl font-serif font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5 leading-snug">{label}</p>
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { data: rawEntries },
    { data: recentAddedRaw },
    { count: totalBooks },
  ] = await Promise.all([
    supabase
      .from('shelf_entries')
      .select('date_read, my_rating, books(id, title, author_primary, cover_url, pages, book_genres(genre))')
      .eq('shelf', 'read')
      .not('date_read', 'is', null)
      .order('date_read', { ascending: false }),
    supabase
      .from('books')
      .select('id, title, author_primary, cover_url, shelf_entries(shelf)')
      .order('created_at', { ascending: false })
      .limit(12),
    supabase
      .from('books')
      .select('*', { count: 'exact', head: true }),
  ])

  const entries = (rawEntries ?? []) as unknown as RawEntry[]
  const recentAdded = (recentAddedRaw ?? []) as unknown as RecentBook[]

  // ── Build year stats ───────────────────────────────────────────────────────

  type YearAccum = {
    books: DrillBook[]
    pages: number
    ratings: number[]
    genreCounts: Map<string, number>
  }

  const yearMap = new Map<number, YearAccum>()

  for (const entry of entries) {
    if (!entry.books) continue
    const year = new Date(entry.date_read).getUTCFullYear()
    if (!yearMap.has(year)) {
      yearMap.set(year, { books: [], pages: 0, ratings: [], genreCounts: new Map() })
    }
    const ys = yearMap.get(year)!
    ys.books.push({
      id: entry.books.id,
      title: entry.books.title,
      author: entry.books.author_primary,
      coverUrl: entry.books.cover_url,
      rating: entry.my_rating,
    })
    if (entry.books.pages) ys.pages += entry.books.pages
    if (entry.my_rating && entry.my_rating > 0) ys.ratings.push(entry.my_rating)
    for (const g of entry.books.book_genres ?? []) {
      ys.genreCounts.set(g.genre, (ys.genreCounts.get(g.genre) ?? 0) + 1)
    }
  }

  const yearStats: YearStat[] = [...yearMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, ys]) => ({
      year,
      count: ys.books.length,
      totalPages: ys.pages,
      avgRating: ys.ratings.length > 0
        ? parseFloat((ys.ratings.reduce((a, b) => a + b, 0) / ys.ratings.length).toFixed(1))
        : null,
      topGenres: [...ys.genreCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([genre, count]) => ({
          label: GENRE_LABELS[genre as Genre] ?? genre,
          count,
        })),
      books: ys.books,
    }))

  // ── Top-line metrics ───────────────────────────────────────────────────────

  const thisYear = new Date().getFullYear()
  const thisYearCount = yearMap.get(thisYear)?.books.length ?? 0
  const lastYearCount = yearMap.get(thisYear - 1)?.books.length ?? 0

  const now = new Date()
  const daysElapsed = Math.ceil(
    (now.getTime() - new Date(thisYear, 0, 1).getTime()) / (1000 * 60 * 60 * 24)
  )
  const projected = thisYearCount > 0
    ? Math.round((thisYearCount / daysElapsed) * 365)
    : null

  // All-time top genres (from read books only)
  const allGenreCounts = new Map<string, number>()
  for (const entry of entries) {
    for (const g of entry.books?.book_genres ?? []) {
      allGenreCounts.set(g.genre, (allGenreCounts.get(g.genre) ?? 0) + 1)
    }
  }
  const topGenres = [...allGenreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([genre]) => ({ genre, label: GENRE_LABELS[genre as Genre] ?? genre }))

  // ── Recently finished (first 12, already desc by date_read) ───────────────

  const recentlyFinished = entries.slice(0, 12).flatMap((e) =>
    e.books ? [{ id: e.books.id, title: e.books.title, author: e.books.author_primary, coverUrl: e.books.cover_url, rating: e.my_rating }] : []
  )

  return (
    <main className="p-6 md:p-8">
      <h1 className="text-2xl font-serif text-gray-900 mb-6 animate-fade-in">Dashboard</h1>

      {/* ── Top metrics ── */}
      <div className="flex flex-wrap gap-3 mb-6 animate-fade-in-delay-1">
        <StatCard value={(totalBooks ?? 0).toLocaleString()} label="in library" />
        <StatCard value={entries.length.toLocaleString()} label="books read" />
        <StatCard value={thisYearCount} label={`read in ${thisYear}`} />
        {projected !== null && (
          <StatCard
            value={projected}
            label={`${projected > lastYearCount ? '↑' : projected < lastYearCount ? '↓' : '='} pace vs ${lastYearCount} last year`}
          />
        )}
      </div>

      {/* All-time top genres */}
      {topGenres.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-8 animate-fade-in-delay-2">
          <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">Top genres</span>
          {topGenres.map(({ genre, label }) => (
            <span key={genre} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
              {label}
            </span>
          ))}
        </div>
      )}

      {/* ── Reading chart ── */}
      {yearStats.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm mb-8 animate-fade-in-delay-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Books read by year</h2>
          <ReadingChart yearStats={yearStats} />
        </section>
      )}

      {/* ── Recommendations ── */}
      <div className="animate-fade-in-delay-3">
        <NextReadWidget />
      </div>

      {/* ── Recently finished ── */}
      {recentlyFinished.length > 0 && (
        <section className="mb-8 animate-fade-in-delay-3">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Recently finished</h2>
            <Link href="/shelves/read" className="text-xs hover:underline" style={{ color: '#2C5F2D' }}>
              See all →
            </Link>
          </div>
          <BookStrip books={recentlyFinished.map((b) => ({ ...b, rating: null }))} />
        </section>
      )}

      {/* ── Recently added ── */}
      {recentAdded.length > 0 && (
        <section className="mb-8 animate-fade-in-delay-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Recently added</h2>
          <BookStrip
            books={recentAdded.map((b) => ({
              id: b.id,
              title: b.title,
              author: b.author_primary,
              coverUrl: b.cover_url,
              rating: null,
            }))}
          />
        </section>
      )}
    </main>
  )
}
