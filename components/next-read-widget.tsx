'use client'

import { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { getNextReadRecommendations } from '@/app/actions/recommendations'
import LibraryLinks from '@/components/library-links'
import type { RecsOutput, EnrichedRec } from '@/app/actions/recommendations'

function RecCard({ rec }: { rec: EnrichedRec }) {
  const [imgErr, setImgErr] = useState(false)
  const { book, reasoning } = rec

  return (
    <div className="flex gap-4">
      <Link href={`/books/${book.id}`} className="shrink-0">
        <div className="relative w-14 h-[84px] rounded overflow-hidden bg-gray-100 shadow-sm hover:shadow-md transition-shadow">
          {book.cover_url && !imgErr ? (
            <Image src={book.cover_url} alt={book.title} fill sizes="56px"
              className="object-cover" onError={() => setImgErr(true)} />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-1"
              style={{ backgroundColor: '#E8E0D5' }}>
              <span className="text-xs text-gray-500 text-center line-clamp-3 leading-tight">{book.title}</span>
            </div>
          )}
        </div>
      </Link>

      <div className="flex-1 min-w-0">
        <Link href={`/books/${book.id}`}
          className="font-semibold text-sm text-gray-900 hover:underline leading-snug line-clamp-2">
          {book.title}
        </Link>
        <p className="text-xs text-gray-400 mt-0.5">{book.author_primary}</p>
        <p className="text-xs text-gray-600 mt-2 leading-relaxed">{reasoning}</p>
        <LibraryLinks title={book.title} author={book.author_primary} isbn13={book.isbn13} />
      </div>
    </div>
  )
}

export default function NextReadWidget() {
  const [recs, setRecs] = useState<RecsOutput | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    getNextReadRecommendations(false).then(setRecs)
  }, [])

  function handleRefresh() {
    startTransition(async () => {
      const fresh = await getNextReadRecommendations(true)
      setRecs(fresh)
    })
  }

  const loading = recs === null
  const hasRecs = (recs?.recommendations.length ?? 0) > 0

  return (
    <section className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Your next read</h2>
        <button
          onClick={handleRefresh}
          disabled={isPending || loading}
          className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-40"
        >
          {isPending ? 'Thinking…' : 'Refresh ↻'}
        </button>
      </div>

      {loading && (
        <div className="flex flex-col gap-5">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex gap-4 animate-pulse">
              <div className="w-14 h-[84px] rounded bg-gray-100 shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3 bg-gray-100 rounded w-3/4" />
                <div className="h-2 bg-gray-100 rounded w-1/2" />
                <div className="h-2 bg-gray-100 rounded w-full" />
                <div className="h-2 bg-gray-100 rounded w-5/6" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && recs?.error && (
        <p className="text-sm text-gray-400">{recs.error}</p>
      )}

      {!loading && hasRecs && (
        <div className="flex flex-col gap-5">
          {recs!.recommendations.map(rec => (
            <RecCard key={rec.book_id} rec={rec} />
          ))}
        </div>
      )}

      {!loading && !recs?.error && !hasRecs && (
        <p className="text-sm text-gray-400">
          No recommendations yet.{' '}
          <button onClick={handleRefresh} disabled={isPending} className="underline hover:no-underline">
            Generate now
          </button>
        </p>
      )}

      {!loading && recs?.fromCache && (
        <p className="text-xs text-gray-300 mt-5">Cached · refreshes weekly</p>
      )}
    </section>
  )
}
