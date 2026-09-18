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

RATE_LIMIT_REDIS_URL=...        # optional, falls back to in-memory limiter
NEXT_PUBLIC_APP_URL=https://www.clearmyday.com
```

---

## Supabase Schema Checklist

For a linked project, apply the versioned files in `supabase/migrations` with `supabase db push`. The standalone schema files document the initial tables for a new installation.

1. `supabase-calendar-tokens-schema.sql`
   - Creates `calendar_tokens` and `analyze_events_cache`.
   - Adds indexes to support lookup and cleanup queries.
2. `supabase-caldav-cache-schema.sql`
   - Creates `caldav_cache` with GIN index on `masters`.
   - Installs `cleanup_expired_caldav_cache()` helper function.
3. `supabase-ics-output-cache-schema.sql`
   - Creates `ics_output_cache`, keyed by subscription token.
Expired cache rows are removed automatically after a cache-miss write through the private `cleanup_expired_cache_rows()` RPC. The same maintenance pass deletes subscription tokens and generated ICS entries after 180 days without access. This avoids requiring `pg_cron` or exposing a maintenance route.

### Table Responsibilities

- `calendar_tokens`: Stores subscription metadata. A unique token is generated for each unique combination of a user's filter configuration and personalized calendar name.
- `analyze_events_cache`: 24-hour cache for current-academic-year group detection, keyed by cache version, academic year, and individual master.
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

- **HTTP headers:** 15-minute client freshness, 30-minute CDN freshness, and one-hour stale-while-revalidate.
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
  - Expired rows are cleaned on cache writes; investigate service-role/RPC errors if they continue to accumulate.
- **Synthetic checks:**
  - Optional: schedule `curl` against `/api/health` and a sample calendar URL to ensure 200/304 responses.

When miss frequency jumps, verify Sorbonne credentials and review `Attempt X failed for <master>` logs (the client retries 3 times with 1 s → 2 s → 4 s backoff).

---

## Routine Maintenance

- **Token hygiene:** Tokens are bearer credentials. Never log or publish them. The production retention policy removes them after 180 days without access.
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
