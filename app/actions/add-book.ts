'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidateTag } from 'next/cache'
import type { ShelfType } from '@/lib/csv/types'

export type AddBookInput = {
  title: string
  author_primary: string
  isbn13: string | null
  isbn10: string | null
  year_published: number | null
  cover_url: string | null
  publisher: string | null
}

async function insertBook(supabase: Awaited<ReturnType<typeof createClient>>, book: AddBookInput) {
  return supabase
    .from('books')
    .insert({
      title: book.title,
      author_primary: book.author_primary,
      isbn13: book.isbn13,
      isbn10: book.isbn10,
      year_published: book.year_published,
      cover_url: book.cover_url,
      publisher: book.publisher,
    })
    .select('id')
    .single()
}

export async function addBookToShelf(
  book: AddBookInput,
  shelf: ShelfType
): Promise<{ success: boolean; bookId?: string; error?: string }> {
  const supabase = await createClient()

  let bookId: string | undefined

  // 1. Check by ISBN13 (most reliable).
  if (book.isbn13) {
    const { data: existing } = await supabase
      .from('books').select('id').eq('isbn13', book.isbn13).maybeSingle()
    if (existing) bookId = existing.id
  }

  // 2. Fallback: title + author match (catches different-edition duplicates).
  if (!bookId) {
    const { data: existing } = await supabase
      .from('books')
      .select('id')
      .ilike('title', book.title.trim())
      .ilike('author_primary', book.author_primary.trim())
      .maybeSingle()
    if (existing) bookId = existing.id
  }

  // 3. Still not found — insert a new book record.
  if (!bookId) {
    const { data, error } = await insertBook(supabase, book)
    if (error) return { success: false, error: error.message }
    bookId = data!.id
  }

  // Upsert the shelf entry — safe to call multiple times.
  const { error: shelfError } = await supabase
    .from('shelf_entries')
    .upsert({ book_id: bookId, shelf, date_added: new Date().toISOString().split('T')[0] }, { onConflict: 'book_id,shelf' })

  if (shelfError) return { success: false, error: shelfError.message }
  revalidateTag('books', {})
  return { success: true, bookId }
}

// Add an existing book (by ID) to a new shelf without creating a duplicate book record.
export async function addShelfEntryToBook(
  bookId: string,
  shelf: ShelfType
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('shelf_entries')
    .upsert({ book_id: bookId, shelf, date_added: new Date().toISOString().split('T')[0] }, { onConflict: 'book_id,shelf' })
  if (error) return { success: false, error: error.message }
  revalidateTag('books', {})
  return { success: true }
}
