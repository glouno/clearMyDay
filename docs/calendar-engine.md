# Calendar Engine: Architecture, Caching, and Analysis

This document details the core components of the ClearMyDay calendar engine, covering its architecture, caching strategies, and the methodology used for course and group analysis.

## System Architecture

The system is designed to fetch, filter, and serve personalized calendar data efficiently. It distinguishes between temporary UI previews and persistent calendar subscriptions to avoid database bloat.

### Data Flow

**Subscription Flow (Persistent Storage):**
```
User clicks "Generate Calendar"
→ /api/generate-calendar
→ Generate UUID token
→ Save to Supabase calendar_tokens table
→ Return subscription URL
→ Apple Calendar polls /api/calendar/[token]
→ Load config from Supabase
→ Fetch fresh events from Sorbonne (or CalDAV cache)
→ Update last_accessed timestamp
```

**Preview Flow (No Storage):**
```
User interacts with UI
→ /api/analyze-events (for group detection)
→ /api/preview-calendar (for the calendar preview)
→ Fetch from Sorbonne servers (or caches)
→ Return analysis/ICS directly (no token saved)
```

### API Endpoints

| Endpoint | Purpose | Storage | Usage |
|---|---|---|---|
| `/api/generate-calendar` | Creates persistent subscription URLs | Supabase | Finalizing a calendar | 
| `/api/calendar/[token]` | Serves the filtered ICS file | Reads from Supabase | Calendar clients (Apple, Google) |
| `/api/analyze-events` | Performs group and course detection | Caches results in Supabase | UI previews & course selection |
| `/api/health` | System health check | None | Monitoring |

## Event Selection Pipeline

1. **Fetch** raw VEVENTs via `caldav-client.ts` using a CalDAV REPORT limited to the current academic year plus the next one.
2. **Normalise** and parse with `node-ical`, preserving
   - UID
   - DTSTART/DTEND
   - RRULE
   - RECURRENCE-ID
   - EXDATE (stored as `exdate?: Date[]`).
3. **Filter** with `calendar-parser.ts`:
   - Date range (user-configured window, defaults around “today”).
   - Course list (unless the event is considered “general”).
   - TD/TME / per-course group selection (supports positive match and legacy negative filtering).
   - Custom include/exclude rules when provided.
4. **Expand recurrence** via `generateRecurrenceOccurrences()`:
   - Converts RRULEs into individual occurrences within the requested range.
   - Excludes dates in `exdate`.
   - Replaces occurrences equal to `RECURRENCE-ID` with the supplied exception event.
5. **Emit ICS** through `ics-generator.ts` with RFC 5545–compliant output and deterministic metadata (UID, DTSTAMP, Europe/Paris VTIMEZONE, ETag seed).

## General Event Detection

Certain institution‑wide events should bypass the course filter while still respecting group/date filters. `isGeneralEvent()` in `calendar-parser.ts` applies regex patterns for:

- SOI / Service Orientation et Insertion
- Career conferences (`Conférence Métiers`, `Journée Métiers`)
- Orientation meetings (`Réunion de rentrée`, `Assemblée générale`)
- Forum entreprise / information collective sessions

When a match is found the event is included regardless of selected courses, but remains subject to group/date/custom rules.

## OIP / INOIP Handling

OIP events behave like regular courses with master-specific variants. The parser:

- Detects OIP/INOIP in summaries (`extractCourseFromEvent()` returns `"OIP"`).
- Matches OIP group identifiers such as `OIP-AI2D-Gr2` (`matchesCourseGroup()` handles `Gr`, `Groupe`, TD/TME patterns).
- The course catalogue (`src/lib/sorbonne-masters.ts`) lists `"OIP"` for all relevant M2 masters; the UI displays variants as `OIP (MIND)`, `OIP (IMA)`, etc., to avoid confusion when multiple masters are selected.

## Recurrence & Exceptions

- RRULE parsing uses `rrule` to expand occurrences.
- Exceptions: if an event supplies `RECURRENCE-ID`, the parser substitutes the matching occurrence with that event.
- Cancelled occurrences are represented as exceptions with modified summaries (e.g., “séance annulée”).
- EXDATE entries prevent cancelled sessions from appearing when expanding RRULEs.

## ICS Output Characteristics

- `ics-generator.ts` writes `EXDATE;TZID=Europe/Paris` when exception dates exist.
- Exception events include `RECURRENCE-ID;TZID=Europe/Paris`.
- RRULE strings are cleaned and converted to local time without embedded DTSTART directives to maximise Apple/Google compatibility.
- ETags are derived from semantic ICS content (excluding volatile generation timestamps); combined with HTTP cache headers they enable efficient 304 responses.

## Related Files

- `src/lib/caldav-client.ts`
- `src/lib/calendar-parser.ts`
- `src/lib/ics-generator.ts`
- `src/lib/sorbonne-masters.ts`
- `src/app/api/calendar/[token]/route.ts`

---

## Caching Strategies

The system employs a multi-layered caching strategy to ensure high performance and minimize load on the Sorbonne CalDAV servers.

### 1. CalDAV Response Cache (`caldav_cache`)

- **Purpose**: To avoid repeatedly fetching and parsing the full 4,600+ event calendars from Sorbonne's servers.
- **Mechanism**: The first time a combination of masters (e.g., `DAC,IMA`) is requested, the parsed events are stored in a Supabase table (`caldav_cache`). The cache key is derived from the sorted list of masters (`caldav-DAC-IMA`).
- **TTL**: 6 hours. This is a balance between reducing CPU load and ensuring moderately fresh data.
- **Benefit**: Subsequent requests for the same master combination hit this cache, reducing response time from ~10-30 seconds to under 500ms and dramatically cutting Vercel CPU usage.

### 2. Group Analysis Cache (`analyze_events_cache`)

- **Purpose**: To cache the results of the `/api/analyze-events` endpoint, which detects available TD/TME groups.
- **Mechanism**: Each master's current-academic-year analysis is cached **independently** with a versioned key (for example `analyze-events-v4-2026-DAC`). When multiple masters are requested, the system fetches only the uncached ones and merges the results.
- **TTL**: 24 hours. Timetables and group labels can change during a semester.
- **Benefit**: Provides instantaneous group detection in the UI for almost all user interactions after the first visit.

### 3. HTTP Caching (Client & CDN)

- **Mechanism**: The `/api/calendar/[token]` endpoint returns `Cache-Control` and `ETag` headers.
- **Headers**: `Cache-Control: public, max-age=900, s-maxage=1800, stale-while-revalidate=3600`.
- **ETag**: A truncated SHA-256 hash of semantic ICS content.
- **Benefit**: Calendar clients and Vercel's Edge Network cache the final ICS file. If a user's configuration hasn't changed, the server returns a `304 Not Modified` response, saving bandwidth and compute.

---

## Course & Group Analysis Methodology

The system relies on structured data within event titles to detect active courses and groups. The course choices displayed by the UI remain curated in `sorbonne-masters.ts`, because a live feed early in the year may not contain later-semester modules.

### Title Parsing
A typical Sorbonne event title follows a pattern:
`UM4IN814-DALAS-Cours (R) TD 5`

The parser uses regex to extract:
- **Course Code**: `DALAS`
- **Event Type**: `Cours`
- **Group**: `TD 5`

### Course Discovery
The `/api/analyze-events` endpoint uses this parsing to perform a statistical analysis on a given master's calendar. This data-driven approach allows the UI to present a list of relevant, active courses and their available groups, which is more reliable than a static list.

1.  **Count Events**: It aggregates the number of events associated with each extracted course code.
2.  **Filter Noise**: It discards codes with very few events (<5), generic names (`TD`, `TME`, `EXAM`), or patterns that look like professor names.
3.  **Identify Groups**: It collects all unique TD/TME groups found for each valid course.

The results are restricted to the current academic year and cached for 24 hours. Filtering and analysis share `course-extractor.ts`, including support for quantum-calendar identifiers such as `UM5INQ01` and `UM5PYQ03`.

### Future Generalization

Supporting arbitrary CalDAV sources would require a separate trust, validation, and extraction design. The current endpoint accepts only configured Sorbonne sources.
