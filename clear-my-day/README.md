# ClearMyDay

Personalised calendar subscriptions for Sorbonne University masters. The app connects to the university CalDAV servers, filters events down to the courses and TD/TME groups a student actually attends, and exposes the result as a subscription URL compatible with Apple, Google, and Outlook calendars.

- **Status:** Production-ready
- **Stack:** Next.js 15, TypeScript, Supabase, Tailwind, React Big Calendar
- **Calendars supported:** DAC, IMA, ANDROIDE (extensible via `src/lib/sorbonne-masters.ts`)

---

## Feature Overview

- **Interactive selection** of masters, courses, and TD/TME groups with automatic group detection (manual override supported).
- **Preview mode** that fetches events without persisting tokens so Supabase stays clean.
- **Subscription URLs** served by `GET /api/calendar/[token]`, generating on-the-fly ICS feeds that stay within 99.5 % noise reduction (≈21 events per student).
- **Robust recurring-event handling** including `RECURRENCE-ID`, `EXDATE`, and proper Europe/Paris timezone management.
- **Production safeguards:** rate limiting, Supabase-backed storage, ETag support, and 6‑hour CalDAV caching per master combination.

---

## System Architecture

```
Calendar app → /api/calendar/[token] → Supabase calendar_tokens →
  caldav-client (CalDAV REPORT with academic year range) →
  calendar-parser (filters, applies EXDATE / RECURRENCE-ID) →
  ics-generator (final ICS response)
```

- `src/lib/caldav-client.ts` — Fetches CalDAV data using REPORT requests limited to the current + next academic year. Results are cached in Supabase (`caldav_cache`) for 6 hours, shared across all users requesting the same master combination.
- `src/lib/calendar-parser.ts` — Filters events, expands recurring series, and honours `RECURRENCE-ID` and `EXDATE` overrides.
- `src/lib/ics-generator.ts` — Emits RFC 5545 compliant feeds with stable UIDs, ETags, and Europe/Paris timezone definitions.
- `src/lib/calendar-storage.ts` — Reads/writes subscription configs in Supabase with an in-memory development fallback.

### Data & Caching

- **CalDAV cache:** Supabase table `caldav_cache` keyed by sorted master list (e.g., `caldav-DAC-IMA`). Entries expire after 6 hours and store parsed events to avoid repeated 4 600‑event downloads.
- **HTTP caching:** `Cache-Control: public, max-age=21600, s-maxage=43200, stale-while-revalidate=172800` plus deterministic ETags (`"<token>-<createdAt>"`). Most repeat hits return `304 Not Modified`.
- **Academic year filter:** CalDAV REPORT spans September of the current academic year through August two years later, automatically rolling each September.

### Repository Layout

```
clear-my-day/
├── app/
│   ├── page.tsx                 # Client entry point
│   └── api/                     # API routes
│       ├── calendar/[token]/      # Serves ICS calendar subscriptions
│       ├── generate-calendar/     # Creates persistent calendar tokens
│       ├── analyze-events/        # Powers automatic group detection
│       └── health/                # System health check
├── components/                  # UI components (SimplifiedCalendarSelector, previews)
├── lib/                         # CalDAV client, parsers, Supabase storage helpers
├── docs/                        # Operational and domain documentation
├── public/                      # Static assets (favicon, logo)
└── supabase-*.sql               # Schema definitions for required tables
```

### Security

- Token-based access for `GET /api/calendar/[token]` (unguessable UUIDs stored in Supabase).
- Rate limiting (≈60 requests/hour/IP at runtime) and HSTS/CORS headers.
- No manual cache invalidation endpoint is exposed; cache refresh relies on expiry to avoid abuse.

---

## Local Development

### Prerequisites
- Node.js 18+
- npm or pnpm
- Supabase project (optional for local tests; the code falls back to in-memory storage)

### Install & Run
```bash
git clone <repository-url>
cd clear-my-day/clear-my-day
npm install
npm run dev
```

Visit `http://localhost:3000`.

### Useful Commands
```bash
npm run lint        # ESLint
npm run test        # Jest/Vitest (if configured)
npm run build       # Production build check
```

### Operational Endpoints

- `GET /api/health` — simple probe used by monitoring and deployment checks (returns 200 on success).
- `/api/calendar/[token]` — primary ICS feed endpoint (requires valid token).

---

## Deployment Guide (Vercel + Supabase)

1. **Environment variables** (set in both local `.env` and Vercel dashboard):
   ```bash
   CALDAV_USERNAME=student.master
   CALDAV_PASSWORD=guest
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...   # Required; server-only, never expose to browsers
   RATE_LIMIT_REDIS_URL=...        # Optional if rate limit store is external
   ```
2. **Supabase schema:** run `supabase-calendar-tokens-schema.sql` and `supabase-caldav-cache-schema.sql` (adds `calendar_tokens`, `caldav_cache`, and helper indexes/cleanup function).
3. **Deploy:** merge an approved pull request into `master`; Vercel will build with `npm run build`. Verify `GET /api/health` returns `200`.

### Operations Checklist
- Monitor Vercel logs for `✅ CalDAV cache HIT` vs `❌ MISS` messages.
- Periodically prune or archive unused calendar tokens based on `last_accessed`.
- Keep an eye on CPU minutes; target <15 minutes/month thanks to caching.

**CPU profile:** With 6‑hour CalDAV caching and HTTP caching headers in place, typical usage stays below 0.5 CPU minutes per user per month (≈15 minutes total for ~200 users on the free Vercel tier).

---

## Troubleshooting & Known Limitations

- **Calendar shows stale events:** caches expire after 6 hours; Apple/Google may additionally cache for 1‑24 hours. Advise users to refresh or wait for expiry.
- **OIP/INOIP events missing:** ensure the relevant master is selected; parser recognises OIP and applies group filtering (`Groupe`, `Gr`, `TD`, `TME`).
- **Sorbonne network blocks requests:** see `../SORBONNE_FIREWALL_ISSUE.md` for the mitigation summary and contact template.
- **Supabase outage:** the service falls back to in-memory configs until Supabase reconnects; tokens created during downtime will be lost.

---

## Further Reading

- `../CHANGELOG.md` — condensed history of major fixes and architecture shifts.
- `../SORBONNE_FIREWALL_ISSUE.md` — notes on university firewall behaviour and an email template for IT support.
- Source modules contain inline comments outlining key parsing and caching logic.

---

**Built for Sorbonne students, by Sorbonne students.** 🎓
