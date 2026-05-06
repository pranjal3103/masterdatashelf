'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidateTag } from 'next/cache'
import type { ParsedBook, ShelfType } from '@/lib/csv/types'

export interface BatchResult {
  added: number
  updated: number
  failed: { title: string; reason: string }[]
}

// Figures out which DB shelves a book belongs to.
// The exclusive_shelf from the CSV is always the primary shelf.
// If bookshelves[] also contains the owned shelf name, add 'owned' as a second entry.
function resolveShelves(
  exclusiveShelf: string,
  bookshelves: string[],
  ownedShelfName: string
): ShelfType[] {
  const result: ShelfType[] = []
  const norm = exclusiveShelf.toLowerCase().trim()
  const ownedNorm = ownedShelfName.toLowerCase().trim()

  if (norm === 'read') result.push('read')
  else if (norm === 'to-read') result.push('to-read')
  else if (norm === 'currently-reading') result.push('currently-reading')
  else if (ownedNorm && norm === ownedNorm) result.push('owned')
  // Unknown shelf — skip silently (shouldn't happen with a real Goodreads CSV)

  if (
    ownedNorm &&
    bookshelves.some((s) => s.toLowerCase().trim() === ownedNorm) &&
    !result.includes('owned')
  ) {
    result.push('owned')
  }

  return result
}

export async function importBookBatch(
  books: ParsedBook[],
  ownedShelfName: string
): Promise<BatchResult> {
  const supabase = await createClient()

  // ── Step 1: find which goodreads_ids already exist ───────────────────────
  const goodreadsIds = books
    .map((b) => b.goodreads_id)
    .filter((id): id is string => id !== null)

  let existingSet = new Set<string>()
  if (goodreadsIds.length > 0) {
    const { data } = await supabase
      .from('books')
      .select('goodreads_id')
      .in('goodreads_id', goodreadsIds)
    existingSet = new Set((data ?? []).map((b) => b.goodreads_id as string))
  }

  const addedCount = books.filter(
    (b) => b.goodreads_id && !existingSet.has(b.goodreads_id)
  ).length
  const updatedCount = books.filter(
    (b) => b.goodreads_id && existingSet.has(b.goodreads_id!)
  ).length

  // ── Step 2: bulk upsert books ─────────────────────────────────────────────
  const bookRows = books.map((b) => ({
    goodreads_id: b.goodreads_id,
    isbn13: b.isbn13,
    isbn10: b.isbn10,
    title: b.title,
    author_primary: b.author_primary,
    additional_authors: b.additional_authors,
    publisher: b.publisher,
    pages: b.pages,
    year_published: b.year_published,
    original_publication_year: b.original_publication_year,
    cover_url: b.cover_url,
  }))

  const { data: upsertedBooks, error: booksError } = await supabase
    .from('books')
    .upsert(bookRows, { onConflict: 'goodreads_id' })
    .select('id, goodreads_id')

  if (booksError) {
    return {
      added: 0,
      updated: 0,
      failed: books.map((b) => ({ title: b.title, reason: booksError.message })),
    }
  }

  // ── Step 3: build book_id lookup ──────────────────────────────────────────
  const idByGoodreadsId = new Map(
    (upsertedBooks ?? [])
      .filter((b) => b.goodreads_id)
      .map((b) => [b.goodreads_id as string, b.id as string])
  )

  // ── Step 4: bulk upsert shelf entries ─────────────────────────────────────
  const shelfRows: {
    book_id: string
    shelf: ShelfType
    date_read: string | null
    date_added: string | null
    my_rating: number | null
    my_review: string | null
    read_count: number
  }[] = []

  const failed: BatchResult['failed'] = []

  for (const book of books) {
    const bookId = book.goodreads_id
      ? idByGoodreadsId.get(book.goodreads_id)
      : undefined

    if (!bookId) {
      failed.push({ title: book.title, reason: 'Could not resolve book ID after upsert' })
      continue
    }

    const shelves = resolveShelves(
      book.exclusive_shelf,
      book.bookshelves,
      ownedShelfName
    )

    if (shelves.length === 0) {
      failed.push({ title: book.title, reason: `Unknown shelf: "${book.exclusive_shelf}"` })
      continue
    }

    for (const shelf of shelves) {
      shelfRows.push({
        book_id: bookId,
        shelf,
        date_read: shelf === 'read' ? book.date_read : null,
        date_added: book.date_added,
        my_rating: book.my_rating,
        my_review: book.my_review,
        read_count: book.read_count,
      })
    }
  }

  if (shelfRows.length > 0) {
    const { error: shelfError } = await supabase
      .from('shelf_entries')
      .upsert(shelfRows, { onConflict: 'book_id,shelf' })

    if (shelfError) {
      return {
        added: addedCount,
        updated: updatedCount,
        failed: [
          ...failed,
          ...books.map((b) => ({ title: b.title, reason: 'Shelf error: ' + shelfError.message })),
        ],
      }
    }
  }

  revalidateTag('books', {})
  return { added: addedCount, updated: updatedCount, failed }
}
