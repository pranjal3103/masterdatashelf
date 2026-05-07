'use client'

import { useState, useEffect } from 'react'
import { getGenreStats, tagBookBatch } from '@/app/actions/tag-genres'

const BATCH_SIZE = 20

export default function GenreTagger() {
  const [untaggedIds, setUntaggedIds] = useState<string[] | null>(null)
  const [taggedCount, setTaggedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [processed, setProcessed] = useState(0)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    getGenreStats()
      .then(({ total, tagged, untaggedIds }) => {
        setTotalCount(total)
        setTaggedCount(tagged)
        setUntaggedIds(untaggedIds)
      })
      .catch(() => setUntaggedIds([]))
      .finally(() => setLoading(false))
  }, [])

  async function handleStart() {
    if (!untaggedIds?.length) return
    setRunning(true)
    setDone(false)
    setError(null)
    setProcessed(0)

    for (let i = 0; i < untaggedIds.length; i += BATCH_SIZE) {
      const batch = untaggedIds.slice(i, i + BATCH_SIZE)
      const end = Math.min(i + BATCH_SIZE, untaggedIds.length)
      setStatusMsg(`Tagging books ${i + 1}–${end} of ${untaggedIds.length}…`)

      const result = await tagBookBatch(batch)
      if (result.error) {
        setError(`Failed on batch ${Math.floor(i / BATCH_SIZE) + 1}: ${result.error}`)
        setRunning(false)
        return
      }
      setProcessed(i + batch.length)
      setTaggedCount((c) => c + result.stored)
    }

    setRunning(false)
    setStatusMsg(null)
    setDone(true)
    setUntaggedIds([])
  }

  if (loading) {
    return <p className="text-sm text-gray-400">Checking genre coverage…</p>
  }

  const untaggedCount = untaggedIds?.length ?? 0
  const pct = untaggedIds?.length
    ? Math.round((processed / untaggedIds.length) * 100)
    : 0

  return (
    <div className="space-y-4">
      {/* Coverage summary */}
      <p className="text-sm text-gray-600">
        {taggedCount.toLocaleString()} / {totalCount.toLocaleString()} books tagged
        {untaggedCount > 0 && !running && !done && (
          <span className="text-gray-400"> — {untaggedCount.toLocaleString()} remaining</span>
        )}
      </p>

      {untaggedCount > 0 && !running && !done && (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">
            Estimated cost: ~${(untaggedCount * 0.00075).toFixed(2)} (Claude Haiku)
          </p>
          <button
            onClick={handleStart}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#04152e' }}
          >
            Tag {untaggedCount.toLocaleString()} books with Claude Haiku
          </button>
        </div>
      )}

      {running && (
        <div className="space-y-2 max-w-md">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{statusMsg}</span>
            <span>{pct}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{ backgroundColor: '#04152e', width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 max-w-md">
          <p className="font-medium">Tagging stopped</p>
          <p className="text-xs mt-0.5 font-mono">{error}</p>
          <p className="text-xs mt-1 text-red-500">The books processed so far are saved. You can re-run to continue.</p>
        </div>
      )}

      {done && (
        <p className="text-sm font-medium" style={{ color: '#04152e' }}>
          ✓ All done — {taggedCount.toLocaleString()} books now have genre tags.
        </p>
      )}
    </div>
  )
}
