'use client'

import { useState, useRef } from 'react'
import { parseGoodreadsCSV } from '@/lib/csv/parse'
import { importBookBatch, type BatchResult } from '@/app/actions/import-books'
import type { ParsedBook } from '@/lib/csv/types'

const BATCH_SIZE = 50

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

type Status = 'idle' | 'parsing' | 'ready' | 'importing' | 'done'

export default function ImportCSV() {
  const [ownedShelfName, setOwnedShelfName] = useState('owned')
  const [parsedBooks, setParsedBooks] = useState<ParsedBook[] | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [summary, setSummary] = useState<BatchResult & { total: number }>({
    added: 0,
    updated: 0,
    failed: [],
    total: 0,
  })
  const [parseError, setParseError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setStatus('parsing')
    setParseError(null)
    try {
      const text = await file.text()
      const books = parseGoodreadsCSV(text)
      if (books.length === 0) throw new Error('No rows found in CSV.')
      setParsedBooks(books)
      setStatus('ready')
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse CSV.')
      setStatus('idle')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleImport() {
    if (!parsedBooks) return
    setStatus('importing')
    const total = parsedBooks.length
    setProgress({ current: 0, total })
    const accumulated: BatchResult = { added: 0, updated: 0, failed: [] }
    let processed = 0
    for (const batch of chunk(parsedBooks, BATCH_SIZE)) {
      try {
        const result = await importBookBatch(batch, ownedShelfName)
        accumulated.added += result.added
        accumulated.updated += result.updated
        accumulated.failed.push(...result.failed)
      } catch {
        accumulated.failed.push(...batch.map((b) => ({ title: b.title, reason: 'Unexpected error' })))
      }
      processed += batch.length
      setProgress({ current: processed, total })
    }
    setSummary({ ...accumulated, total })
    setStatus('done')
  }

  function reset() {
    setParsedBooks(null)
    setStatus('idle')
    setParseError(null)
    setProgress({ current: 0, total: 0 })
    setSummary({ added: 0, updated: 0, failed: [], total: 0 })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const progressPercent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Physical ownership shelf name</label>
        <input type="text" value={ownedShelfName} onChange={(e) => setOwnedShelfName(e.target.value)}
          placeholder="owned" disabled={status === 'importing'}
          className="w-48 px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-700 bg-white disabled:opacity-50" />
        <p className="text-xs text-gray-400 mt-1">The custom Goodreads shelf name for physical ownership. Default is "owned".</p>
      </div>

      {(status === 'idle' || status === 'parsing') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Goodreads CSV file</label>
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} disabled={status === 'parsing'}
            className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 file:cursor-pointer disabled:opacity-50" />
          {status === 'parsing' && <p className="text-xs text-gray-400 mt-2">Parsing…</p>}
          {parseError && <p className="text-xs text-red-600 mt-2">{parseError}</p>}
        </div>
      )}

      {status === 'ready' && parsedBooks && (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">Found <span className="font-semibold text-gray-900">{parsedBooks.length.toLocaleString()}</span> books. Ready to import.</p>
          <div className="flex gap-2">
            <button onClick={handleImport} className="px-4 py-2 text-sm font-medium text-white rounded-md" style={{ backgroundColor: '#2C5F2D' }}>Start import</button>
            <button onClick={reset} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      )}

      {status === 'importing' && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Importing…</span>
            <span>{progress.current.toLocaleString()} / {progress.total.toLocaleString()} ({progressPercent}%)</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div className="h-2 rounded-full transition-all duration-300" style={{ width: `${progressPercent}%`, backgroundColor: '#2C5F2D' }} />
          </div>
        </div>
      )}

      {status === 'done' && (
        <div className="space-y-3">
          <div className="rounded-lg bg-green-50 border border-green-100 p-4">
            <p className="text-sm font-semibold text-green-800 mb-2">Import complete</p>
            <ul className="text-sm text-green-700 space-y-0.5">
              <li>✓ {summary.added.toLocaleString()} added</li>
              <li>↻ {summary.updated.toLocaleString()} updated</li>
              {summary.failed.length > 0 && <li className="text-red-600">✗ {summary.failed.length} failed</li>}
            </ul>
          </div>
          <button onClick={reset} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200">Import another file</button>
        </div>
      )}
    </div>
  )
}
