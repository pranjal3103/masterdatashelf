'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

type StripBook = {
  id: string
  title: string
  author: string
  coverUrl: string | null
  rating: number | null
}

function CoverImg({ src, title }: { src: string | null; title: string }) {
  const [err, setErr] = useState(false)
  if (!src || err) {
    return (
      <div className="w-full h-full flex items-center justify-center p-2 text-center"
        style={{ backgroundColor: '#E8E0D5' }}>
        <p className="text-xs text-gray-500 line-clamp-3 leading-tight">{title}</p>
      </div>
    )
  }
  return (
    <Image
      src={src}
      alt={title}
      fill
      sizes="112px"
      className="object-cover"
      onError={() => setErr(true)}
    />
  )
}

export default function BookStrip({ books }: { books: StripBook[] }) {
  if (!books.length) return <p className="text-sm text-gray-400">Nothing here yet.</p>
  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {books.map((book) => (
        <div key={book.id} className="w-28 shrink-0">
          <Link href={`/books/${book.id}`} className="block">
            <div className="relative aspect-[2/3] rounded-md overflow-hidden bg-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <CoverImg src={book.coverUrl} title={book.title} />
            </div>
            <p className="mt-1 text-xs font-medium text-gray-800 line-clamp-2 leading-snug">{book.title}</p>
          </Link>
          <Link href={`/authors/${encodeURIComponent(book.author)}`}
            className="text-xs text-gray-400 hover:text-gray-600 line-clamp-1 transition-colors">
            {book.author}
          </Link>
        </div>
      ))}
    </div>
  )
}
