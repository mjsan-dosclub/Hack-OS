# Hack OS (DeScience Radar)

Hack OS is the DeScience Open Source Club member portal, with a public hackathon directory as its discovery surface. Verified members can sign in without a password, set up an authenticator, complete a team profile, and find relevant events, teammates, and mentors.

## Architecture at a glance

```text
Source adapters / club curation
        │ canonical Zod parse
        ▼
Server ingestion action ── Drizzle ── Supabase PostgreSQL
                                      │ RLS: public published/verified reads
                                      ▼
                              Server query / API
                                      │ serializable Hackathon DTO
                                      ▼
                      Radar UI + client filter state
                                      │
                      OS canvas / Zustand windows
```

Member records use a separate private path:

```text
Admin file upload → private Supabase Storage → safe Excel/CSV/text extraction
                                                ├─ roster/profile upsert by email
                                                ├─ consented DISC + Agile history
                                                └─ private full-text index
Verified member request → local event/member shortlist
                         → optional, consent-gated excerpts to JarvisLabs Ollama
                         → validated candidate keys mapped back to member cards
```

Scrapers normalize provider data into `HackathonInsert`, validate it at the boundary, and write through trusted server-side code. Public queries select only published and verified rows with an open or upcoming application status and a future registration deadline when one is provided. Radar and Map fetch the public `/api/hackathons` feed and validate its response against the shared Zod display contract; Synergy queries the same eligible event set for member matching. Client components use the window manager for desktop chrome and local interaction state. Do not put database credentials or Supabase service-role keys in client modules.

```text
Devpost RSS/listing ─┐
Devfolio public HTML ├─ fetch + Cheerio ─ raw records ─ Zod/heuristics (+ optional JarvisLabs Ollama extraction)
Unstop public HTML ─┘                                                │
                                                                    ▼
                                             India physical + online/hybrid scope
                                                                    │
                                               Drizzle transactional upsert
                                                                    ▼
                                  Supabase (unpublished, awaiting moderator verification)
```

## Project map

```text
hack-os/
├── src/
│   ├── app/                         # Next.js App Router pages, layouts, route handlers
│   ├── actions/                     # Server Actions: auth-checked mutations
│   ├── components/
│   │   ├── os/                      # Desktop canvas, menu bar, dock, window frame
│   │   ├── apps/radar/              # Directory app, cards and event details
│   │   ├── apps/map/                # Leaflet map explorer and map canvas
│   │   └── radar/                   # Backward-compatible Radar export
│   ├── db/                          # Drizzle client and schema (schema.ts)
│   ├── hooks/                       # Reusable UI hooks (drag, media query, etc.)
│   ├── lib/                         # Supabase clients, query helpers, app registry
│   ├── schemas/                     # Zod boundary schemas
│   ├── lib/scrapers/                # Provider adapters, sanitizer, rate limiter and sync
│   ├── stores/                      # Zustand client stores
│   └── types/                       # Shared domain types and DTOs
├── supabase/migrations/             # SQL-owned RLS and database capabilities
└── scripts/                         # Local setup and maintenance helpers
```

### Safe contribution seams

- **Mini-apps:** add a component in `src/components/apps/<app-name>/`, register its metadata and key in `APP_REGISTRY`, then add an exhaustive case to the app renderer. Keep app content independent of window lifecycle internals.
- **Scrapers:** add a source adapter under `src/lib/scrapers/`, return only `RawHackathonData`, and let `sanitizeHackathon` validate it before `syncEngine` writes. Use public pages/RSS and the shared polite fetcher; do not depend on undocumented JSON endpoints. Adapters never expose credentials in the browser.
- **Map providers:** isolate Leaflet-specific code under `src/components/apps/map/`; keep marker inputs as `Hackathon[]` and map-specific state local to that feature. The student directory scope is India venues plus online events; overseas physical listings should not be ingested.
- **Shared data contracts:** change the Zod schema and types together, then create a migration for persisted shape changes. Never edit synced project reference folders as implementation targets.
- **Member data:** use `/admin/students` to create or import roster records. Use `/admin/library` to privately store and index reference files; a matching email associates an extracted chunk with a member but does not update that member's structured roster fields. DISC/Agile values are removed from searchable chunks unless the row has affirmative assessment consent and a valid two-letter DISC combination. Never put gender, date of birth, or CGPA into a client DTO or AI prompt.

## Start locally

Requirements: Node.js 22.18+, pnpm, Docker, and the Supabase CLI. Node 22 is used for built-in TypeScript stripping in the local scraper CLI. To create the Next.js base from scratch (the checked-in `package.json` already lists these dependencies), run:

```bash
pnpm create next-app@latest hack-os --typescript --tailwind --eslint --app --src-dir --import-alias '@/*' --use-pnpm --yes
cd hack-os
pnpm add @supabase/ssr @supabase/supabase-js drizzle-orm postgres zustand zod framer-motion lucide-react cheerio ai @ai-sdk/openai
pnpm add -D drizzle-kit
pnpm dlx supabase init
```

Then add the files in this blueprint, including the migration, and start the local stack:

```bash
cp .env.example .env.local
pnpm dlx supabase start
# Set DATABASE_URL to the local DB URL printed by `supabase start`.
pnpm dlx supabase db reset
pnpm install
pnpm dev
```

## Day 4: scheduled ingestion

- Run one provider locally with `pnpm scrape --source=devpost`; use `devfolio`, `unstop`, or `all` for the others. The command requires `DATABASE_URL` and reads `.env.local` automatically.
- After a primary sync, cross-check current public listings with `pnpm scrape --verify-only`; combine `--verify` with a source argument to sync and then check. This records evidence from HackOdds, Hackathon Radar, Hack Club, and HackaMaps in `hackathon_source_checks`, without creating canonical events or changing `verified`.
- If local Postgres says its password is incorrect, get the active local connection from `pnpm dlx supabase status --output env` and copy its `DB_URL` into `.env.local` as `DATABASE_URL`. The CLI may generate a local password that differs from the sample in `.env.example`.
- Adapters read Devpost public RSS (then public listing HTML) and public Devfolio/Unstop listing HTML with Cheerio. They use 1–2 second polite delays, bounded retries, same-source-domain checks, and structured record counts. They avoid undocumented Devfolio APIs and browser automation.
- Dates and prizes must be explicit. If source pages omit parseable dates or prize values, optional structured extraction uses the configured JarvisLabs-hosted Ollama model. It may extract only facts present in the fetched source content; incomplete records are skipped and dates are never invented. No AI calls are made when listed dates and prize values are present.
- The ingestion scope is online events and India physical venues. Overseas in-person events and ambiguous locations are skipped. The static coordinate resolver covers major Indian cities; supported India locations without a known city are retained without a map pin.
- New scraper records remain unpublished and unverified until moderator approval. The admin review queue includes any unverified or unpublished record; public queries require both flags. Repeated runs match `(source, source_id)`. Updates preserve moderator verification/publication choices and replace tracks/tags only when the adapter extracted them.
- The protected `GET`/`POST /api/cron/sync` endpoint requires `Authorization: Bearer <CRON_SECRET>` and accepts `?source=devpost|devfolio|unstop|all`; append `&verify=true` to include public aggregator checks.
- Configure Vercel environment variables `DATABASE_URL` and `CRON_SECRET`; optionally add `JARVISLABS_API_KEY`, `JARVISLABS_BASE_URL`, and `JARVISLABS_MODEL` if scheduled scraper enrichment should use the hosted Ollama endpoint. AI enrichment runs only when source text lacks parseable dates or prize data. Vercel Cron runs daily at 18:30 UTC (00:00 India time). The database URL, cron secret, and JarvisLabs settings must remain server-only.
- Upstream markup and access can change. Review sync logs and verify official event details before featuring them; a nightly run never marks an event verified.

The SQL file in `supabase/migrations/0001_hack_os.sql` is the source of truth for RLS and database triggers. Keep Drizzle schema changes in sync with migrations. Generate types from the local Supabase project when API-level database types are introduced.

## Security model

- Anonymous and authenticated visitors read hackathons only when both `published` and `verified` are true.
- Club moderators/admins get ingestion and curation write access through `users.role`; role assignment is a trusted admin operation. Never allow a user to self-promote.
- Members read/update their own profile and CRUD only their own bookmarks.
- Scraper jobs use server-only credentials. The Supabase service-role key bypasses RLS and must never be used from browser code.

## Desktop controls (Day 2)

- Open or restore an app from the dock; drag its title bar, resize from the lower-right corner, or use the three window controls.
- Press **⌘K** (Mac) or **Ctrl+K** to search and open an app. Use **↑/↓**, **Enter**, and **Esc** in the palette.
- Press **Alt+Tab** to cycle through visible windows. Press **⌘W** / **Ctrl+W** to close the focused window.
- App metadata and window defaults live in the `APP_REGISTRY` in `src/stores/useWindowManager.ts`.
- The AI Project Ideator, Co-Pilot chat, and evaluator use only the JarvisLabs-hosted Ollama model during development. Set `JARVISLABS_API_KEY`, `JARVISLABS_BASE_URL`, and `JARVISLABS_MODEL` in `.env.local`; requests consume the JarvisLabs resources attached to that endpoint. Google and Groq keys, if present, are ignored. Keep credentials server-side and never give them a `NEXT_PUBLIC_` prefix.
- Directory and map views use the shared, Zod-validated `Hackathon` contract and display eligible events from `/api/hackathons`. The old `src/lib/mockHackathons.ts` fixture is retained for learning examples; it is not shown as a live opportunity in the desktop.

## Day 5: AI Hackathon Co-Pilot

- Open the Co-Pilot from the dock or launch it from a Radar event's **Ideate with AI** action. The active event is schema-validated and passed with the team's skills and build hours.
- Brainstorm, architecture, evaluator, and sprint modes are defined in `src/schemas/copilot.ts` and `src/lib/copilot/prompts.ts`. Streaming chat uses `/api/copilot/chat`; rubric evaluation uses `/api/copilot/evaluate` and validates the structured score before displaying it.
- Architecture answers include a safe Mermaid flowchart subset and a README markdown export. The event contract does not include sponsor APIs or complete judging rubrics; the Co-Pilot must state when that information is unavailable.
- JarvisLabs endpoint settings stay in `.env.local`. Without them, the UI and directory features still run, but AI requests return a configuration message.

## Day 6: contributor checks and onboarding

- Run `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, and `pnpm test` before opening a pull request. `pnpm test:coverage` also creates JSON and LCOV coverage reports.
- Run `pnpm test:e2e` for the desktop navigation smoke test. When no server is already listening on port 3000, Playwright builds the app and starts the production server for the test.
- `.github/workflows/ci.yml` checks pull requests to `main`, uploads Vitest coverage, comments the summary on same-repository PRs, runs the Playwright smoke test, and validates the PR title.
- `CONTRIBUTING.md` explains setup, app registration, scraper boundaries, and review practices. Five `.github/ISSUE_TEMPLATE/` forms provide scoped student-friendly contribution paths.

## Seven-day build path

1. **Foundation:** app shell, schema, RLS, shared validation and window manager.
2. **Desktop UX:** menu bar, draggable/resizable windows, dock, command palette, keyboard focus, and terminal/ideator mini-apps (implemented).
3. **Radar and map:** responsive directory, URL-synced filters, deadline countdowns, event inspection, Leaflet discovery, and a live reviewed-event query (date-range Gantt view remains a follow-up).
4. **Ingestion:** public-source adapters, Zod sanitation, idempotent upserts, verification checks, scheduled refresh, and admin event review (implemented; live-data QA remains a follow-up).
5. **AI Co-Pilot:** event-grounded brainstorming, architecture, structured evaluation, and sprint planning (implemented).
6. **Contributor engine:** Vitest unit/integration coverage, Playwright desktop navigation, Biome checks, GitHub CI, contribution guide, PR template, and five student issue templates (implemented).
7. **Polish and launch:** authenticated profiles and persistent bookmarks, live verified-event queries, moderator review, accessibility, performance, observability, and deployment.

Each day ends with a working increment and a short contributor note explaining the concepts used. Student contributors should add focused tests alongside new behavior and keep fixture data visibly labeled.

## Member portal and knowledge library

- `/admin/hackathons` is the administrator's event review screen. Open the official listing, correct the record, and approve it to make it visible to members. Saving corrections or hiding an event removes publication until it is approved again. Closed or ended registrations cannot be approved as open opportunities.

- `/login` accepts an email one-time code. An uploaded roster record links to the Supabase Auth identity by normalized confirmed email. Only roster rows marked as verified and current, alumnus, or mentor can enter the member workspace. The first visit requires TOTP enrollment; subsequent visits require the verified second factor.
- `/admin/library` is one upload area for multiple college and follow-up files. It stores originals in the private `member-library` bucket and indexes searchable text chunks. It does not create or update student master records; use `/admin/students` for the roster. A matching email links a reference chunk to a member. Add the college label in the upload form when useful for filtering library records.
- Supported indexed formats are `.xlsx`, `.xls`, `.csv`, `.txt`, `.md`, and `.json` (10 MB maximum). PDF and DOCX extraction is not part of the current dependency set, so those files are not accepted yet.
- The roster supports name, email, gender, college, degree, department, date of birth, CGPA and scale, skills, comfortable technologies, interests, projects, links, location, and travel availability. Gender, date of birth, and CGPA are private admin data: they are not shown on member cards and are not sent to Ollama or used to rank matches.
- Rows without explicit assessment consent remain only in the private original; their DISC/Agile values are excluded from searchable chunks. A structured assessment table with a two-letter DISC check exists in the schema but is not yet populated by the library upload flow; Synergy currently reads consented assessment excerpts from indexed chunks, without applying that table's validation.
- Hosted Ollama receives no names, email addresses, or social links. It receives a student's match request only when that student opts in, and candidate profiles only when those members separately opted in. The admin must also mark each source file AI-enabled. The model returns opaque candidate keys; the server maps them to local member records. If Ollama is unavailable, the endpoint uses local rules instead.
- Before using real student records, configure the private Storage service key in `.env.local` and apply migrations `0007`–`0009`. Do not commit real workbooks or populated environment files. The downloadable CSV is a fictional guest record for exercising the upload parser; it cannot sign in or appear in member matches.
- To bootstrap an administrator, create the account through email sign-in, then have the database owner assign that Auth UUID the `admin` role in `public.users`. Never expose role assignment through a client-side form.
