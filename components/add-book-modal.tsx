'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { addBookToShelf, getShelfISBN13s, type AddBookInput } from '@/app/actions/add-book'
import type { ISBNResult } from '@/app/api/isbn/[isbn]/route'
import type { ShelfType } from '@/lib/csv/types'

// ── Open Library types (search tab only) ─────────────────────────────────────

type OLDoc = {
  key: string
  title: string
  author_name?: string[]
  first_publish_year?: number
  isbn?: string[]
  cover_i?: number
  publisher?: string[]
}

// ── Candidate ─────────────────────────────────────────────────────────────────

type Candidate = {
  olKey: string
  title: string
  author: string
  year: number | null
  isbn13: string | null
  isbn10: string | null
  coverUrl: string | null
  publisher: string | null
}

const SHELF_OPTIONS: { value: ShelfType; label: string }[] = [
  { value: 'owned', label: 'Owned' },
  { value: 'to-read', label: 'To Read' },
  { value: 'read', label: 'Read' },
  { value: 'currently-reading', label: 'Currently Reading' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractISBNs(isbns: string[] = []): { isbn13: string | null; isbn10: string | null } {
  const isbn13 = isbns.find((i) => i.length === 13) ?? null
  const isbn10 = isbns.find((i) => i.length === 10) ?? null
  return { isbn13, isbn10 }
}

function docToCandidate(doc: OLDoc): Candidate {
  const { isbn13, isbn10 } = extractISBNs(doc.isbn)
  const coverUrl = doc.cover_i
    ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
    : isbn13
    ? `https://covers.openlibrary.org/b/isbn/${isbn13}-M.jpg`
    : null

  return {
    olKey: doc.key,
    title: doc.title,
    author: doc.author_name?.[0] ?? 'Unknown author',
    year: doc.first_publish_year ?? null,
    isbn13,
    isbn10,
    coverUrl,
    publisher: doc.publisher?.[0] ?? null,
  }
}

async function searchOpenLibrary(title: string, author: string): Promise<Candidate[]> {
  const params = new URLSearchParams({ limit: '5', fields: 'key,title,author_name,first_publish_year,isbn,cover_i,publisher' })
  if (title) params.set('title', title)
  if (author) params.set('author', author)
  if (!title && !author) return []

  const res = await fetch(`https://openlibrary.org/search.json?${params}`)
  if (!res.ok) throw new Error('Open Library search failed')
  const data: { docs: OLDoc[] } = await res.json()
  return data.docs.slice(0, 5).map(docToCandidate)
}

// Lookup via server-side API route: OL → Google Books → isbnsearch.org
async function lookupISBN(isbn: string): Promise<ISBNResult | null> {
  const clean = isbn.replace(/[^0-9X]/gi, '')
  if (!clean) return null
  try {
    const res = await fetch(`/api/isbn/${clean}`)
    if (!res.ok) return null
    return res.json() as Promise<ISBNResult>
  } catch {
    return null
  }
}

// ── CoverImage ────────────────────────────────────────────────────────────────

function CoverImage({ src, title }: { src: string | null; title: string }) {
  const [err, setErr] = useState(false)
  if (!src || err) {
    return (
      <div className="w-12 h-16 rounded bg-gray-100 flex items-center justify-center shrink-0">
        <span className="text-gray-300 text-xs text-center px-1 leading-tight">{title.slice(0, 20)}</span>
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={title} onError={() => setErr(true)}
      className="w-12 h-16 object-cover rounded shadow-sm shrink-0" />
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'search' | 'bulk'

type BulkResult = {
  isbn: string
  title: string
  status: 'added' | 'failed' | 'not-found' | 'exists'
}

type ManualState = {
  open: boolean
  title: string
  author: string
  adding: boolean
  added: boolean
  error: string | null
}

// ── Main modal component ──────────────────────────────────────────────────────

export default function AddBookModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('search')

  // Search tab state
  const [searchTitle, setSearchTitle] = useState('')
  const [searchAuthor, setSearchAuthor] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<Candidate[] | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)

  const [shelfForResult, setShelfForResult] = useState<Record<string, ShelfType>>({})
  const [addingKey, setAddingKey] = useState<string | null>(null)
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set())
  const [addError, setAddError] = useState<string | null>(null)

  // Bulk tab state
  const [bulkText, setBulkText] = useState('')
  const [bulkShelf, setBulkShelf] = useState<ShelfType>('owned')
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkDone, setBulkDone] = useState<BulkResult[]>([])
  const [manualEntries, setManualEntries] = useState<Record<string, ManualState>>({})

  const router = useRouter()
  const titleRef = useRef<HTMLInputElement>(null)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!searchTitle.trim() && !searchAuthor.trim()) return
    setSearching(true)
    setSearchError(null)
    setResults(null)
    try {
      const candidates = await searchOpenLibrary(searchTitle.trim(), searchAuthor.trim())
      setResults(candidates)
      if (candidates.length === 0) setSearchError('No results found. Try a different title or author.')
    } catch {
      setSearchError('Search failed. Check your connection and try again.')
    } finally {
      setSearching(false)
    }
  }

  async function handleAdd(candidate: Candidate) {
    const shelf = shelfForResult[candidate.olKey] ?? 'owned'
    setAddingKey(candidate.olKey)
    setAddError(null)
    const book: AddBookInput = {
      title: candidate.title,
      author_primary: candidate.author,
      isbn13: candidate.isbn13,
      isbn10: candidate.isbn10,
      year_published: candidate.year,
      cover_url: candidate.coverUrl,
      publisher: candidate.publisher,
    }
    const result = await addBookToShelf(book, shelf)
    setAddingKey(null)
    if (result.success) {
      setAddedKeys((prev) => new Set([...prev, candidate.olKey]))
      setTimeout(() => {
        router.push(`/shelves/${shelf}`)
        onClose()
      }, 800)
    } else {
      setAddError(result.error ?? 'Failed to add book — please try again.')
    }
  }

  async function handleBulkAdd() {
    const isbns = bulkText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!isbns.length) return

    setBulkRunning(true)
    setBulkDone([])
    setManualEntries({})
    const results: BulkResult[] = []

    const existingISBN13s = new Set(await getShelfISBN13s(bulkShelf))

    for (const isbn of isbns) {
      const clean = isbn.replace(/[^0-9X]/gi, '')
      if (existingISBN13s.has(clean)) {
        results.push({ isbn, title: '—', status: 'exists' })
        setBulkDone([...results])
        continue
      }
      try {
        const candidate = await lookupISBN(isbn)
        if (!candidate) {
          results.push({ isbn, title: '—', status: 'not-found' })
          setBulkDone([...results])
          continue
        }
        const book: AddBookInput = {
          title: candidate.title,
          author_primary: candidate.author,
          isbn13: candidate.isbn13,
          isbn10: candidate.isbn10,
          year_published: candidate.year,
          cover_url: candidate.coverUrl,
          publisher: candidate.publisher,
        }
        const res = await addBookToShelf(book, bulkShelf)
        results.push({ isbn, title: candidate.title, status: res.success ? 'added' : 'failed' })
      } catch {
        results.push({ isbn, title: '—', status: 'failed' })
      }
      setBulkDone([...results])
    }
    setBulkRunning(false)
    router.refresh()
  }

  function openManualEntry(isbn: string) {
    setManualEntries((prev) => ({
      ...prev,
      [isbn]: { open: true, title: '', author: '', adding: false, added: false, error: null },
    }))
  }

  async function submitManualEntry(isbn: string) {
    const entry = manualEntries[isbn]
    if (!entry?.title.trim()) return

    setManualEntries((prev) => ({ ...prev, [isbn]: { ...prev[isbn], adding: true, error: null } }))
    const clean = isbn.replace(/[^0-9X]/gi, '')
    const book: AddBookInput = {
      title: entry.title.trim(),
      author_primary: entry.author.trim() || 'Unknown author',
      isbn13: clean.length === 13 ? clean : null,
      isbn10: clean.length === 10 ? clean : null,
      year_published: null,
      cover_url: clean.length === 13 ? `https://covers.openlibrary.org/b/isbn/${clean}-M.jpg` : null,
      publisher: null,
    }
    try {
      const res = await addBookToShelf(book, bulkShelf)
      if (res.success) {
        setManualEntries((prev) => ({ ...prev, [isbn]: { ...prev[isbn], adding: false, added: true } }))
        setBulkDone((prev) =>
          prev.map((r) => r.isbn === isbn ? { ...r, title: entry.title.trim(), status: 'added' } : r)
        )
        router.refresh()
      } else {
        setManualEntries((prev) => ({
          ...prev,
          [isbn]: { ...prev[isbn], adding: false, error: res.error ?? 'Failed to add' },
        }))
      }
    } catch (err) {
      setManualEntries((prev) => ({
        ...prev,
        [isbn]: { ...prev[isbn], adding: false, error: err instanceof Error ? err.message : 'Unexpected error — try again' },
      }))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Add a book</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors text-xl leading-none">×</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3">
          {(['search', 'bulk'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                tab === t ? 'text-white font-medium' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
              }`}
              style={tab === t ? { backgroundColor: '#04152e' } : {}}
            >
              {t === 'search' ? 'Search' : 'Bulk ISBN'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">

          {/* ── Search tab ── */}
          {tab === 'search' && (
            <div className="space-y-4">
              <form onSubmit={handleSearch} className="space-y-3">
                <input
                  ref={titleRef}
                  type="text"
                  placeholder="Title (required)"
                  value={searchTitle}
                  onChange={(e) => setSearchTitle(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-700"
                />
                <input
                  type="text"
                  placeholder="Author (optional)"
                  value={searchAuthor}
                  onChange={(e) => setSearchAuthor(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-700"
                />
                <button
                  type="submit"
                  disabled={searching || !searchTitle.trim()}
                  className="w-full py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
                  style={{ backgroundColor: '#04152e' }}
                >
                  {searching ? 'Searching…' : 'Search Open Library'}
                </button>
              </form>

              {searchError && <p className="text-sm text-red-500">{searchError}</p>}
              {addError && <p className="text-sm text-red-500">{addError}</p>}

              {results && results.length > 0 && (
                <ul className="space-y-3">
                  {results.map((candidate) => {
                    const shelf = shelfForResult[candidate.olKey] ?? 'owned'
                    const added = addedKeys.has(candidate.olKey)
                    const adding = addingKey === candidate.olKey
                    return (
                      <li key={candidate.olKey} className="flex gap-3 items-start p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                        <CoverImage src={candidate.coverUrl} title={candidate.title} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 leading-snug line-clamp-2">{candidate.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{candidate.author}{candidate.year ? ` · ${candidate.year}` : ''}</p>
                          {!added && (
                            <div className="flex items-center gap-2 mt-2">
                              <select
                                value={shelf}
                                onChange={(e) => setShelfForResult((prev) => ({ ...prev, [candidate.olKey]: e.target.value as ShelfType }))}
                                className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-green-700"
                              >
                                {SHELF_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleAdd(candidate)}
                                disabled={adding}
                                className="text-xs font-medium px-3 py-1 rounded-md text-white transition-colors disabled:opacity-50"
                                style={{ backgroundColor: '#04152e' }}
                              >
                                {adding ? 'Adding…' : 'Add'}
                              </button>
                            </div>
                          )}
                          {added && (
                            <p className="text-xs font-medium mt-2" style={{ color: '#04152e' }}>
                              ✓ Added to {SHELF_OPTIONS.find(o => o.value === (shelfForResult[candidate.olKey] ?? 'owned'))?.label}
                            </p>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {/* ── Bulk ISBN tab ── */}
          {tab === 'bulk' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Paste ISBNs — one per line. Works with ISBN-10 or ISBN-13.</p>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={'9780141439518\n9780743273565\n...'}
                rows={6}
                disabled={bulkRunning}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-green-700 font-mono resize-none disabled:opacity-50"
              />
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600">Add to:</label>
                <select
                  value={bulkShelf}
                  onChange={(e) => setBulkShelf(e.target.value as ShelfType)}
                  disabled={bulkRunning}
                  className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-700"
                >
                  {SHELF_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <button
                  onClick={handleBulkAdd}
                  disabled={bulkRunning || !bulkText.trim()}
                  className="ml-auto px-4 py-1.5 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
                  style={{ backgroundColor: '#04152e' }}
                >
                  {bulkRunning ? 'Adding…' : 'Add all'}
                </button>
              </div>

              {bulkDone.length > 0 && (
                <ul className="space-y-2 text-xs max-h-64 overflow-y-auto">
                  {bulkDone.map((r) => (
                    <li key={r.isbn}>
                      <div className={
                        r.status === 'added' ? 'text-green-700' :
                        r.status === 'exists' ? 'text-gray-400' :
                        r.status === 'not-found' ? 'text-amber-600' :
                        'text-red-500'
                      }>
                        {r.status === 'added' ? '✓' : r.status === 'exists' ? '–' : r.status === 'not-found' ? '?' : '✗'}{' '}
                        {r.isbn}
                        {r.status === 'exists' ? ' — already in shelf' :
                         r.title !== '—' ? ` — ${r.title}` :
                         r.status === 'not-found' ? ' — not found' : ' — error'}
                      </div>

                      {r.status === 'not-found' && !manualEntries[r.isbn]?.added && (
                        <div className="mt-1 ml-3">
                          {!manualEntries[r.isbn]?.open ? (
                            <button
                              onClick={() => openManualEntry(r.isbn)}
                              className="text-xs underline text-gray-400 hover:text-gray-700"
                            >
                              Enter details manually
                            </button>
                          ) : (
                            <div className="flex flex-col gap-1.5 mt-1">
                              <input
                                type="text"
                                placeholder="Title (required)"
                                value={manualEntries[r.isbn].title}
                                onChange={(e) =>
                                  setManualEntries((prev) => ({
                                    ...prev,
                                    [r.isbn]: { ...prev[r.isbn], title: e.target.value },
                                  }))
                                }
                                className="px-2 py-1 border border-gray-200 rounded bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400 w-full"
                              />
                              <input
                                type="text"
                                placeholder="Author (optional)"
                                value={manualEntries[r.isbn].author}
                                onChange={(e) =>
                                  setManualEntries((prev) => ({
                                    ...prev,
                                    [r.isbn]: { ...prev[r.isbn], author: e.target.value },
                                  }))
                                }
                                className="px-2 py-1 border border-gray-200 rounded bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400 w-full"
                              />
                              {manualEntries[r.isbn].error && (
                                <p className="text-red-500">{manualEntries[r.isbn].error}</p>
                              )}
                              <button
                                onClick={() => submitManualEntry(r.isbn)}
                                disabled={manualEntries[r.isbn].adding || !manualEntries[r.isbn].title.trim()}
                                className="self-start px-2 py-1 font-medium text-white rounded disabled:opacity-50"
                                style={{ backgroundColor: '#04152e' }}
                              >
                                {manualEntries[r.isbn].adding ? 'Adding…' : 'Add'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {r.status === 'not-found' && manualEntries[r.isbn]?.added && (
                        <div className="mt-0.5 ml-3 text-green-700">✓ Added manually</div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
