import Papa from 'papaparse'
import type { ParsedBook } from './types'

// Goodreads wraps ISBNs like ="0123456789" — strip the formula wrapper.
function stripIsbn(raw: string): string | null {
  if (!raw) return null
  const stripped = raw.replace(/^="?([^"]*)"?$/, '$1').trim()
  return stripped || null
}

// Goodreads stores reviews with HTML like <br /> — convert to plain text.
function cleanReviewHtml(raw: string): string | null {
  if (!raw?.trim()) return null
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim() || null
}

// Handles YYYY/MM/DD and DD-MM-YYYY (both appear in real exports).
function parseDate(raw: string): string | null {
  if (!raw?.trim()) return null
  // YYYY/MM/DD
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(raw)) return raw.replace(/\//g, '-')
  // DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split('-')
    return `${y}-${m}-${d}`
  }
  // YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  return null
}

function parseIntOrNull(raw: string): number | null {
  const n = parseInt(raw, 10)
  return isNaN(n) || n === 0 ? null : n
}

export function parseGoodreadsCSV(csvText: string): ParsedBook[] {
  // Strip BOM if present
  const text = csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText

  const { data, errors } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  })

  if (errors.length > 0 && data.length === 0) {
    throw new Error(`CSV parse failed: ${errors[0].message}`)
  }

  return data.map((row): ParsedBook => {
    const isbn13 = stripIsbn(row['ISBN13'] ?? '')

    return {
      goodreads_id: row['Book Id']?.trim() || null,
      isbn13,
      isbn10: stripIsbn(row['ISBN'] ?? ''),
      title: row['Title']?.trim() ?? '(untitled)',
      author_primary: row['Author']?.trim() ?? '',
      additional_authors: row['Additional Authors']
        ? row['Additional Authors'].split(',').map((a) => a.trim()).filter(Boolean)
        : [],
      publisher: row['Publisher']?.trim() || null,
      pages: parseIntOrNull(row['Number of Pages'] ?? ''),
      year_published: parseIntOrNull(row['Year Published'] ?? ''),
      original_publication_year: parseIntOrNull(row['Original Publication Year'] ?? ''),
      // Construct URL deterministically — no HTTP request needed at import time.
      cover_url: isbn13 ? `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg` : null,
      exclusive_shelf: row['Exclusive Shelf']?.trim() ?? '',
      bookshelves: row['Bookshelves']
        ? row['Bookshelves'].split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      date_read: parseDate(row['Date Read'] ?? ''),
      date_added: parseDate(row['Date Added'] ?? ''),
      my_rating: parseIntOrNull(row['My Rating'] ?? ''),  // 0 → null via parseIntOrNull
      my_review: cleanReviewHtml(row['My Review'] ?? ''),
      read_count: parseInt(row['Read Count'] ?? '0', 10) || 0,
    }
  })
}
