# Hack OS production readiness and launch pack

Hack OS is deployed on Vercel. `main` is the production branch; `qa` is the preview branch. Keep the QA deployment on its Vercel preview URL. Attach `radar.descienceosclub.com` only to the production deployment after production Supabase values have been entered and smoke checks pass.

## 1. Vercel setup and deployment order

1. Create a Vercel project from `mjsan-dosclub/Hack-OS`. Set the production branch to `main`; let pushes to `qa` create previews. Do not connect the unrelated TalentOS Vercel project.
2. Set the framework preset to Next.js and leave the root directory at the repository root. Vercel reads [`vercel.json`](../vercel.json) automatically.
3. Create separate Supabase projects for QA and production. Apply the SQL migrations to each intended database in order. Never run `supabase db reset` against production.
4. Add the values from [`.env.example.production`](../.env.example.production) to Vercel. Put Supabase public values in the matching environment and restrict service keys, database URLs, cron and AI credentials to server environments. Populate production variables for Production and QA variables for Preview.
5. Deploy `qa`, verify auth, MFA, admin moderation, upload, public events, AI routes and map tiles against QA data. Only after that review, deploy `main` and attach the custom domain.
6. After production deployment, verify `/api/hackathons`, `/api/map-tiles/5/7/12`, the Open Graph image, sign-in and admin MFA, cron registration and function logs.

`DATABASE_URL` must be the Supabase production PostgreSQL connection string, preferably the transaction/session pooler URL supported by the selected Vercel runtime. Confirm SSL is enabled. The connection pool is deliberately small in `src/db/client.ts`; do not increase it without checking Supabase plan limits and Vercel concurrency.

### Environment variable inventory

| Variable | Use | Exposure |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical domain for metadata and map identification | Public |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase client URL | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase browser/server auth client | Public; protected by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin operations and storage | Secret; never expose to browser |
| `DATABASE_URL` | Drizzle and PostgreSQL operations | Secret |
| `CRON_SECRET` | Vercel Cron authorization for `/api/cron/sync` | Secret |
| `JARVISLABS_API_KEY` | Ollama-compatible AI provider | Secret |
| `JARVISLABS_BASE_URL` | JarvisLabs OpenAI-compatible endpoint | Server-only configuration |
| `JARVISLABS_MODEL` | Configured model tag | Server-only configuration |

Google and Groq keys are intentionally absent: the current code routes AI through JarvisLabs. Add provider credentials only alongside an implemented, reviewed provider path.

## 2. Nightly synchronization

`vercel.json` schedules `/api/cron/sync?source=all&verify=true` at `30 18 * * *` UTC, which is 00:00 India Standard Time. Vercel Cron uses UTC. On Vercel Hobby, a scheduled job can run at any time within its selected hour; this schedule therefore means between 00:00 and 00:59 IST. Vercel injects `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` is set, and the route verifies it before scraping. The former GitHub Actions nightly scraper has been removed to avoid duplicate ingestion; GitHub Actions remains available for CI.

Cron delivery is best effort and duplicate invocations are possible. Scraper upserts use stable source identity/slug keys; review Vercel function logs after the first scheduled run and periodically check each source's last successful sync. If the sync duration approaches a day or duplicate concurrent ingestion becomes possible, add a shared database advisory lock before increasing frequency.

Manual QA invocation, run from a terminal after setting a QA token and URL (do not paste either into chat):

```sh
curl --fail-with-body \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${HACKOS_BASE_URL}/api/cron/sync?source=all&verify=true"
```

Use `HACKOS_BASE_URL=https://<the-qa-deployment-host>` in your own shell. The route supports `devpost`, `devfolio`, `unstop`, or `all` as the source query value.

## 3. Subdomain and SSL

In Vercel, open the Hack OS project → **Settings → Domains** and add `radar.descienceosclub.com`. Then copy the exact DNS record Vercel displays into the DNS provider that hosts `descienceosclub.com`:

| Type | Name / Host | Value |
| --- | --- | --- |
| CNAME | `radar` | The exact target shown in the Hack OS Vercel project |

Do not assume a generic CNAME target: Vercel may provide a project-specific target. Verify with `vercel domains inspect radar.descienceosclub.com` after linking the local CLI to the Hack OS Vercel project. Remove a conflicting existing `radar` record first. Vercel automatically provisions TLS after DNS verification succeeds. Keep email-related DNS records unchanged.

## 4. Security, headers, and rate limits

`vercel.json` sets HSTS, frame/content-type protections, a restrictive permissions policy, and a CSP tailored for Next.js, Supabase HTTPS/WebSockets, Leaflet and inline styles. Geolocation remains allowed for the map's user-requested location feature. Review CSP in Vercel Preview before production; add only the specific origin a failing feature requires.

`src/middleware.ts` applies a small in-memory token bucket to POST requests on the two anonymous AI endpoints: six initial requests, then one token restored every ten seconds per IP and route. This works as a low-cost first-line brake, but Vercel serverless instances do not share memory; determined users can spread requests across instances. Treat it as best-effort abuse friction, not a hard quota. A shared rate-limit service is a later production enhancement if spend or abuse requires cross-instance enforcement.

The cron handler currently requires a secret and uses constant-time comparison. Do not place the secret in a URL, public variable, source code, screenshot or log.

## 5. Database health and backups

Before production migration or index work:

1. Confirm the production Supabase project, owner, region, plan and database URL with the club administrator.
2. Take a provider backup or a verified `pg_dump` snapshot and record its timestamp and restore owner. Confirm the project plan's backup retention and point-in-time recovery capability rather than assuming them.
3. Apply reviewed application migrations with the repository's migration process. Verify tables, RLS policies, storage policy and admin access before importing real student data.
4. Run [`verify_indexes.sql`](../supabase/production/verify_indexes.sql) with `psql` against production after backup. It uses `CREATE INDEX CONCURRENTLY`, so execute it outside an explicit transaction. Inspect that all listed indexes report `is_valid = true`.
5. Test a restore into a non-production Supabase project at least once before relying on a backup.

The script adds filtered composite indexes for the public deadline/format/date query paths and verifies the GIN title/description search index. Existing migration indexes are left intact. Re-run the public directory query plan after realistic data import; indexes should be retained only if they improve the measured query without unacceptable write overhead.

## 6. SEO and share cards

`src/app/layout.tsx` supplies canonical social metadata and links the generated image at `/opengraph-image`. `src/app/opengraph-image.tsx` renders a Hack OS desktop card and fetches the public, already-verified directory count from `/api/hackathons`; if the directory is unavailable, it displays a neutral label instead of inventing a count. The public home page emits `SoftwareApplication` JSON-LD and up to 20 `Event` entries, restricted to published, verified, open/upcoming events. Never expose draft, private member or unapproved event data in metadata.

## 7. Launch campaign — LinkedIn

Publish Post 1 only after the production domain resolves and the flagship event's official date/rules are published. Replace neither the link nor the claim with an unverified announcement.

### Post 1 — Product announcement

“I only know frontend.”

That sentence has kept too many students from applying to a hackathon.

Real teams need people who can design, research, build, test, present and learn together. Students need a reliable way to find the next event—and a community that helps them take the first step.

So we built **Hack OS**: a living hackathon radar inside a retro desktop. Discover reviewed events, explore places, plan a project with the AI co-pilot, and connect the experience back to the DeScience Open Source Club.

This is a student-built, open-source learning system. We are building it in public and improving it with our community.

Explore: https://radar.descienceosclub.com
Contribute: https://github.com/mjsan-dosclub/Hack-OS

We are also preparing our flagship inter-college hackathon, with an international trip prize. Follow DeScience Open Source Club for the official eligibility, dates and selection rules.

You do not need to know everything to start. You need a team willing to learn.

#HackOS #Hackathons #StudentBuilders #OpenSource #DeScience #BuildInPublic

### Post 2 — Engineering deep dive

We did not want to build another list of hackathon links.

We wanted students to learn how a real product fits together—state, data contracts, ingestion, privacy, deployment and the small interaction details that make software feel coherent.

Here is the engineering behind **Hack OS**:

• Next.js App Router and React 19 for the application and route handlers
• TypeScript, Zod and Drizzle for validated contracts and transparent PostgreSQL queries
• Zustand for desktop window, focus and dock state
• Framer Motion for draggable, animated desktop windows
• Leaflet for event discovery on a map
• Cheerio and standard `fetch` for source-specific event ingestion
• Supabase Auth, MFA, PostgreSQL and Row-Level Security for the member workspace
• Vercel AI SDK connected to our current JarvisLabs-hosted Ollama-compatible model

The ingestion pipeline does not publish directly: event records enter review, and moderators control what becomes public. The member skill matrix stays behind membership and access controls.

Repository: https://github.com/mjsan-dosclub/Hack-OS
Product: https://radar.descienceosclub.com

Senior engineers: we welcome review of the architecture and student-friendly issues. Students: the repo is a place to learn by shipping real systems.

#NextJS #TypeScript #PostgreSQL #Supabase #OpenSource #StudentEngineering

### Post 3 — Open Source Friday invitation

Your first open-source contribution does not need to be a giant feature.

It can be fixing a confusing label, improving a scraper's validation, documenting a setup step or reviewing a map interaction.

At **Open Source Friday**, DeScience Open Source Club works through practical engineering together. Bring a laptop, curiosity and one question. We will help you find a task that matches your current comfort level.

Start with Hack OS: https://github.com/mjsan-dosclub/Hack-OS
Join the next session and see the webinar details: https://osf.descienceosclub.com

If you have never contributed before, this is for you. Learn with peers, make a change, and leave with a real contribution you can explain.

#OpenSourceFriday #GoodFirstIssue #StudentDevelopers #LearnByBuilding #DeScience

## 8. Campus ambassador broadcast

**WhatsApp / Discord**

🚀 **Find your next hackathon. Build with your people.**

DeScience Open Source Club is building Hack OS: a student workspace with a reviewed hackathon radar, map discovery and project-planning co-pilot.

🔎 Explore: https://radar.descienceosclub.com
🛠️ Contribute: https://github.com/mjsan-dosclub/Hack-OS
🤝 Learn with us at Open Source Friday: https://osf.descienceosclub.com

First-time contributor? You are welcome. Bring a laptop and we will help you find a beginner-friendly issue. Please verify each event's official page before applying.

## 9. International trip shortlist — proposed activity rubric

This is a **draft club scorecard for approval**, not official event eligibility or a guaranteed prize. Publish it only after the club formally adopts the rules and names the decision panel. Hack OS activity may inform a shortlist; it cannot promise that a contributor will win or travel.

| Area | Points | Evidence |
| --- | ---: | --- |
| Useful product or code contribution | 0–30 | Merged issue/PR, tested UI fix, feature or documentation with reviewer sign-off |
| Data quality and source research | 0–20 | Accurate hackathon listing, scraper improvement, evidence links and duplicate handling |
| Open Source Friday learning and participation | 0–15 | Attended sessions, completed a learning task, shared a short demo or reflection |
| Teamwork and peer support | 0–20 | Helpful code review, mentoring, clear collaboration and respectful feedback |
| Reliability and final demo | 0–15 | Follow-through, clear communication, working demo and honest account of contribution |
| **Total** | **100** | Reviewed against published evidence by the club panel |

**Fairness rules to adopt with the rubric:** assess contribution quality rather than raw commit count; allow equivalent contributions for different skill levels; disclose the panel and tie-break process; publish eligibility and dates separately; keep a review/appeal channel; and collect only the data needed to run the selection. A panel should not use private DISC or academic records as a travel prize score unless the club publishes a lawful, transparent policy and participants have meaningful consent.
