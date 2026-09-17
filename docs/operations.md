# Operations Guide

This guide summarises how to deploy, operate, and maintain ClearMyDay. Product overview and architecture live in `clear-my-day/README.md`.

---

## Environments & Secrets

- **Vercel** hosts the Next.js frontend plus API routes.
- **Supabase** stores calendar subscriptions, CalDAV caches, and analyze-events cache entries.

Set these environment variables locally (`.env`) and in Vercel:

```bash
CALDAV_USERNAME=student.master
CALDAV_PASSWORD=guest

SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=... # server-only
SUPABASE_SERVICE_ROLE_KEY=...   # optional, required for admin scripts

RATE_LIMIT_REDIS_URL=...        # optional, falls back to in-memory limiter
NEXT_PUBLIC_APP_URL=https://www.clearmyday.com
```

---

## Supabase Schema Checklist

Run all three SQL scripts in the Supabase SQL editor before first deploy:

1. `supabase-calendar-tokens-schema.sql`
   - Creates `calendar_tokens` and `analyze_events_cache`.
   - Adds indexes to support lookup and cleanup queries.
2. `supabase-caldav-cache-schema.sql`
   - Creates `caldav_cache` with GIN index on `masters`.
   - Installs `cleanup_expired_caldav_cache()` helper function.
3. `supabase-ics-output-cache-schema.sql`
   - Creates `ics_output_cache`, keyed by subscription token.
4. **Token cleanup scheduling**: `supabase-calendar-tokens-schema.sql` includes a sample DELETE statement, but does not install an automatic cleanup policy by default—schedule the DELETE or add a cron job if you want automated cleanup.

### Table Responsibilities

- `calendar_tokens`: Stores subscription metadata. A unique token is generated for each unique combination of a user's filter configuration and personalized calendar name.
- `analyze_events_cache`: 90-day cache for `/api/analyze-events` group detection results, keyed by individual master.
- `caldav_cache`: 6-hour cache of parsed VEVENT arrays keyed by sorted master list (e.g., `caldav-DAC-IMA`).
- `ics_output_cache`: 1-hour cache of final filtered ICS output per token.

`dateRangePolicy` and `academicYearStart` are stored inside the existing `calendar_tokens.filter` JSONB value. Adding or changing them does not require a database migration. Each subscription is pinned to that academic year; legacy rows without the fields infer the year from token creation time and their original range.

If Supabase is unreachable, the app falls back to an in-memory `Map`. Subscriptions created during downtime will be lost.

---

## Request Flow & Caching

1. Calendar client requests `GET /api/calendar/[token]`.
2. Subscription config loads from `calendar_tokens` (in-memory fallback if Supabase down).
3. CalDAV events load from Supabase cache; on miss, `caldav-client` downloads the full source with GET to preserve EXDATE data, then filters locally.
4. `calendar-parser` filters events, applies `RECURRENCE-ID` overrides, and removes `EXDATE` occurrences.
5. `ics-generator` returns RFC 5545-compliant ICS (Europe/Paris timezone, deterministic UIDs) plus caching headers.

### Cache Policy Snapshot

- **HTTP headers:** one-hour browser/CDN freshness with six-hour stale-while-revalidate.
- **ETag:** SHA-256-derived semantic ICS hash; timestamp-only regeneration does not invalidate it.
- **Supabase CalDAV cache TTL:** 6 hours per master combination.
- **Supabase ICS output cache TTL:** 1 hour per token.
- **Client behaviour:** calendar applications control their own subscription refresh cadence in addition to these server caches.
- **Security:** No manual cache invalidation endpoint is exposed, preventing trivial CPU amplification attacks.

---

## Deployment Workflow

1. Confirm Supabase schema scripts have been applied.
2. Push to production branch (`master`). Vercel runs `npm run build` from the `clear-my-day` root directory.
3. Verify deployment health: `curl https://www.clearmyday.com/api/health`.
4. Subscribe a test calendar; check logs for `✅ CalDAV cache HIT` and recurrence-related messages.

Useful scripts:

```bash
npm run lint
npm run build
npm run test
```

---

## Monitoring & Alerting

- **Vercel dashboard:**
  - Track CPU minutes (target <15 min/month after caching improvements).
  - Watch for spikes in `❌ CalDAV cache MISS` (expect one miss per master combo every 6 h).
- **Supabase dashboard:**
  - Observe table sizes; `caldav_cache` should remain small (hundreds of KB).
  - Run `SELECT cleanup_expired_caldav_cache();` if expired rows linger.
- **Synthetic checks:**
  - Optional: schedule `curl` against `/api/health` and a sample calendar URL to ensure 200/304 responses.

When miss frequency jumps, verify Sorbonne credentials and review `Attempt X failed for <master>` logs (the client retries 3 times with 1 s → 2 s → 4 s backoff).

---

## Routine Maintenance

- **Token hygiene:** Tokens are bearer credentials. Never log or publish them; schedule cleanup based on `last_accessed` if desired.
- **Personalized Names**: The system supports personalized calendar names by including the name in the hash used for token generation. This ensures that users see their chosen name in their calendar client while preserving the efficiency of the CalDAV cache, which is keyed only by the selected masters.
- **Course catalogue updates:** Modify `src/lib/sorbonne-masters.ts` when masters/courses change; update associated tests/UI labels.
- **Firewall coordination:** Use `docs/domain-notes.md` (firewall observations + French contact template) when working with Sorbonne IT.
- **Rate limit tuning:** Default limiter ≈60 requests/hour/IP; adjust if usage grows.

---

## Runbook

- **Users report stale data**
  - Check both `caldav_cache.expires_at` and `ics_output_cache.expires_at`. A changed `LOGIC_VERSION`, date policy, or pinned academic year invalidates incompatible ICS cache rows without requiring deletion.
- **CalDAV fetch failures**
  - Validate credentials, inspect REPORT payload, and monitor retry logs. Sorbonne servers occasionally throttle.
- **Supabase outage**
  - Service falls back to in-memory store. Warn users that subscriptions created during downtime may need regeneration.
- **Unexpected CPU increase**
  - Ensure cache headers/TTL match the values above. Revert to a previous commit if a regression shortened caching intervals.

---

For domain-specific knowledge (firewall, contact emails, master lists) see `docs/domain-notes.md`. Major historical changes are summarised in `docs/changelog.md`.
