'use client'

import { useState } from 'react'
import Link from 'next/link'

type BookCardProps = {
  id: string
  title: string
  author: string
  coverUrl: string | null
  rating: number | null
  year: number | null
  shelves?: string[]
}

const SHELF_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  'read':              { label: 'Read',     bg: '#dcfce7', text: '#15803d' },
  'to-read':           { label: 'To Read',  bg: '#eff6ff', text: '#2563eb' },
  'currently-reading': { label: 'Reading',  bg: '#fef3c7', text: '#b45309' },
  'owned':             { label: 'Owned',    bg: '#f3e8ff', text: '#7c3aed' },
}

function CoverImg({ src, title }: { src: string | null; title: string }) {
  const [err, setErr] = useState(false)
  if (!src || err) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center" style={{ backgroundColor: '#E8E0D5' }}>
        <p className="text-xs font-medium text-gray-600 line-clamp-3 leading-tight">{title}</p>
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={title} onError={() => setErr(true)} loading="lazy" className="w-full h-full object-cover" />
  )
}

export default function BookCard({ id, title, author, coverUrl, rating, shelves }: BookCardProps) {
  return (
    <div className="group">
      {/* Cover + title → book detail */}
      <Link href={`/books/${id}`} className="block">
        <div className="relative aspect-[2/3] rounded-md overflow-hidden bg-gray-100 shadow-sm group-hover:shadow-md transition-shadow">
          <CoverImg src={coverUrl} title={title} />
          {rating !== null && rating > 0 && (
            <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded-sm">
              {'★'.repeat(rating)}
            </div>
          )}
        </div>
        <p className="mt-1.5 text-xs font-medium text-gray-800 line-clamp-2 leading-snug px-0.5">{title}</p>
      </Link>

      {/* Author → author page (separate link, avoids nested <a>) */}
      <Link
        href={`/authors/${encodeURIComponent(author)}`}
        className="block px-0.5 mt-0.5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs text-gray-400 hover:text-gray-600 hover:underline line-clamp-1 transition-colors">{author}</p>
      </Link>

      {/* Shelf badges (shown on author page / book detail "other books") */}
      {shelves && shelves.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1 px-0.5">
          {shelves.map((s) => {
            const badge = SHELF_BADGE[s]
            if (!badge) return null
            return (
              <span key={s} className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: badge.bg, color: badge.text }}>
                {badge.label}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
