export type ShelfType = 'read' | 'to-read' | 'currently-reading' | 'owned'

export interface ParsedBook {
  goodreads_id: string | null
  isbn13: string | null
  isbn10: string | null
  title: string
  author_primary: string
  additional_authors: string[]
  publisher: string | null
  pages: number | null
  year_published: number | null
  original_publication_year: number | null
  cover_url: string | null
  // Raw shelf data — resolved to ShelfType[] in the server action
  exclusive_shelf: string
  bookshelves: string[]
  date_read: string | null   // ISO YYYY-MM-DD
  date_added: string | null  // ISO YYYY-MM-DD
  my_rating: number | null   // null means unrated (was 0 in CSV)
  my_review: string | null
  read_count: number
}
