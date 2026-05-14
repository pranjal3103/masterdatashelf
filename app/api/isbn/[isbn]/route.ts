import { NextResponse } from 'next/server'

export type ISBNResult = {
  title: string
  author: string
  year: number | null
  isbn13: string | null
  isbn10: string | null
  coverUrl: string | null
  publisher: string | null
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim()
}

function extractField(html: string, label: string): string | null {
  const re = new RegExp(`<strong>${label}:<\\/strong>\\s*([\\s\\S]*?)(?=<strong>|<\\/div>|<br\\s*/?>|$)`, 'i')
  const m = html.match(re)
  return m ? stripTags(m[1]).trim() || null : null
}

async function tryOpenLibrary(isbn: string): Promise<ISBNResult | null> {
  try {
    const res = await fetch(
      `https://openlibrary.org/search.json?isbn=${isbn}&limit=1&fields=key,title,author_name,first_publish_year,isbn,cover_i,publisher`,
      { next: { revalidate: 0 } }
    )
    if (!res.ok) return null
    const data: { docs: { title?: string; author_name?: string[]; first_publish_year?: number; isbn?: string[]; cover_i?: number; publisher?: string[] }[] } = await res.json()
    if (!data.docs.length) return null
    const doc = data.docs[0]
    const isbn13 = doc.isbn?.find((i) => i.length === 13) ?? null
    const isbn10 = doc.isbn?.find((i) => i.length === 10) ?? null
    const coverUrl = doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
      : isbn13 ? `https://covers.openlibrary.org/b/isbn/${isbn13}-M.jpg` : null
    return {
      title: doc.title ?? 'Unknown title',
      author: doc.author_name?.[0] ?? 'Unknown author',
      year: doc.first_publish_year ?? null,
      isbn13,
      isbn10,
      coverUrl,
      publisher: doc.publisher?.[0] ?? null,
    }
  } catch {
    return null
  }
}

async function tryGoogleBooks(isbn: string): Promise<ISBNResult | null> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1`,
      { next: { revalidate: 0 } }
    )
    if (!res.ok) return null
    const data: { items?: { volumeInfo: { title?: string; authors?: string[]; publisher?: string; publishedDate?: string; industryIdentifiers?: { type: string; identifier: string }[]; imageLinks?: { thumbnail?: string } } }[] } = await res.json()
    if (!data.items?.length) return null
    const vol = data.items[0].volumeInfo
    const isbn13 = vol.industryIdentifiers?.find((i) => i.type === 'ISBN_13')?.identifier ?? null
    const isbn10 = vol.industryIdentifiers?.find((i) => i.type === 'ISBN_10')?.identifier ?? null
    return {
      title: vol.title ?? 'Unknown title',
      author: vol.authors?.[0] ?? 'Unknown author',
      year: vol.publishedDate ? parseInt(vol.publishedDate.slice(0, 4)) : null,
      isbn13: isbn13 ?? (isbn.length === 13 ? isbn : null),
      isbn10: isbn10 ?? (isbn.length === 10 ? isbn : null),
      coverUrl: vol.imageLinks?.thumbnail?.replace('http:', 'https:') ?? null,
      publisher: vol.publisher ?? null,
    }
  } catch {
    return null
  }
}

async function tryISBNSearch(isbn: string): Promise<ISBNResult | null> {
  try {
    const res = await fetch(`https://isbnsearch.org/isbn/${isbn}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; book-lookup/1.0)' },
      next: { revalidate: 0 },
    })
    if (!res.ok) return null
    const html = await res.text()

    const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)
    const title = titleMatch ? stripTags(titleMatch[1]).trim() : null
    if (!title) return null

    const author = extractField(html, 'Author')
    const publisher = extractField(html, 'Publisher')
    const publishedRaw = extractField(html, 'Published')
    const year = publishedRaw ? parseInt(publishedRaw.slice(0, 4)) : null

    return {
      title,
      author: author ?? 'Unknown author',
      year: isNaN(year ?? NaN) ? null : year,
      isbn13: isbn.length === 13 ? isbn : null,
      isbn10: isbn.length === 10 ? isbn : null,
      coverUrl: `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`,
      publisher: publisher ?? null,
    }
  } catch {
    return null
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ isbn: string }> }
) {
  const { isbn } = await params
  const clean = isbn.replace(/[^0-9X]/gi, '')
  if (!clean) return NextResponse.json({ error: 'Invalid ISBN' }, { status: 400 })

  const result =
    (await tryOpenLibrary(clean)) ??
    (await tryGoogleBooks(clean)) ??
    (await tryISBNSearch(clean))

  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(result)
}
