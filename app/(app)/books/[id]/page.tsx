import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import BookCard from '@/components/book-card'
import { getShelfBadge } from '@/lib/shelves'
import CoverImage from '@/components/cover-image'
import SimilarBooksWidget from '@/components/similar-books-widget'
import AddToShelfButton from '@/components/add-to-shelf-button'
import { GENRE_LABELS } from '@/lib/genres'
import type { Genre } from '@/lib/genres'

function StarRating({ rating }: { rating: number | null }) {
  if (!rating || rating < 1) return null
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="text-lg" style={{ color: i <= rating ? '#f59e0b' : '#e5e7eb' }}>★</span>
      ))}
    </div>
  )
}


export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: book }, { data: genreRows }] = await Promise.all([
    supabase
      .from('books')
      .select('*, shelf_entries(shelf, date_read, date_added, my_rating, my_review, read_count)')
      .eq('id', id)
      .single(),
    supabase
      .from('book_genres')
      .select('genre')
      .eq('book_id', id)
      .order('confidence', { ascending: false }),
  ])

  if (!book) notFound()

  const genres = (genreRows ?? []).map((r) => r.genre as Genre)

  // Prefer the 'read' entry for rating/review data; fall back to any entry that has it.
  const readEntry = book.shelf_entries.find((e: { shelf: string }) => e.shelf === 'read')
  const anyEntry = book.shelf_entries[0]
  const primary = readEntry ?? anyEntry

  const rating: number | null = primary?.my_rating ?? null
  const rawReview: string | null = primary?.my_review ?? null
  const review = rawReview
    ? rawReview
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim() || null
    : null
  const dateRead: string | null = readEntry?.date_read ?? null
  const readCount: number = readEntry?.read_count ?? 0
  const shelves: string[] = book.shelf_entries.map((e: { shelf: string }) => e.shelf)

  // Other books by the same author
  const { data: otherBooks } = await supabase
    .from('books')
    .select('id, title, author_primary, cover_url, shelf_entries(shelf, my_rating)')
    .eq('author_primary', book.author_primary)
    .neq('id', id)
    .limit(24)

  type OtherBook = {
    id: string
    title: string
    author_primary: string
    cover_url: string | null
    shelf_entries: { shelf: string; my_rating: number | null }[]
  }

  return (
    <main className="p-6 md:p-8 max-w-5xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-gray-400 mb-6 animate-fade-in">
        <Link href="/dashboard" className="hover:text-gray-700 transition-colors">Dashboard</Link>
        <span>/</span>
        <span className="text-gray-600 truncate max-w-xs">{book.title}</span>
      </nav>

      {/* Main layout: cover + metadata */}
      <div className="flex flex-col sm:flex-row gap-8 mb-10 animate-fade-in">
        {/* Cover */}
        <div className="w-full sm:w-44 shrink-0">
          <CoverImage
            src={book.cover_url}
            title={book.title}
            className="w-full aspect-[2/3] rounded-lg shadow-md"
            sizes="(max-width: 640px) 100vw, 176px"
          />
        </div>

        {/* Metadata */}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-serif text-gray-900 leading-snug mb-1">{book.title}</h1>

          {/* Author — clickable */}
          <Link
            href={`/authors/${encodeURIComponent(book.author_primary)}`}
            className="text-base font-medium hover:underline transition-colors"
            style={{ color: '#2C5F2D' }}
          >
            {book.author_primary}
          </Link>
          {book.additional_authors?.length > 0 && (
            <span className="text-sm text-gray-400 ml-2">
              with {book.additional_authors.map((a: string) => (
                <Link key={a} href={`/authors/${encodeURIComponent(a)}`}
                  className="hover:underline ml-1" style={{ color: '#2C5F2D' }}>
                  {a}
                </Link>
              ))}
            </span>
          )}

          {/* Shelf badges + add to shelf */}
          <div className="flex flex-wrap gap-1.5 mt-3 items-center">
            {shelves.map((s) => {
              const b = getShelfBadge(s)
              return b ? (
                <span key={s} className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: b.bg, color: b.text }}>
                  {b.label}
                </span>
              ) : null
            })}
            <AddToShelfButton bookId={id} currentShelves={shelves} />
          </div>

          {/* Genre tags */}
          {genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {genres.map((g) => (
                <span key={g} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                  {GENRE_LABELS[g] ?? g}
                </span>
              ))}
            </div>
          )}

          {/* Rating */}
          {rating && rating > 0 && (
            <div className="mt-3">
              <StarRating rating={rating} />
            </div>
          )}

          {/* Book metadata */}
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm max-w-sm">
            {book.year_published && (
              <>
                <dt className="text-gray-400">Published</dt>
                <dd className="text-gray-700">{book.year_published}</dd>
              </>
            )}
            {book.pages && (
              <>
                <dt className="text-gray-400">Pages</dt>
                <dd className="text-gray-700">{book.pages.toLocaleString()}</dd>
              </>
            )}
            {book.publisher && (
              <>
                <dt className="text-gray-400">Publisher</dt>
                <dd className="text-gray-700">{book.publisher}</dd>
              </>
            )}
            {dateRead && (
              <>
                <dt className="text-gray-400">Date read</dt>
                <dd className="text-gray-700">
                  {new Date(dateRead).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  {readCount > 1 && <span className="text-gray-400 ml-1">· {readCount}×</span>}
                </dd>
              </>
            )}
          </dl>
        </div>
      </div>

      {/* Review */}
      {review && (
        <section className="mb-10">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">My review</h2>
          <blockquote className="text-gray-700 leading-relaxed whitespace-pre-line border-l-2 pl-4"
            style={{ borderColor: '#2C5F2D' }}>
            {review}
          </blockquote>
        </section>
      )}

      {/* If you liked this — recommendations from unread shelf */}
      {shelves.includes('read') && (
        <SimilarBooksWidget bookId={id} />
      )}

      {/* Other books by this author */}
      {otherBooks && otherBooks.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              More by{' '}
              <Link href={`/authors/${encodeURIComponent(book.author_primary)}`}
                className="hover:underline normal-case font-semibold text-gray-800">
                {book.author_primary}
              </Link>
            </h2>
            <Link href={`/authors/${encodeURIComponent(book.author_primary)}`}
              className="text-xs hover:underline" style={{ color: '#2C5F2D' }}>
              See all →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {(otherBooks as OtherBook[]).map((b) => (
              <BookCard
                key={b.id}
                id={b.id}
                title={b.title}
                author={b.author_primary}
                coverUrl={b.cover_url}
                rating={b.shelf_entries[0]?.my_rating ?? null}
                year={null}
                shelves={b.shelf_entries.map((e) => e.shelf)}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
