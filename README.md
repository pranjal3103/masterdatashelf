# Masterdatashelf

Personal web app for managing and analyzing my reading library. Data comes from Goodreads CSV exports. Provides analytics, author-graph navigation, and AI-powered "next read" recommendations.

**Stack:** Next.js 16, TypeScript, Tailwind CSS v4, shadcn/ui, Supabase (Postgres + Auth), Anthropic Claude Haiku, Recharts, Vercel.

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

Fill in `.env.local` with your Supabase project URL, anon key, service role key, and Anthropic API key. All four values come from your Supabase dashboard (Settings → API) and Anthropic console.

### 4. Apply database migrations

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to `/login` — enter your email to receive a magic link.

---

## Deployment

The app auto-deploys to Vercel on every push to `main`. Set the same environment variables in your Vercel project settings (Project → Settings → Environment Variables).

After deploying, update `NEXT_PUBLIC_SITE_URL` in Vercel to your production URL, and add that URL to Supabase Auth → URL Configuration → Site URL + Redirect URLs.

---

## Architecture

```
app/
  login/          Magic-link login page (client component)
  auth/callback/  Supabase auth code exchange (route handler)
  dashboard/      Protected home page (server component)
lib/
  supabase/
    client.ts     Browser Supabase client
    server.ts     Server-side Supabase client (uses cookies)
middleware.ts     Session refresh + route protection
supabase/
  migrations/     SQL schema files (applied with supabase db push)
```

## Phases

- [x] Phase 1 — Foundation (scaffold, auth, deploy)
- [ ] Phase 2 — CSV import
- [ ] Phase 3 — Shelf views
- [ ] Phase 4 — Manual add flow
- [ ] Phase 5 — Book detail + author graph
- [ ] Phase 6 — Genre tagging via LLM
- [ ] Phase 7 — Analytics dashboard
- [ ] Phase 8 — Recommendations
- [ ] Phase 9 — Polish
