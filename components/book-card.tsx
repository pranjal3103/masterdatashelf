'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { getShelfBadge } from '@/lib/shelves'
import { GENRE_LABELS } from '@/lib/genres'
import type { Genre } from '@/lib/genres'

type BookCardProps = {
  id: string
  title: string
  author: string
  coverUrl: string | null
  rating: number | null
  year: number | null
  shelves?: string[]
  genres?: string[]
}

function CoverImg({ src, title }: { src: string | null; title: string }) {
  const [err, setErr] = useState(false)
  if (!src || err) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center" style={{ backgroundColor: '#e3e2df' }}>
        <p className="text-xs font-medium line-clamp-3 leading-tight" style={{ color: '#44474d' }}>{title}</p>
      </div>
    )
  }
  return (
    <Image
      src={src}
      alt={title}
      fill
      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
      className="object-cover"
      onError={() => setErr(true)}
    />
  )
}

export default function BookCard({ id, title, author, coverUrl, rating, shelves, genres }: BookCardProps) {
  return (
    <motion.div className="group" whileHover={{ y: -4, transition: { duration: 0.15, ease: 'easeOut' } }}>
      {/* Cover + title → book detail */}
      <Link href={`/books/${id}`} className="block">
        <div className="relative aspect-[2/3] rounded-lg overflow-hidden shadow-sm group-hover:shadow-md transition-shadow" style={{ backgroundColor: '#e3e2df' }}>
          <CoverImg src={coverUrl} title={title} />
          {rating !== null && rating > 0 && (
            <div className="absolute bottom-1.5 right-1.5 text-xs px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: 'rgba(4,21,46,0.75)', color: '#ffffff' }}>
              {'★'.repeat(rating)}
            </div>
          )}
        </div>
        <p className="mt-1.5 text-xs font-medium line-clamp-2 leading-snug px-0.5" style={{ color: '#1b1c1a' }}>{title}</p>
      </Link>

      {/* Author → author page (separate link, avoids nested <a>) */}
      <Link
        href={`/authors/${encodeURIComponent(author)}`}
        className="block px-0.5 mt-0.5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs line-clamp-1 transition-colors hover:underline" style={{ color: '#75777e' }}>{author}</p>
      </Link>

      {/* Shelf badges (shown on author page / book detail "other books") */}
      {shelves && shelves.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1 px-0.5">
          {shelves.map((s) => {
            const badge = getShelfBadge(s)
            if (!badge) return null
            return (
              <span key={s} className="text-xs px-1.5 py-0.5 rounded font-semibold tracking-wide"
                style={{ backgroundColor: badge.bg, color: badge.text }}>
                {badge.label}
              </span>
            )
          })}
        </div>
      )}

      {/* Genre pills — show up to 2 */}
      {genres && genres.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1 px-0.5">
          {genres.slice(0, 2).map((g) => (
            <span key={g} className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: '#efeeea', color: '#44474d' }}>
              {GENRE_LABELS[g as Genre] ?? g}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  )
}
