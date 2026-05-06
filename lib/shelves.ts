import type { ShelfType } from '@/lib/csv/types'

const SHELF_BADGES: Record<ShelfType, { label: string; bg: string; text: string }> = {
  'read':              { label: 'Read',              bg: '#dcfce7', text: '#15803d' },
  'to-read':           { label: 'To Read',           bg: '#eff6ff', text: '#2563eb' },
  'currently-reading': { label: 'Currently Reading', bg: '#fef3c7', text: '#b45309' },
  'owned':             { label: 'Owned',             bg: '#f3e8ff', text: '#7c3aed' },
}

export function getShelfBadge(shelf: string) {
  return SHELF_BADGES[shelf as ShelfType] ?? null
}

// Re-export the map for cases that need it (e.g. iterating all shelves).
export { SHELF_BADGES }
