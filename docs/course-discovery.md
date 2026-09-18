# Course catalogue and group detection

ClearMyDay deliberately separates the course catalogue shown in the UI from live group detection.

## Current behaviour

- `clear-my-day/src/lib/sorbonne-masters.ts` contains the curated course list for each master. `SimplifiedCalendarSelector.tsx` renders these lists.
- `GET /api/analyze-events?sources=DAC_M2` downloads the selected calendar and detects active course codes and TD/TME groups.
- Analysis is restricted to the current academic year (September through August), cached independently per source for 24 hours, and versioned by academic year.
- `clear-my-day/src/lib/course-extractor.ts` is shared by calendar filtering and analysis, so both paths interpret summaries consistently.

There is no `/api/course-catalog` endpoint and live analysis does not replace the curated UI catalogue. This is intentional: early in a semester, a live feed may not yet contain second-semester modules. The curated list provides continuity, while analysis supplies group choices only for events that currently exist.

## Supported title formats

Examples handled by the shared extractor include:

- `UM4IN814-DALAS-Cours` → `DALAS`
- `UM5INQ01-QAlg-Cours` → `QALG`
- `UM5PYQ03-QIT` → `QIT`
- `UM4LVAN2-Anglais` → `ANGLAIS`
- summaries containing `OIP` or `INOIP` → `OIP`

The quantum calendars are significant: their unit identifiers contain letters (`INQ`, `PYQ`) instead of the numeric `IN801` form used by many other calendars.

## Annual maintenance

At the start of an academic year:

1. Compare `sorbonne-masters.ts` with the official programme pages and current CalDAV feeds.
2. Call `/api/analyze-events` for each source and investigate unknown or unexpected course codes.
3. Add extractor tests before changing a parsing rule.
4. Keep valid second-semester modules even when they have not appeared in the September feed yet.

Use the official Sorbonne Master Informatique track list as the naming source of truth. Backend IDs such as `DAC_M2`, `ANDROIDE_M2`, `SFPN_M2`, and `IQ_M2` must remain stable because they identify CalDAV paths and saved filters; the website maps them to the modern labels MIND, AI2D, CCA, and QI.

Record the review date and evidence in the pull request. Compare three sets for every track: the curated catalog, the official curriculum, and course codes detected in the current academic-year feed. Add official-only modules when they are valid later-semester choices; investigate feed-only codes before adding them, since they may be aliases, shared courses, or extraction errors.

Do not infer that every historic code returned by an old feed is current. Before the 2026 hardening, analysis included all historical events and kept results for 90 days; this was the source of the stale M2 module list.
