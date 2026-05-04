'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

type PaginationProps = {
  page: number
  totalPages: number
  totalCount: number
  pageSize: number
}

export default function Pagination({ page, totalPages, totalCount, pageSize }: PaginationProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function go(newPage: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(newPage))
    router.push(`${pathname}?${params.toString()}`)
  }

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalCount)

  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-100">
      <p className="text-sm text-gray-400">
        {from.toLocaleString()}–{to.toLocaleString()} of {totalCount.toLocaleString()}
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 text-sm rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        <span className="px-3 py-1.5 text-sm text-gray-500">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => go(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1.5 text-sm rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  )
}
