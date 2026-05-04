-- ─── books ───────────────────────────────────────────────────────────────────

create table books (
  id                        uuid primary key default gen_random_uuid(),
  goodreads_id              text unique,
  isbn13                    text,
  isbn10                    text,
  title                     text not null,
  author_primary            text not null,
  additional_authors        text[] default '{}',
  publisher                 text,
  pages                     int,
  year_published            int,
  original_publication_year int,
  cover_url                 text,
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

-- ─── shelf_entries ───────────────────────────────────────────────────────────

-- 'owned' is a physical-library shelf; the CSV shelf name for it is configurable
-- in the app settings, but the DB always normalises it to this enum value.
create type shelf_type as enum ('read', 'to-read', 'currently-reading', 'owned');

create table shelf_entries (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null references books(id) on delete cascade,
  shelf       shelf_type not null,
  date_read   date,
  date_added  date,
  my_rating   int check (my_rating >= 0 and my_rating <= 5),
  my_review   text,
  read_count  int default 0,
  unique(book_id, shelf)
);

-- ─── book_genres ─────────────────────────────────────────────────────────────

create table book_genres (
  book_id    uuid not null references books(id) on delete cascade,
  genre      text not null,
  confidence float,
  primary key (book_id, genre)
);

-- ─── recommendations_cache ───────────────────────────────────────────────────

create type recommendation_type as enum ('next_read', 'similar_to_book');

create table recommendations_cache (
  id                  uuid primary key default gen_random_uuid(),
  context_hash        text not null,
  recommendation_type recommendation_type not null,
  source_book_id      uuid references books(id) on delete cascade,
  result_json         jsonb not null,
  created_at          timestamptz default now()
);

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- Single-user app, but RLS is good practice and easy to extend later.

alter table books                enable row level security;
alter table shelf_entries        enable row level security;
alter table book_genres          enable row level security;
alter table recommendations_cache enable row level security;

create policy "auth_all_books"
  on books for all to authenticated
  using (true) with check (true);

create policy "auth_all_shelf_entries"
  on shelf_entries for all to authenticated
  using (true) with check (true);

create policy "auth_all_book_genres"
  on book_genres for all to authenticated
  using (true) with check (true);

create policy "auth_all_recommendations_cache"
  on recommendations_cache for all to authenticated
  using (true) with check (true);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

create index books_goodreads_id_idx  on books(goodreads_id);
create index books_isbn13_idx        on books(isbn13);
create index shelf_entries_book_id_idx on shelf_entries(book_id);
create index shelf_entries_shelf_idx   on shelf_entries(shelf);
create index book_genres_book_id_idx   on book_genres(book_id);
create index recommendations_context_hash_idx on recommendations_cache(context_hash);

-- ─── updated_at trigger ──────────────────────────────────────────────────────

create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger books_updated_at
  before update on books
  for each row execute function update_updated_at_column();
