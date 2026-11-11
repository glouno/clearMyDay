# Personalised University Calendar Filter — One-Pager (PRD)

## Problem

University calendars bundle all courses, TD/TME groups, and even multiple Masters into a single feed. Students end up with:

- Overloaded agendas they can’t act on.
- Manual pruning (hiding events) that breaks as the source updates.
- No simple way to keep only their TD/TME group and a few cross-Master courses while staying “live”.

## Solution

A lightweight web app that lets a student pick sources and filters, then generates a private subscription URL (an `.ics` feed) showing only the classes they want.

- **Frontend**: clean wizard + calendar preview to choose Master(s), course(s), and TD/TME groups, with optional advanced rules (contains / regex).
- **Backend**: fetches the official calendars, filters events server-side, and serves a stable, tokenized `.ics` per user.
- **Live updates**: subscribers (Apple/Google/Outlook) poll the personal URL; changes upstream flow through automatically.

## Benefits

- **Clarity & focus**: only your classes appear—no noise.
- **Always up-to-date**: subscription refresh pulls changes from the official source.
- **Zero maintenance**: no manual editing; one URL works across devices.
- **Low cost, simple ops**: serverless-friendly; tiny bandwidth & compute.
- **Privacy-first**: no personal data in the feed URL; credentials never exposed.

---

## User Inputs (what we need from a student)

### Required
- **Selected calendar sources**  
  e.g., “M1 DAC” (and optionally others to cherry-pick single courses).
- **Group selection**  
  TD group (e.g., TD2), TME group (e.g., TME B).
- **Course selection**  
  Choose which courses to keep if not taking the full Master’s set.

### Useful / Optional
- **Filter rules**  
  Include/Exclude on: Course code, Professor name, Room, “contains” text; optional regex for power users.
- **Time window**  
  Default: rolling –30 to +365 days; user can change if needed.
- **Calendar name**  
  Friendly display name (e.g., “Paul — M1 DAC (TD2 + picks)”).
- **Timezone**  
  Default Europe/Paris; override if necessary.
- **Refresh hint**  
  Preferred refresh suggestion (15–60 minutes; clients may ignore).
- **Merge order & de-dupe policy**  
  If the same class appears in multiple sources.

---

## Core Requirements (MVP)

1. **Source ingestion**: fetch ICS export from official CalDAV/ICS endpoints; handle recurrence expansion; configurable time window.
2. **Filtering**: include/exclude by SUMMARY / DESCRIPTION / LOCATION / CATEGORIES; group detection heuristics (auto-suggest TD/TME groups).
3. **Personal feed**: generate tokenized, read-only `.ics` per user; set NAME, X-WR-CALNAME, and refresh hints.
4. **Calendar preview UI**: week/month view; shows only kept events; instant feedback when toggling filters.
5. **Security**: never expose upstream credentials in the public URL; server-side storage only; rotate/revoke token.
6. **Performance & reliability**: short upstream cache (e.g., 10–15 min), ETag/Last-Modified support; rate limiting.

---

## Non-Goals (MVP)

- Write/sync back to the university calendar (CalDAV server features).
- Account system beyond magic-link or simple email + token (nice-to-have later).
- Mobile apps (web is sufficient; calendars consume the URL).

---

## Architecture (concise)

- **Frontend**: Next.js (React) on Vercel; UI with React Big Calendar or FullCalendar core; Tailwind for speed.
- **Backend**: API routes on Vercel (TypeScript) or a tiny Python/FastAPI service; fetch official ICS via export, filter, emit `.ics`.
- **Storage**: Neon Postgres (feed configs) + Upstash Redis (caching).
- **Ops**: Vercel deploy; optional Vercel Cron to pre-warm caches.
- **Cost**: well within free tiers for a cohort-sized user base.

---

## Success Metrics

- **Setup time**: < 3 minutes from landing to usable subscription link.
- **Noise reduction**: ≥ 80% fewer events than the raw Master feed.
- **Reliability**: > 99.9% successful feed requests; median feed render < 500 ms.
- **Adoption**: % of users subscribing on ≥ 2 devices (Mac + phone).

---

## Risks & Mitigations

- **Slow client refresh** (e.g., Google Calendar) → Document client behaviors; recommend Apple/Outlook for faster polling; include refresh hints.
- **Naming variance** (TD2 vs Group 2) → Heuristics + user-editable patterns; preview to verify.
- **Upstream changes** (URL, auth) → Config versioning; health checks; graceful errors in UI.
- **Rate limits** → Cache upstream; dedupe concurrent fetches; per-user rate limits.

---

## Open Details (tell me your preferences)

- Which exact Masters and groups do you need day one?
- Any must-have fields for filtering beyond TD/TME (e.g., professor, campus, room)?
- Do you want advanced mode (regex) visible by default or tucked behind an “Advanced” toggle?
- Preferred branding/name for the generated calendar(s)?
- Do we need login (email magic link) or keep it token-only for MVP?

---

## Reference Links to the University Calendar

user: student.master
password: guest

- [Online Portal](https://cal.ufr-info-p6.jussieu.fr/master/)
- [M1 DAC CalDav](https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/DAC/M1_DAC)
- [M1 IMA CalDav](https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/IMA/M1_IMA)
- [M1 ANDROIDE CalDav](https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/ANDROIDE/M1_ANDROIDE)

**The modules which are interesting for us:**
In DAC:
- DALAS (group 5)
- LRC
- MLBDA (group 3)

In IMA:
- MAPSI (group 5)

In ANDROIDE:
- MOGPL

