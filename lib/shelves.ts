import type { ShelfType } from '@/lib/csv/types'

const SHELF_BADGES: Record<ShelfType, { label: string; bg: string; text: string }> = {
  'read':              { label: 'Read',              bg: '#d4e8d4', text: '#3a4b3c' },
  'to-read':           { label: 'To Read',           bg: '#d6e3ff', text: '#384763' },
  'currently-reading': { label: 'Reading',           bg: '#ffdbd0', text: '#762c12' },
  'owned':             { label: 'Owned',             bg: '#e3e2df', text: '#44474d' },
}

export function getShelfBadge(shelf: string) {
  return SHELF_BADGES[shelf as ShelfType] ?? null
}

// Re-export the map for cases that need it (e.g. iterating all shelves).
export { SHELF_BADGES }
