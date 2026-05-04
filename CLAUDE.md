@AGENTS.md

# Personal Library App — Project Instructions

---

## Session decisions & technical notes (update as we go)

### Stack actuals (may differ from spec)
- **Next.js 16.2.4** was installed (spec said 14+) — uses React 19. Key breaking change: `cookies()`, `headers()`, `params`, and `searchParams` are all **async** in Next.js 15+. Always `await` them.
- **Tailwind CSS v4** — uses `@import "tailwindcss"` in globals.css, not the old `@tailwind` directives. No `tailwind.config.ts` file needed.
- **papaparse** installed for CSV parsing (`npm install papaparse @types/papaparse`).

### Database
- Migration file: `supabase/migrations/001_initial_schema.sql`
- Uses `gen_random_uuid()` not `uuid_generate_v4()` — the uuid-ossp extension is not available on this Supabase project.
- Applied via: `npx supabase login → npx supabase link --project-ref javmoboluxfhqxuzdcvs → npx supabase db push`
- Supabase CLI installed as local dev dependency (`npm install --save-dev supabase`), run via `npx supabase`.

### Architecture decisions
- Route group `app/(app)/` holds all authenticated pages with a shared layout (`layout.tsx`) that renders the sidebar and fetches shelf counts once per navigation.
- `router.refresh()` is called after every book add/import so sidebar counts update instantly without a full page reload.
- Shelf page uses a **two-step Supabase query**: first paginate with `!inner` join (to filter books by shelf), then a second query to fetch ALL shelf memberships for those book IDs. This is required because PostgREST's `!inner` + `.eq()` filter strips non-matching shelf_entries from the result, hiding cross-shelf badges.
- `lib/supabase/client.ts` = browser client, `lib/supabase/server.ts` = server client (async cookies).
- Supabase anon key format is `sb_publishable_...` (newer Supabase key format, not the old `eyJ...` JWT format).

### Deployment (pending)
- GitHub repo not yet created — git not installed on this machine.
- Vercel deploy deferred until after Phase 2 (CSV import) completes — now ready to deploy after Phase 5.
- To deploy: install git → `git init && git add . && git commit` → create GitHub repo → push → connect to Vercel → add env vars.

### Phase completion status
- ✅ Phase 1 — Foundation (Next.js scaffold, Supabase schema, magic-link auth, empty dashboard)
- ✅ Phase 2 — CSV import (Goodreads CSV parsed, 2,610 books imported, progress bar, upsert logic)
- ✅ Phase 3 — Shelf views (sidebar nav, book cover grids, search, sort, pagination)
- ✅ Phase 4 — Manual add flow (Open Library search, bulk ISBN add, FAB button, sidebar count updates)
- ✅ Phase 5 — Book detail + author graph (book detail page, author page with stats, cross-shelf badges, clickable author names)
- ⬜ Phase 6 — Genre tagging via LLM
- ⬜ Phase 7 — Analytics dashboard
- ⬜ Phase 8 — Recommendations
- ⬜ Phase 9 — Polish

---

## What we're building

A personal web app for managing and analyzing my book library. Data comes from Goodreads CSV exports. The app provides analytics, author-graph navigation, and AI-powered "next read" recommendations that Goodreads itself doesn't offer.

**This is a single-user app. The only user is me.**

---

## Stack (non-negotiable — do not substitute)

- **Framework:** Next.js 14+ with App Router, TypeScript
- **Styling:** Tailwind CSS + shadcn/ui components
- **Animations:** Framer Motion (use sparingly — subtle fades and transitions only)
- **Database:** Supabase (Postgres). Use the Supabase JS client.
- **Auth:** Supabase Auth with magic-link email login. Single user (me) — no signup flow needed; I'll create my account manually in the Supabase dashboard.
- **AI:** Anthropic API (`@anthropic-ai/sdk`). Use Claude Haiku (`claude-haiku-4-5`) for genre tagging and recommendations.
- **Charts:** Recharts
- **Hosting:** Vercel (deploy from GitHub on every push to main)
- **Source control:** GitHub

All four hosted services (Vercel, Supabase, GitHub, Anthropic) are on free or pay-as-you-go tiers. Total cost target: under $15 for the entire build, dominated by Anthropic API usage.

---

## Critical context: my data

I have already exported my Goodreads CSV. Stats:
- 2,610 total books
- 731 in "read" shelf, 1,873 in "to-read", 6 "currently-reading"
- 90% have a "Date Read" filled (years 2019-2026, ramping from 24 to 121 books/year)
- 95% have a rating (1-5 stars)
- 52% have written reviews (avg 735 chars, up to 2000 chars — these are substantive)
- 90% have ISBN13
- Custom Goodreads shelves are essentially empty — **genre data must come from LLM tagging, not from the CSV**

The "owned" (physical library) shelf does not yet exist in Goodreads. I will create a custom shelf in Goodreads (likely named `owned` or `physical-library`) and add my ~400 physical books to it before re-exporting. The app should treat the shelf-name-for-owned-books as a configurable value, not hardcode it.

---

## Core data model

```
profiles (Supabase auth user — just me)

books
  id (uuid, pk)
  goodreads_id (text, unique nullable)
  isbn13 (text, nullable)
  isbn10 (text, nullable)
  title (text, not null)
  author_primary (text, not null)
  additional_authors (text[])
  publisher (text)
  pages (int)
  year_published (int)
  original_publication_year (int)
  cover_url (text)               -- fetched from Open Library at import time
  created_at, updated_at

shelf_entries           -- a book can be on multiple shelves; this is the join
  id
  book_id (fk books)
  shelf (enum: 'read', 'to-read', 'currently-reading', 'owned')
  date_read (date, nullable)
  date_added (date)
  my_rating (int 0-5)
  my_review (text)
  read_count (int)
  unique(book_id, shelf)

book_genres             -- LLM-generated, cached forever
  book_id (fk books)
  genre (text)          -- from fixed taxonomy below
  confidence (float)
  primary key (book_id, genre)

recommendations_cache   -- cache LLM recs to avoid re-billing
  id
  context_hash (text)   -- hash of input books used to generate
  recommendation_type (enum: 'next_read', 'similar_to_book')
  source_book_id (uuid, nullable) -- for 'similar_to_book'
  result_json (jsonb)
  created_at
```

**Note on `owned` + Goodreads shelves:** A single book can appear in multiple shelves (e.g., I own a physical copy AND have read it AND have it on my generic to-read). The `shelf_entries` table handles this via multiple rows per book.

---

## Fixed genre taxonomy

LLM tagging must use this list — do not let it invent genres. Each book gets 1-3 tags.

```
literary-fiction, science-fiction, fantasy, mystery-thriller, horror,
romance, historical-fiction, manga-comics, poetry, drama,
history, biography-memoir, philosophy, politics, economics,
science, technology, psychology, religion-spirituality, sociology,
self-help, business, travel, food-cooking, art-design,
essays, journalism, india-south-asia, literary-criticism, nature-environment
```

Add a 31st bucket `other` for anything that doesn't fit.

---

## Feature scope (build in this order)

### Phase 1 — Foundation (Days 1-2)
1. Next.js project scaffolded, deployed to Vercel with a "hello world" page on the live URL.
2. Supabase project created, schema applied via migration files (use Supabase CLI).
3. Supabase Auth with magic link working — I can log in with my email.
4. Anthropic SDK installed, env vars configured locally and on Vercel.
5. GitHub repo with sensible README, `.env.example`, `.gitignore`.

**Deliverable:** I can visit the deployed URL, log in via magic link, see an empty authenticated dashboard.

### Phase 2 — CSV import (Days 3-4)
1. Settings page with a CSV upload input.
2. Parse Goodreads CSV (handle the specific column names from a real export — see appendix).
3. Configurable input: "Which shelf name in your CSV represents physical ownership?" defaulting to `owned`.
4. Upsert logic: if a book already exists (matched by `goodreads_id` or `isbn13`), update its shelf entries rather than duplicating.
5. Fetch cover images from Open Library Covers API (`https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg`) at import time. Store the URL.
6. Progress indicator during import (2,610 rows is not instant).
7. Show import summary: X books added, Y updated, Z failed (with reasons).

**Deliverable:** I upload my CSV, all 2,610 books load with cover images, dashboard shows real counts.

### Phase 3 — Shelf views (Days 5-6)
1. Sidebar navigation: Dashboard, Owned, Want to Read, Currently Reading, Read, Settings.
2. Each shelf view: grid of book covers (responsive — 2 cols mobile, 4-6 cols desktop).
3. Filtering and sorting on each shelf view: by author, title, date added, rating, year published.
4. Search bar that searches across title and author.
5. Click a book → book detail page (covered in Phase 5).
6. Pagination or virtualization for the 1,873-row TBR shelf.

**Deliverable:** I can browse all four shelves on my phone smoothly.

### Phase 4 — Manual add flow (Day 7)
1. "Add a book" button visible from any shelf view.
2. Input: title (required), author (optional).
3. Hits Open Library Search API, returns top 5 candidates with cover, author, year.
4. I tap one → book is added to "owned" shelf by default (with override option for other shelves).
5. Secondary path: "Bulk add by ISBN" — paste a list of ISBNs (one per line), app fetches and adds all.

**Deliverable:** I can add a single book in under 10 seconds from my phone.

### Phase 5 — Book detail page + author graph (Days 8-9)
1. Book detail route: `/books/[id]`.
2. Display: cover, title, authors, my rating, my review, dates read, pages, publisher.
3. **Other books by this author across all shelves** — clickable cards, with shelf badges (owned / read / TBR).
4. Every author name anywhere in the app is a clickable link → `/authors/[name]` (URL-encoded).
5. Author page: all books by that author across all my shelves, plus stats (total read, avg rating I gave them, etc.).

**Deliverable:** Click any book → see the author graph. The "interconnected library" experience.

### Phase 6 — Genre tagging via LLM (Day 10)
1. Background job (or manual trigger button in Settings) that finds books without genre tags.
2. Batches of 20 books, sends to Claude Haiku with the fixed taxonomy.
3. Stores results in `book_genres` table.
4. Displays genres on book detail pages.
5. Adds genre filter to shelf views.

**Prompt structure for genre tagging** (use this verbatim, adapted for batch input):
```
You are tagging books with genres. For each book, return 1-3 genre tags from this exact list (do not invent new tags):
[full taxonomy list]

Input: a JSON array of {id, title, author, year_published}.
Output: a JSON array of {id, genres: [string]}.

Be specific. "history" for nonfiction history; "historical-fiction" for novels set in the past. Books about India/South Asia get the "india-south-asia" tag in addition to their primary genre.
```

**Deliverable:** All 2,610 books have genre tags. Costs roughly $1-2 in API.

### Phase 7 — Analytics dashboard (Day 11)
1. **Years bar chart:** books read per year (Recharts, x = year, y = count).
2. Click a year → drilldown panel: grid of covers from that year, total pages, average rating, top 3 genres.
3. Click a book in the drilldown → book detail page.
4. Top-line metrics: total books, books this year, current pace vs last year, top genres all-time.
5. Recently finished + recently added strips.

**Deliverable:** Dashboard tells the story of my reading.

### Phase 8 — Recommendations (Day 12)
1. **"Your next read" widget on dashboard.** On click "refresh recommendations":
   - Pull last 20 finished books (with rating, review, genre).
   - Pull all TBR + owned-but-unread books with their genres.
   - Send to Claude Haiku with prompt below.
   - Cache result for 7 days.
2. **"If you liked this" on book detail pages** for read books:
   - Send the source book + my rating + my full reading history summary.
   - Ask for 3 recommendations strictly from my TBR/owned shelves.
   - Cache by source_book_id.

**Prompt structure for "next read"** (adapt as needed):
```
You are recommending what I should read next from books I already own or want to read.

My recent reading (last 20 finished books):
[for each: title, author, rating, genres, brief review excerpt]

My candidate pool (books I own physically OR have on want-to-read):
[filtered list — see filtering rule below]

Recommend exactly 3 books from the candidate pool. For each, explain in 2 sentences why it fits my recent reading patterns. Reference specific books I've read or themes I've gravitated toward. Do not recommend books outside the candidate pool.

Output JSON: [{book_id, reasoning}]
```

**Candidate pool filtering rule:** Don't send all 1,873 TBR books. Pre-filter to: (a) books in genres I rated 4+ stars in the last year, plus (b) books by authors I've already rated 4+ stars, plus (c) all owned-but-unread books. This keeps the prompt manageable and recommendations grounded.

3. **Library/Amazon links** under each recommendation:
   - St. Louis County Library search: `https://catalog.slcl.org/client/en_US/default/search/results?qu={ISBN_or_title}`
   - Amazon search: `https://www.amazon.com/s?k={ISBN_or_title}`
   - Open Library: `https://openlibrary.org/search?isbn={ISBN}`

**Deliverable:** I get a real, useful weekly recommendation grounded in books I already have access to.

### Phase 9 — Polish (Days 13-14)
1. Design pass: warm cream background (#FAF7F2), serif headings (Fraunces or EB Garamond), Inter for body, single accent color (deep green or oxblood).
2. Subtle Framer Motion fade-in on shelf grids and dashboard cards.
3. Loading states everywhere — never show a blank screen during fetches.
4. Empty states with friendly copy.
5. Mobile testing pass: every view must work well at 375px width.
6. README with screenshots, architecture diagram, and a section on what the AI tools did well and badly during the build (for portfolio storytelling).
7. Demo video (Loom or screen recording) walking through the app.

**Deliverable:** A finished app I'd be comfortable showing publicly.

---

## Design principles

- **Warm minimal, not skeuomorphic.** No wooden shelves, no leather textures, no page-curl animations. The "library feel" comes from typography, whitespace, and beautifully displayed book covers — not theming.
- **Book covers are the visual anchor.** Every list view leads with covers. Cream background makes them pop.
- **Typography:** serif for titles and headings, sans for body and UI. This single choice does 80% of the aesthetic work.
- **One accent color only.** Deep green (#2C5F2D) or oxblood (#722F37) — not both.
- **Animations are subtle.** Fade-in on scroll, gentle hover lifts on cards. No parallax, no scroll-jacking.
- **Breadcrumbs always visible** when more than one level deep. User should never feel lost.
- **Author names are always clickable** anywhere they appear in the app.

---

## Engineering principles

- **TypeScript strict mode on.** No `any` types unless absolutely necessary.
- **Server components by default.** Client components only for interactive widgets.
- **Use Supabase RLS** (Row Level Security) even though it's a single-user app — good practice and protects against the day this becomes multi-user.
- **Environment variables:** never commit secrets. `.env.example` checked in, real `.env.local` ignored.
- **Migrations as SQL files** in `supabase/migrations/`, not ad-hoc dashboard changes.
- **Cache LLM results aggressively.** Genre tags forever. Recommendations for 7 days. Never re-bill for the same input.
- **Handle the Goodreads CSV's quirks** — it has BOM, weird quoting on some fields, ISBN fields wrapped in `="..."` formula format. Strip these.
- **Don't over-engineer.** No Redux, no tRPC, no microservices. Server actions and Supabase client are enough.

---

## Working agreement with me (Pranjal)

- I have programming background but I'm new to Next.js, React, and Supabase. **Explain what you're doing as you do it**, especially when introducing new patterns. I want to learn, not just copy.
- I'll be giving feedback after each phase. **Don't skip ahead.** Finish each phase, deploy it, let me test on my phone, then move on.
- When I'm wrong about something or asking for the wrong thing, **push back**. I prefer being told "this is a bad idea because X" over polite agreement.
- When making a non-trivial decision (library choice, schema design, prompt structure), **explain the alternatives you considered and why you picked one.** I'm using this project to learn engineering judgment, not just to ship a thing.
- I work on this in 2-4 hour blocks, not full days. Design tasks so I can stop and resume cleanly.

---

## Appendix: Goodreads CSV schema (real columns from my export)

```
Book Id, Title, Author, Author l-f, Additional Authors,
ISBN, ISBN13, My Rating, Publisher, Binding,
Number of Pages, Year Published, Original Publication Year,
Date Read, Date Added, Bookshelves, Bookshelves with positions,
Exclusive Shelf, My Review, Spoiler, Private Notes,
Read Count, Owned Copies
```

- `ISBN` and `ISBN13` come wrapped as `="0123456789"` — strip the `="..."` wrapper.
- `Date Read` and `Date Added` formats vary: typically `DD-MM-YYYY` or `YYYY/MM/DD`. Handle both.
- `Exclusive Shelf` is one of: `read`, `to-read`, `currently-reading`, or a custom shelf name (e.g., `owned`).
- `Bookshelves` is comma-separated custom tags.
- `My Rating` of `0` means unrated — treat as null.
- Some rows have non-Latin titles (Japanese, Hindi). Ensure UTF-8 throughout.

---

## What I am NOT building (explicit non-goals)

- Cover-photo recognition / image-based book lookup
- Barcode scanning (cut — Goodreads handles ingestion)
- Multi-user features, sharing, social
- Anything offline-first or PWA installation
- Native mobile app
- A real recommendation engine using embeddings or collaborative filtering (LLM-as-recommender is sufficient)
- Tracking reading sessions or page counts day-by-day
- Audiobook integration
