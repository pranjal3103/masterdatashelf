'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { GENRES } from '@/lib/genres'

const anthropic = new Anthropic()

const GENRE_LIST = GENRES.join(', ')

const SYSTEM_PROMPT = `You are tagging books with genres. For each book, return 1-3 genre tags from this exact list (do not invent new tags):
${GENRE_LIST}

Input: a JSON array of {id, title, author, year_published}.
Output: a JSON array of {id, genres: [string]}. Output ONLY the JSON array, no other text.

Be specific. "history" for nonfiction history; "historical-fiction" for novels set in the past. Books about India/South Asia get the "india-south-asia" tag in addition to their primary genre.`

type TagResult = { id: string; genres: string[] }

async function fetchAllIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  column: string
): Promise<string[]> {
  const PAGE = 1000
  const ids: string[] = []
  for (let page = 0; ; page++) {
    const { data } = await supabase
      .from(table)
      .select(column)
      .range(page * PAGE, (page + 1) * PAGE - 1)
    if (!data?.length) break
    ids.push(...(data as unknown as Record<string, string>[]).map((r) => r[column]))
    if (data.length < PAGE) break
  }
  return ids
}

export async function getGenreStats(): Promise<{ total: number; tagged: number; untaggedIds: string[] }> {
  const supabase = await createClient()

  const [allIds, taggedRaw] = await Promise.all([
    fetchAllIds(supabase, 'books', 'id'),
    fetchAllIds(supabase, 'book_genres', 'book_id'),
  ])

  const taggedIds = new Set(taggedRaw)
  const untaggedIds = allIds.filter((id) => !taggedIds.has(id))

  return { total: allIds.length, tagged: taggedIds.size, untaggedIds }
}

export async function tagBookBatch(
  bookIds: string[]
): Promise<{ tagged: number; stored: number; error?: string }> {
  if (!bookIds.length) return { tagged: 0, stored: 0 }

  const supabase = await createClient()

  const { data: books, error: fetchError } = await supabase
    .from('books')
    .select('id, title, author_primary, year_published')
    .in('id', bookIds)

  if (fetchError) return { tagged: 0, stored: 0, error: fetchError.message }
  if (!books?.length) return { tagged: 0, stored: 0 }

  const input = books.map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author_primary,
    year_published: b.year_published,
  }))

  let tagResults: TagResult[]
  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: JSON.stringify(input) }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error(`No JSON array in response: ${text.slice(0, 300)}`)
    tagResults = JSON.parse(jsonMatch[0])
  } catch (e) {
    return { tagged: 0, stored: 0, error: String(e) }
  }

  const validGenres = new Set<string>(GENRES)
  const rows = tagResults.flatMap((result) => {
    const genres = (result.genres ?? []).filter((g) => validGenres.has(g))
    return genres.map((genre) => ({ book_id: result.id, genre, confidence: 1.0 }))
  })

  let stored = 0
  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from('book_genres')
      .upsert(rows, { onConflict: 'book_id,genre' })
    if (upsertError) return { tagged: 0, stored: 0, error: upsertError.message }
    stored = tagResults.length
  }

  return { tagged: tagResults.length, stored }
}
