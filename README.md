# Masterdatashelf

A personal web app for managing and analyzing my reading library. Data comes from Goodreads CSV exports. Provides analytics, author-graph navigation, and AI-powered "next read" recommendations that Goodreads itself doesn't offer.

**Live:** deployed on Vercel, auto-deploys from `main`.

---

## Features

- **Import** — upload a Goodreads CSV; 2,610 books parsed, cover images fetched from Open Library, upsert logic handles re-imports cleanly
- **Shelf views** — Browse Read, To Read, Currently Reading, and Owned shelves; grid of book covers with sort, search, genre filter, and pagination
- **Book detail** — cover, metadata, my rating and review, shelf badges, genre tags; "other books by this author" grid
- **Author pages** — all books by an author across all shelves, with stats (total read, avg rating)
- **Manual add** — search Open Library by title/author, pick from top 5 results; or bulk-add by pasting ISBNs
- **Genre tagging** — background job sends books to Claude Haiku in batches of 20 against a fixed 31-genre taxonomy; cached forever
- **Analytics dashboard** — books-per-year bar chart with drilldown (covers, total pages, avg rating, top genres), top-line metrics, pace vs last year, recently finished and recently added strips
- **Recommendations** — "Your next read" widget (refreshes weekly, grounded in TBR/owned pool filtered by taste), "If you liked this" on book detail pages; 7-day cache; links to SLCL library, Amazon, Open Library
- **Design** — Modern Bookish system: Newsreader serif headings, Manrope UI, deep navy + terracotta palette, soft cream background, subtle Framer Motion animations

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), TypeScript, React 19 |
| Styling | Tailwind CSS v4, Framer Motion |
| Database | Supabase (Postgres + Row Level Security) |
| Auth | Supabase magic-link email login |
| AI | Anthropic Claude Haiku (`claude-haiku-4-5`) |
| Charts | Recharts |
| Hosting | Vercel (auto-deploy from GitHub `main`) |

---

## Design system

**Modern Bookish** — scholarly yet contemporary, balancing the warmth of a physical library with a precise analytical dashboard.

- **Fonts:** Newsreader (headings) + Manrope (body/UI)
- **Primary:** `#04152e` deep navy
- **Accent:** `#99462a` terracotta
- **Surface:** `#faf9f5` soft cream
- **Radius:** 4px standard · 8px book covers · 12px cards
- **Reference:** designed in Google Stitch ("Shelf Insights" project)

---

## Local development

### 1. Prerequisites

- Node.js 18+
- [Supabase CLI](https://supabase.com/docs/guides/cli)

### 2. Clone and install

```bash
git clone <your-repo-url>
cd masterdatashelf
npm install
```

### 3. Environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Settings → API |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` for local dev |

### 4. Apply database migrations

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to `/login` — enter your email to receive a magic link.

---

## Architecture

```
app/
  login/                    Magic-link login page
  auth/callback/            Supabase auth code exchange
  (app)/                    Authenticated route group (shared sidebar layout)
    dashboard/              Analytics dashboard + recommendations
    shelves/[shelf]/        Shelf grid view (sort, search, filter, paginate)
    books/[id]/             Book detail + author graph
    authors/[name]/         Author page
    settings/               CSV import + genre tagging

components/
  sidebar.tsx               Nav sidebar (desktop + mobile top bar)
  book-card.tsx             Cover grid card with badges and genre pills
  reading-chart.tsx         Recharts year bar chart with drilldown
  next-read-widget.tsx      "Your next read" recommendation widget
  similar-books-widget.tsx  "If you liked this" widget on book detail
  genre-tagger.tsx          Settings UI for LLM genre tagging job
  add-book-modal.tsx        Search + bulk ISBN add modal
  add-to-shelf-button.tsx   Inline shelf picker on book detail

lib/
  supabase/client.ts        Browser Supabase client
  supabase/server.ts        Server-side Supabase client (async cookies)
  shelves.ts                Shelf badge colors and labels
  genres.ts                 Fixed 31-genre taxonomy

app/actions/
  import-books.ts           Server action: Goodreads CSV upsert
  add-book.ts               Server action: Open Library → DB
  tag-genres.ts             Server action: Claude Haiku genre tagging
  recommendations.ts        Server action: Claude Haiku recommendations

supabase/migrations/
  001_initial_schema.sql    Full schema (books, shelf_entries, book_genres, recommendations_cache)
```

---

## Phases

- [x] Phase 1 — Foundation (scaffold, Supabase schema, magic-link auth, Vercel deploy)
- [x] Phase 2 — CSV import (Goodreads CSV parsing, cover fetching, progress bar, upsert)
- [x] Phase 3 — Shelf views (sidebar, cover grids, sort/search/filter, pagination)
- [x] Phase 4 — Manual add flow (Open Library search, bulk ISBN, FAB button)
- [x] Phase 5 — Book detail + author graph (detail page, author page, cross-shelf badges)
- [x] Phase 6 — Genre tagging via LLM (Claude Haiku, batched, fixed taxonomy, Settings UI)
- [x] Phase 7 — Analytics dashboard (year chart with drilldown, top-line metrics, strips)
- [x] Phase 8 — Recommendations ("next read" widget, "if you liked this", 7-day cache)
- [x] Phase 9 — Polish (animations, loading skeletons, empty states, mobile pass)
- [x] Phase 10 — Design overhaul (Modern Bookish system: Newsreader + Manrope, navy + terracotta)
