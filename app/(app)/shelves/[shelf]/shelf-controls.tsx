'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { GENRES, GENRE_LABELS } from '@/lib/genres'

const SORT_OPTIONS = [
  { value: 'date_added', label: 'Date added' },
  { value: 'title', label: 'Title' },
  { value: 'author', label: 'Author' },
  { value: 'rating', label: 'Rating' },
  { value: 'year', label: 'Year published' },
]

export default function ShelfControls({
  sort,
  order,
  q,
  genre,
}: {
  sort: string
  order: string
  q: string
  genre: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set(key, value)
      params.delete('page') // reset to page 1 on any filter change
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`)
      })
    },
    [router, pathname, searchParams]
  )

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set('q', value)
    } else {
      params.delete('q')
    }
    params.delete('page')
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  function toggleOrder() {
    update('order', order === 'asc' ? 'desc' : 'asc')
  }

  function handleGenreChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString())
    if (e.target.value) {
      params.set('genre', e.target.value)
    } else {
      params.delete('genre')
    }
    params.delete('page')
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <input
        type="search"
        placeholder="Search title or author…"
        defaultValue={q}
        onChange={handleSearch}
        className="flex-1 min-w-48 px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-700"
      />
      <select
        value={genre}
        onChange={handleGenreChange}
        className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-700"
      >
        <option value="">All genres</option>
        {GENRES.map((g) => (
          <option key={g} value={g}>{GENRE_LABELS[g]}</option>
        ))}
      </select>
      <select
        value={sort}
        onChange={(e) => update('sort', e.target.value)}
        className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-700"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <button
        onClick={toggleOrder}
        className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50 transition-colors"
        title={order === 'asc' ? 'Ascending' : 'Descending'}
      >
        {order === 'asc' ? '↑ Asc' : '↓ Desc'}
      </button>
    </div>
  )
}
