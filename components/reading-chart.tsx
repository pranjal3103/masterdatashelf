'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'

export type DrillBook = {
  id: string
  title: string
  author: string
  coverUrl: string | null
  rating: number | null
}

export type YearStat = {
  year: number
  count: number
  totalPages: number
  avgRating: number | null
  topGenres: { label: string; count: number }[]
  books: DrillBook[]
}

const ACCENT = '#2C5F2D'
const ACCENT_LIGHT = '#4a8c4c'

function CoverImg({ src, title }: { src: string | null; title: string }) {
  const [err, setErr] = useState(false)
  if (!src || err) {
    return (
      <div className="w-full h-full flex items-center justify-center p-1 text-center"
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
      sizes="(max-width: 640px) 25vw, 10vw"
      className="object-cover"
      onError={() => setErr(true)}
    />
  )
}

function CustomTooltip({ active, payload }: {
  active?: boolean
  payload?: { value: number; payload: YearStat }[]
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-md text-sm">
      <p className="font-semibold text-gray-900">{d.year}</p>
      <p className="text-gray-500">{d.count} books</p>
    </div>
  )
}

export default function ReadingChart({ yearStats }: { yearStats: YearStat[] }) {
  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  const drilldown = selectedYear !== null
    ? yearStats.find((y) => y.year === selectedYear) ?? null
    : null

  function handleBarClick(data: YearStat) {
    setSelectedYear((prev) => prev === data.year ? null : data.year)
  }

  return (
    <div>
      {/* Bar chart */}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={yearStats} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} style={{ cursor: 'pointer' }}
            onClick={(data) => handleBarClick(data as unknown as YearStat)}>
            {yearStats.map((entry) => (
              <Cell
                key={entry.year}
                fill={entry.year === selectedYear ? ACCENT : ACCENT_LIGHT}
                opacity={selectedYear !== null && entry.year !== selectedYear ? 0.4 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <p className="text-xs text-gray-400 mt-1 mb-6">Click a bar to see that year&apos;s books</p>

      {/* Drilldown panel */}
      {drilldown && (
        <div className="border-t border-gray-100 pt-6">
          {/* Year header */}
          <div className="flex flex-wrap items-baseline gap-4 mb-4">
            <h3 className="text-lg font-serif text-gray-900">{drilldown.year}</h3>
            <div className="flex flex-wrap gap-3 text-sm text-gray-500">
              <span><span className="font-medium text-gray-800">{drilldown.count}</span> books</span>
              {drilldown.totalPages > 0 && (
                <span><span className="font-medium text-gray-800">{drilldown.totalPages.toLocaleString()}</span> pages</span>
              )}
              {drilldown.avgRating !== null && (
                <span>★ <span className="font-medium text-gray-800">{drilldown.avgRating}</span> avg</span>
              )}
            </div>
            {drilldown.topGenres.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {drilldown.topGenres.map((g) => (
                  <span key={g.label}
                    className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                    {g.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Book covers grid */}
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
            {drilldown.books.map((book) => (
              <Link key={book.id} href={`/books/${book.id}`} title={`${book.title} — ${book.author}`}>
                <div className="relative aspect-[2/3] rounded-md overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-gray-100">
                  <CoverImg src={book.coverUrl} title={book.title} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
