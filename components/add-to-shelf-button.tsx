'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addShelfEntryToBook } from '@/app/actions/add-book'
import type { ShelfType } from '@/lib/csv/types'

const ALL_SHELVES: { value: ShelfType; label: string }[] = [
  { value: 'owned', label: 'Owned' },
  { value: 'to-read', label: 'To Read' },
  { value: 'read', label: 'Read' },
  { value: 'currently-reading', label: 'Currently Reading' },
]

export default function AddToShelfButton({
  bookId,
  currentShelves,
}: {
  bookId: string
  currentShelves: string[]
}) {
  const available = ALL_SHELVES.filter((s) => !currentShelves.includes(s.value))
  const [open, setOpen] = useState(false)
  const [added, setAdded] = useState<ShelfType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  if (available.length === 0) return null

  async function handleAdd(shelf: ShelfType) {
    setError(null)
    startTransition(async () => {
      const result = await addShelfEntryToBook(bookId, shelf)
      if (result.success) {
        setAdded(shelf)
        setOpen(false)
        router.refresh()
      } else {
        setError(result.error ?? 'Failed to add to shelf.')
      }
    })
  }

  if (added) {
    const label = ALL_SHELVES.find((s) => s.value === added)?.label
    return (
      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: '#d1fae5', color: '#2C5F2D' }}>
        ✓ Added to {label}
      </span>
    )
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className="text-xs px-2 py-0.5 rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-green-700 hover:text-green-700 transition-colors disabled:opacity-50"
      >
        + shelf
      </button>

      {open && (
        <div className="absolute left-0 top-7 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]">
          {available.map((s) => (
            <button
              key={s.value}
              onClick={() => handleAdd(s.value)}
              disabled={isPending}
              className="w-full text-left text-xs px-3 py-1.5 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {error && <p className="absolute left-0 top-9 text-xs text-red-500 whitespace-nowrap">{error}</p>}
    </div>
  )
}
