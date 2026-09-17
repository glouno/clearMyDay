# Course discovery (Option C)

This document explains how ClearMyDay discovers course/module codes dynamically from Sorbonne CalDAV events, and how to audit the extraction logic.

## Goals

- Keep the app **perennial**: future students shouldn’t need to manually update course lists every semester.
- Keep the app **safe**: dynamic discovery must be conservative and must not break filtering.
- Keep the app **portable**: works on Vercel, Azure, Coolify, or local hosting.

## Architecture

- **Hardcoded fallback** (always available):
  - `clear-my-day/src/lib/sorbonne-masters.ts` (`master.courses`)
- **Single source of truth for extraction**:
  - `clear-my-day/src/lib/course-extractor.ts`
- **Auditable discovery endpoint**:
  - `GET /api/course-catalog?sources=DAC` (or multiple sources)
  - returns per-course counts, sample summaries, and which extractor rule matched
- **Group detection / analysis**:
  - `GET /api/analyze-events?sources=DAC`
  - uses the same extractor so analysis is consistent with filtering

## What the Sorbonne summaries look like (real examples)

From the M1 DAC (MIND) source around 2026-01-19 → 2026-01-31:

- `UM4IN815-IDLE-Cours`
- `UM4IN815-IDLE-TD`
- `UM4IN815-IDLE-TME`
- `UM4IN806-IAMSI-Cours`
- `UM4IN806-IAMSI-TD1`
- `UM4IN806-IAMSI-TME2`
- `UM4IN811-ML-Cours`
- `UM4IN811-ML-TD2`
- `UM4IN811-ML-TME3`
- `UM4IN813-RITAL-Cours (reporté au 26/01)`
- `UM4IN803-SAM-TME`
- English:
  - `UM4LVAN2-Anglais`

## Extraction rules (regex / patterns)

Implemented in `clear-my-day/src/lib/course-extractor.ts`.

### Special cases

- **OIP**:
  - If `SUMMARY` contains `OIP` or `INOIP`, extracted course is `OIP`.
- **English**:
  - If `SUMMARY` contains `LVAN` or `anglais`, extracted course is `ANGLAIS`.

### Structured patterns

The extractor tries these patterns in order:

- `^4I\d+-(?:TD|TME)\d+-([A-Z]+)`
- `^MU4IN\d+-([A-Z]+)-`
- `^UM4IN\d+-([A-Z]+)-`
- `MU4IN\d+-([A-Z]+)-(?:TD|TME|Cours|ER)`
- `UM4IN\d+-([A-Z]+)-(?:TD|TME|Cours|ER)`

These patterns are designed to match course codes in the common Sorbonne formats.

### Fallback token extraction (conservative)

If none of the structured patterns match, the extractor may fall back to splitting the summary by `-` and taking a short ALL-CAPS token.

To reduce false positives, it:

- Only attempts fallback if the summary starts with `UM`, `MU`, or `4I`.
- Excludes common noise tokens (e.g. `UM`, `MU`, `IN`, `TD`, `TME`, `COURS`, `EXAM`, `SALLE`, etc.).

## How to audit discovery quality

### 1) Call the course catalog endpoint

Example:

- `GET /api/course-catalog?sources=DAC&minEvents=3`

Notes:

- `minEvents` defaults to `3` to avoid listing “one-off” noise.
- Response includes:
  - `matchedBy` counts (which rule matched)
  - `samples` (real SUMMARY strings)
  - `unknownSamples` (summaries where no course was extracted)

### 2) Compare against hardcoded fallback

The endpoint also returns `hardcodedCourses` for each master.

## Updating for future academic years

Usually you only need to:

- Update `course-extractor.ts` patterns if Sorbonne changes `SUMMARY` formats.
- Optionally tune `minEvents`.

The hardcoded lists remain as a safe fallback if discovery fails.
