# Changelog

This file consolidates notable fixes and architectural changes. Each entry lists the date, focus area, and key files touched.

---

## 2025-10-23 — Recurring events & cache security
- Fixed `RECURRENCE-ID` / `EXDATE` handling in `calendar-parser.ts`, `ics-generator.ts`, and `caldav-client.ts`.
- Confirmed 6-hour Supabase CalDAV cache strategy; removed public cache invalidation endpoint to prevent abuse.
- Updated documentation (`clear-my-day/README.md`, `docs/operations.md`).

## 2025-10-14 — Performance & UX polish
- Added middleware traffic logging and deferred group detection to keep initial load fast (`SimplifiedCalendarSelector.tsx`, `middleware.ts`).
- Regenerated favicon assets and ensured OIP course coverage (`calendar-parser.ts`, `sorbonne-masters.ts`).

## 2025-10-06 — General events inclusion
- Added pattern-based general event detection so SOI/conference events bypass course filtering while respecting dates/groups (`calendar-parser.ts`).

## 2025-10-05 — CalDAV caching & academic year window
- Extended CalDAV cache TTL to 6 hours; limited CalDAV REPORT requests to current + next academic year (`caldav-client.ts`, `/api/calendar/[token]/route.ts`).

## 2025-10-02 — CPU optimisation & deduplication
- Implemented HTTP caching + ETags, Supabase-backed CalDAV cache, and debounce for group detection (`/api/calendar/[token]/route.ts`, `SimplifiedCalendarSelector.tsx`).
- Added hash-based token deduplication in Supabase schema scripts.
