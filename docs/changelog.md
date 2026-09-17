# Changelog

## 2026-09-08 — Academic-year-pinned subscriptions

- Pinned every generated subscription to an explicit academic year so a URL never silently replaces historical events with the next cohort's timetable.
- Made the default `All` window cover the complete September-to-September academic year.
- Preserved legacy tokens by inferring their academic year primarily from creation time; previously generated rolling tokens become pinned on first use after deployment.
- Included the pinned year in token deduplication and ICS cache identity, so the same selections in a new academic year receive a distinct URL.

## 2026-09-07 — Perennial academic windows and M2 filtering

- Replaced saved absolute-year behavior with rolling/S1/S2 policies resolved against the current Europe/Paris academic year.
- Added backward-compatible policy inference so legacy subscription tokens advance without a JSONB schema migration.
- Extended S1 through January 8 and kept a short S1/S2 overlap for transition events.
- Added M2 `UM5IN...` course/group recognition and automatic inclusion of common, ungrouped OIP lectures.
- Changed output cache identity and HTTP ETags to follow effective calendar semantics.
- Updated the M2 MIND course catalogue from `LMM` to the current `LLM` spelling.

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
