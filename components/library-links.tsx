'use client'

type Props = {
  title: string
  author: string
  isbn13: string | null
}

export default function LibraryLinks({ title, author, isbn13 }: Props) {
  // ISBN is the most precise search key; fall back to "Title Author" for broader queries.
  const keywordQ = encodeURIComponent(isbn13 ?? `${title} ${author}`)
  const titleQ = encodeURIComponent(title)

  return (
    <div className="flex gap-1.5 mt-2 flex-wrap">
      {/* WorldCat — aggregates all US library catalogs including SLCL */}
      <a
        href={isbn13 ? `https://www.worldcat.org/search?q=isbn:${isbn13}` : `https://www.worldcat.org/search?q=${keywordQ}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs px-2 py-0.5 rounded border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
      >
        WorldCat
      </a>
      {/* Amazon product search */}
      <a
        href={`https://www.amazon.com/s?k=${keywordQ}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs px-2 py-0.5 rounded border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
      >
        Amazon
      </a>
      {/* Open Library — ISBN search is exact; title search is fuzzy */}
      <a
        href={isbn13 ? `https://openlibrary.org/search?isbn=${isbn13}` : `https://openlibrary.org/search?title=${titleQ}&author=${encodeURIComponent(author)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs px-2 py-0.5 rounded border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
      >
        Open Library
      </a>
    </div>
  )
}
