'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'
import { GENRE_LABELS } from '@/lib/genres'
import type { Genre } from '@/lib/genres'

const anthropic = new Anthropic()
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

// ── Types ─────────────────────────────────────────────────────────────────────

type ReadEntry = {
  my_rating: number | null
  my_review: string | null
  date_read: string
  books: {
    id: string
    title: string
    author_primary: string
    book_genres: { genre: string }[]
  } | null
}

type CandidateBook = {
  id: string
  title: string
  author_primary: string
  cover_url: string | null
  isbn13: string | null
  shelf: string
  genres: string[]
}

type RecResult = {
  book_id: string
  reasoning: string
}

export type EnrichedRec = {
  book_id: string
  reasoning: string
  book: {
    id: string
    title: string
    author_primary: string
    cover_url: string | null
    isbn13: string | null
  }
}

export type RecsOutput = {
  recommendations: EnrichedRec[]
  fromCache: boolean
  error?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getReadingHistory(supabase: Awaited<ReturnType<typeof createClient>>): Promise<ReadEntry[]> {
  const { data } = await supabase
    .from('shelf_entries')
    .select('my_rating, my_review, date_read, books(id, title, author_primary, book_genres(genre))')
    .eq('shelf', 'read')
    .not('date_read', 'is', null)
    .order('date_read', { ascending: false })
    .limit(20)
  return (data ?? []) as unknown as ReadEntry[]
}

async function buildCandidatePool(
  supabase: Awaited<ReturnType<typeof createClient>>,
  history: ReadEntry[]
): Promise<CandidateBook[]> {
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

  const readIds = new Set<string>()
  const highRatedGenres = new Set<string>()
  const highRatedAuthors = new Set<string>()

  for (const e of history) {
    if (!e.books) continue
    readIds.add(e.books.id)
    const rating = e.my_rating ?? 0
    if (rating >= 4) {
      highRatedAuthors.add(e.books.author_primary)
      const dateRead = new Date(e.date_read + 'T00:00:00Z')
      if (dateRead >= oneYearAgo) {
        for (const g of e.books.book_genres) {
          highRatedGenres.add(g.genre)
        }
      }
    }
  }

  type RawEntry = {
    book_id: string
    books: { id: string; title: string; author_primary: string; isbn13: string | null; cover_url: string | null } | null
  }

  const [{ data: ownedData }, { data: tbrData }] = await Promise.all([
    supabase
      .from('shelf_entries')
      .select('book_id, books(id, title, author_primary, isbn13, cover_url)')
      .eq('shelf', 'owned'),
    supabase
      .from('shelf_entries')
      .select('book_id, books(id, title, author_primary, isbn13, cover_url)')
      .eq('shelf', 'to-read')
      .order('date_added', { ascending: false })
      .limit(400),
  ])

  const owned = ((ownedData ?? []) as unknown as RawEntry[]).filter(e => e.books && !readIds.has(e.books.id))
  const tbr = ((tbrData ?? []) as unknown as RawEntry[]).filter(e => e.books && !readIds.has(e.books.id))
  const ownedIds = new Set(owned.map(e => e.book_id))

  // Deduplicate: owned first so (owned) label is preserved
  const seen = new Set<string>()
  const all: (RawEntry & { isOwned: boolean })[] = []
  for (const e of owned) {
    if (!seen.has(e.book_id)) { seen.add(e.book_id); all.push({ ...e, isOwned: true }) }
  }
  for (const e of tbr) {
    if (!seen.has(e.book_id) && !ownedIds.has(e.book_id)) { seen.add(e.book_id); all.push({ ...e, isOwned: false }) }
  }

  // Fetch genres for all candidates
  const allIds = all.map(e => e.book_id)
  const { data: genreRows } = await supabase
    .from('book_genres')
    .select('book_id, genre')
    .in('book_id', allIds)

  const genresByBook = new Map<string, string[]>()
  for (const r of genreRows ?? []) {
    const list = genresByBook.get(r.book_id) ?? []
    list.push(r.genre)
    genresByBook.set(r.book_id, list)
  }

  // Filter by preference signals
  const hasPreferences = highRatedGenres.size > 0 || highRatedAuthors.size > 0
  const filtered: CandidateBook[] = []

  for (const e of all) {
    if (!e.books || filtered.length >= 80) break
    const genres = genresByBook.get(e.book_id) ?? []
    const include = !hasPreferences
      || e.isOwned
      || highRatedAuthors.has(e.books.author_primary)
      || genres.some(g => highRatedGenres.has(g))

    if (include) {
      filtered.push({
        id: e.books.id,
        title: e.books.title,
        author_primary: e.books.author_primary,
        cover_url: e.books.cover_url,
        isbn13: e.books.isbn13,
        shelf: e.isOwned ? 'owned' : 'to-read',
        genres,
      })
    }
  }

  // Fallback: if filtering removed too many, include any candidates up to 80
  if (filtered.length < 5 && all.length > 0) {
    return all.slice(0, 80).flatMap(e =>
      e.books ? [{
        id: e.books.id,
        title: e.books.title,
        author_primary: e.books.author_primary,
        cover_url: e.books.cover_url,
        isbn13: e.books.isbn13,
        shelf: e.isOwned ? 'owned' : 'to-read',
        genres: genresByBook.get(e.book_id) ?? [],
      }] : []
    )
  }

  return filtered
}

function genreLabel(g: string) {
  return GENRE_LABELS[g as Genre] ?? g
}

function buildNextReadPrompt(history: ReadEntry[], candidates: CandidateBook[]): string {
  const historyText = history.flatMap((e, i) => {
    if (!e.books) return []
    const genres = e.books.book_genres.map(g => genreLabel(g.genre)).join(', ')
    const review = e.my_review ? ' — "' + e.my_review.replace(/\n/g, ' ').substring(0, 120) + '…"' : ''
    return [`${i + 1}. "${e.books.title}" by ${e.books.author_primary} — ${e.my_rating ?? '?'}/5${genres ? ` [${genres}]` : ''}${review}`]
  }).join('\n')

  const candidateText = candidates.map((c, i) => {
    const genres = c.genres.map(genreLabel).join(', ')
    return `${i + 1}. [ID:${c.id}] "${c.title}" by ${c.author_primary}${genres ? ` [${genres}]` : ''}${c.shelf === 'owned' ? ' (owned)' : ''}`
  }).join('\n')

  return `You are recommending what I should read next from books I already own or want to read.

My recent reading (newest first):
${historyText}

My candidate pool (unread books I own or want to read):
${candidateText}

Recommend exactly 3 books from the candidate pool. For each, write 2 sentences explaining why it fits my reading patterns — reference specific books I've read or themes I gravitate toward. Do not recommend books outside the candidate pool.

Output ONLY valid JSON, no prose:
[{"book_id":"<exact ID>","reasoning":"<2 sentences>"}]`
}

function buildSimilarPrompt(sourceTitle: string, sourceAuthor: string, sourceGenres: string[], history: ReadEntry[], candidates: CandidateBook[]): string {
  const historyText = history.slice(0, 10).flatMap((e, i) => {
    if (!e.books) return []
    const genres = e.books.book_genres.map(g => genreLabel(g.genre)).join(', ')
    return [`${i + 1}. "${e.books.title}" by ${e.books.author_primary} — ${e.my_rating ?? '?'}/5${genres ? ` [${genres}]` : ''}`]
  }).join('\n')

  const candidateText = candidates.map((c, i) => {
    const genres = c.genres.map(genreLabel).join(', ')
    return `${i + 1}. [ID:${c.id}] "${c.title}" by ${c.author_primary}${genres ? ` [${genres}]` : ''}${c.shelf === 'owned' ? ' (owned)' : ''}`
  }).join('\n')

  const genresStr = sourceGenres.map(genreLabel).join(', ')

  return `You are recommending books similar to one I loved, chosen strictly from books I already own or want to read.

Source book: "${sourceTitle}" by ${sourceAuthor}${genresStr ? ` [${genresStr}]` : ''}

My recent reading (for context):
${historyText}

My candidate pool (unread books I own or want to read):
${candidateText}

Recommend exactly 3 books from the candidate pool most similar to "${sourceTitle}". For each, write 2 sentences on why it's similar. Do not recommend books outside the candidate pool.

Output ONLY valid JSON, no prose:
[{"book_id":"<exact ID>","reasoning":"<2 sentences>"}]`
}

async function callLLM(prompt: string): Promise<RecResult[]> {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: 'You are a personal book recommendation assistant. Always output valid JSON only — no markdown, no prose.',
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('LLM did not return a JSON array')
  return JSON.parse(jsonMatch[0]) as RecResult[]
}

async function enrichRecs(supabase: Awaited<ReturnType<typeof createClient>>, recs: RecResult[]): Promise<EnrichedRec[]> {
  const ids = recs.map(r => r.book_id)
  const { data: books } = await supabase
    .from('books')
    .select('id, title, author_primary, cover_url, isbn13')
    .in('id', ids)

  const bookMap = new Map((books ?? []).map(b => [b.id, b]))
  return recs.flatMap(r => {
    const book = bookMap.get(r.book_id)
    return book ? [{ ...r, book }] : []
  })
}

// ── Public actions ────────────────────────────────────────────────────────────

export async function getNextReadRecommendations(forceRefresh = false): Promise<RecsOutput> {
  const supabase = await createClient()
  const history = await getReadingHistory(supabase)

  if (history.length === 0) {
    return { recommendations: [], fromCache: false, error: 'No reading history found — mark some books as read first.' }
  }

  const historyIds = history.map(e => e.books?.id).filter(Boolean).sort()
  const contextHash = createHash('sha256').update(historyIds.join(',')).digest('hex').slice(0, 16)

  if (!forceRefresh) {
    const { data: cached } = await supabase
      .from('recommendations_cache')
      .select('result_json, created_at')
      .eq('recommendation_type', 'next_read')
      .eq('context_hash', contextHash)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (cached && Date.now() - new Date(cached.created_at).getTime() < CACHE_TTL_MS) {
      const enriched = await enrichRecs(supabase, cached.result_json as RecResult[])
      return { recommendations: enriched, fromCache: true }
    }
  }

  const candidates = await buildCandidatePool(supabase, history)
  if (candidates.length === 0) {
    return { recommendations: [], fromCache: false, error: 'No unread books found in your TBR or owned shelf.' }
  }

  try {
    const prompt = buildNextReadPrompt(history, candidates)
    const recs = await callLLM(prompt)
    const candidateIds = new Set(candidates.map(c => c.id))
    const valid = recs.filter(r => candidateIds.has(r.book_id)).slice(0, 3)

    if (valid.length === 0) {
      return { recommendations: [], fromCache: false, error: 'Could not generate valid recommendations — try refreshing.' }
    }

    await supabase.from('recommendations_cache').insert({
      context_hash: contextHash,
      recommendation_type: 'next_read',
      source_book_id: null,
      result_json: valid,
    })

    return { recommendations: await enrichRecs(supabase, valid), fromCache: false }
  } catch (e) {
    return { recommendations: [], fromCache: false, error: String(e) }
  }
}

export async function getSimilarBookRecommendations(bookId: string, forceRefresh = false): Promise<RecsOutput> {
  const supabase = await createClient()

  if (!forceRefresh) {
    const { data: cached } = await supabase
      .from('recommendations_cache')
      .select('result_json, created_at')
      .eq('recommendation_type', 'similar_to_book')
      .eq('source_book_id', bookId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (cached && Date.now() - new Date(cached.created_at).getTime() < CACHE_TTL_MS) {
      const enriched = await enrichRecs(supabase, cached.result_json as RecResult[])
      return { recommendations: enriched, fromCache: true }
    }
  }

  const [{ data: sourceBook }, history] = await Promise.all([
    supabase
      .from('books')
      .select('id, title, author_primary, book_genres(genre)')
      .eq('id', bookId)
      .single(),
    getReadingHistory(supabase),
  ])

  if (!sourceBook) return { recommendations: [], fromCache: false, error: 'Book not found.' }

  const candidates = await buildCandidatePool(supabase, history)
  if (candidates.length === 0) {
    return { recommendations: [], fromCache: false, error: 'No unread books found in your TBR or owned shelf.' }
  }

  // Remove the source book itself from candidates
  const filteredCandidates = candidates.filter(c => c.id !== bookId)
  const sourceGenres = (sourceBook.book_genres as { genre: string }[]).map(g => g.genre)

  try {
    const prompt = buildSimilarPrompt(sourceBook.title, sourceBook.author_primary, sourceGenres, history, filteredCandidates)
    const recs = await callLLM(prompt)
    const candidateIds = new Set(filteredCandidates.map(c => c.id))
    const valid = recs.filter(r => candidateIds.has(r.book_id)).slice(0, 3)

    if (valid.length === 0) {
      return { recommendations: [], fromCache: false, error: 'Could not generate valid recommendations — try refreshing.' }
    }

    await supabase.from('recommendations_cache').insert({
      context_hash: `similar_${bookId}`,
      recommendation_type: 'similar_to_book',
      source_book_id: bookId,
      result_json: valid,
    })

    return { recommendations: await enrichRecs(supabase, valid), fromCache: false }
  } catch (e) {
    return { recommendations: [], fromCache: false, error: String(e) }
  }
}
