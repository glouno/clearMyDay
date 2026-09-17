#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { spawnSync } from 'child_process';

const require = createRequire(import.meta.url);
const ical = require('../clear-my-day/node_modules/node-ical');
const { rrulestr } = require('../clear-my-day/node_modules/rrule');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const mastersFile = path.join(repoRoot, 'clear-my-day', 'src', 'lib', 'sorbonne-masters.ts');
const cacheDir = path.join(repoRoot, 'test', '.cache');

const DEFAULT_CALDAV_USER = process.env.CALDAV_USERNAME || 'student.master';
const DEFAULT_CALDAV_PASS = process.env.CALDAV_PASSWORD || 'guest';
const FETCH_TIMEOUT_MS = 30000;

function usage() {
  console.log(`\nUsage:
  node test/calendar-audit.mjs --url <calendarUrl> --masters DAC [--start YYYY-MM-DD] [--end YYYY-MM-DD] [--fresh]

Options:
  --url             ClearMyDay calendar subscription URL
  --masters         Comma-separated master IDs
  --start           Audit range start (YYYY-MM-DD or ISO)
  --end             Audit range end (YYYY-MM-DD or ISO)
  --fresh           Re-download source and output ICS files
  --caldav-user     Override CalDAV username
  --caldav-pass     Override CalDAV password
`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      args[key] = true;
      i -= 1;
      continue;
    }
    args[key] = value;
    i += 0;
  }
  return args;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function parseDateInput(input) {
  if (!input) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${input}`);
  }
  return date;
}

function formatParis(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);

  const value = (type) => parts.find(part => part.type === type)?.value || '';
  return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}`;
}

function normalizeSummary(summary) {
  return summary.replace(/\s+/g, ' ').trim();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractCourseFromSummary(summary) {
  if (!summary) return null;

  if (/\b(OIP|INOIP)\b/i.test(summary)) return 'OIP';
  if (/\bLVAN\b/i.test(summary) || /anglais/i.test(summary)) return 'ANGLAIS';

  const patterns = [
    /^4I\d+-(?:TD|TME)\d+-([A-Z]+)/i,
    /^(?:MU|UM)\d+IN\d+-([A-Z]+)-/i,
    /(?:MU|UM)\d+IN\d+-([A-Z]+)-(?:TD|TME|Cours|ER)/i
  ];

  for (const pattern of patterns) {
    const match = summary.match(pattern);
    if (match) return match[1].toUpperCase();
  }

  if (/^(?:UM|MU|4I)/i.test(summary)) {
    const excludeTokens = new Set(['UM', 'MU', 'IN', 'TD', 'TME', 'TP', 'COURS', 'EXAM', 'EXAMEN', 'SALLE', 'AMPHI', 'GROUPE', 'GROUP', 'GR']);
    const candidates = summary.split('-')
      .map(t => t.trim())
      .filter(t => t.length >= 2 && t.length <= 10 && /^[A-Z]{2,10}$/.test(t) && !excludeTokens.has(t));

    if (candidates.length > 0) return candidates[0].toUpperCase();
  }

  return null;
}

function matchesCourses(event, courses) {
  if (!courses || courses.length === 0) return true;
  const extracted = extractCourseFromSummary(event.summary || '');
  if (extracted) {
    return courses.some(course => course.toUpperCase() === extracted);
  }

  const text = `${event.summary || ''} ${event.description || ''}`.toLowerCase();
  return courses.some(course => {
    const pattern = new RegExp(`\\b${escapeRegex(course.toLowerCase())}\\b`);
    return pattern.test(text);
  });
}

function isGeneralEvent(event) {
  const summary = (event.summary || '').toLowerCase();
  const description = (event.description || '').toLowerCase();
  const eventText = `${summary} ${description}`;
  const isCommonOipEvent = extractCourseFromSummary(event.summary || '') === 'OIP'
    && /\b(cours|amphi|information)\b/i.test(eventText)
    && !/\b(td|tme)\s*\d*\b|\bgr(?:oupe)?\s*\d+/i.test(eventText);
  const patterns = [
    /\bsoi\b/i,
    /service.*orientation/i,
    /insertion.*professionnelle/i,
    /conf(?:e|\\u00e9)rence.*m(?:e|\\u00e9)tiers/i,
    /r(?:e|\\u00e9)union.*rentr(?:e|\\u00e9)e/i,
    /rentr(?:e|\\u00e9)e\\s+(m1|m2|master)/i,
    /assembl(?:e|\\u00e9)e.*g(?:e|\\u00e9)n(?:e|\\u00e9)rale/i,
    /\bag\b.*m1|m1.*\bag\b/i,
    /\bag\b.*m2|m2.*\bag\b/i,
    /forum.*entreprise/i,
    /journ(?:e|\\u00e9)e.*m(?:e|\\u00e9)tier/i,
    /pr(?:e|\\u00e9)sentation.*master/i,
    /information.*collective/i
  ];
  return isCommonOipEvent || patterns.some(pattern => pattern.test(eventText));
}

function matchesCourseGroup(summary, groupNumber) {
  const tdPattern = new RegExp('(?:^4I\\d+-TD|(?:MU|UM)\\d+IN(?:\\d+|OIP)-.*-TD|\\bTD\\s*)(\\d+)(?![0-9])', 'i');
  const tmePattern = new RegExp('(?:^4I\\d+-TME|(?:MU|UM)\\d+IN(?:\\d+|OIP)-.*-TME|\\bTME\\s*)(\\d+)(?![0-9])', 'i');
  const oipGroupPattern = /(?:OIP.*-Gr|Groupe\s*)(\d+)/i;
  const unnumberedTdPattern = /(?:^4I\d+-TD|(?:MU|UM)\d+IN(?:\d+|OIP)-.*-TD|\bTD)(?![0-9])/i;
  const unnumberedTmePattern = /(?:^4I\d+-TME|(?:MU|UM)\d+IN(?:\d+|OIP)-.*-TME|\bTME)(?![0-9])/i;

  const tdMatch = summary.match(tdPattern);
  const tmeMatch = summary.match(tmePattern);
  const oipMatch = summary.match(oipGroupPattern);

  if (tdMatch) return tdMatch[1] === groupNumber;
  if (tmeMatch) return tmeMatch[1] === groupNumber;
  if (oipMatch) return oipMatch[1] === groupNumber;

  if (groupNumber === '1') {
    if (unnumberedTdPattern.test(summary) && !tdMatch) return true;
    if (unnumberedTmePattern.test(summary) && !tmeMatch) return true;
  } else {
    if (unnumberedTdPattern.test(summary) && !tdMatch) return false;
    if (unnumberedTmePattern.test(summary) && !tmeMatch) return false;
  }

  return true;
}

function shouldIncludeEvent(summary, groups) {
  if ((!groups.td || groups.td === '') && (!groups.tme || groups.tme === '')) {
    return true;
  }

  if (groups.td && groups.td !== '') {
    const otherTdPattern = new RegExp('(?:^4I\\d+-TD|(?:MU|UM)\\d+IN(?:\\d+|OIP)-.*-TD|\\bTD\\s*)(\\d+)(?![0-9])', 'i');
    const tdMatch = summary.match(otherTdPattern);

    if (tdMatch && tdMatch[1] !== groups.td) return false;

    const unnumberedTdPattern = /(?:^4I\d+-TD|(?:MU|UM)\d+IN(?:\d+|OIP)-.*-TD|\bTD)(?![0-9])/i;
    if (!tdMatch && unnumberedTdPattern.test(summary) && groups.td !== '1') return false;
  }

  if (groups.tme && groups.tme !== '') {
    const otherTmePattern = new RegExp('(?:^4I\\d+-TME|(?:MU|UM)\\d+IN(?:\\d+|OIP)-.*-TME|\\bTME\\s*)(\\d+)(?![0-9])', 'i');
    const tmeMatch = summary.match(otherTmePattern);

    if (tmeMatch && tmeMatch[1] !== groups.tme) return false;

    const unnumberedTmePattern = /(?:^4I\d+-TME|(?:MU|UM)\d+IN(?:\d+|OIP)-.*-TME|\bTME)(?![0-9])/i;
    if (!tmeMatch && unnumberedTmePattern.test(summary) && groups.tme !== '1') return false;
  }

  return true;
}

function matchesGroups(event, filter) {
  const summary = event.summary || '';
  const courseId = extractCourseFromSummary(summary);

  if (filter?.courseGroups && courseId && filter.courseGroups[courseId]) {
    return matchesCourseGroup(summary, filter.courseGroups[courseId]);
  }

  const globalGroups = filter?.groups || { td: '', tme: '' };
  if ((!globalGroups.td || globalGroups.td === '') && (!globalGroups.tme || globalGroups.tme === '')) {
    return true;
  }

  return shouldIncludeEvent(summary, globalGroups);
}

function passesFilter(event, filter) {
  if (!filter) return true;
  const general = isGeneralEvent(event);
  if (filter.courses?.length && !general && !matchesCourses(event, filter.courses)) {
    return false;
  }
  if (!matchesGroups(event, filter)) {
    return false;
  }
  return true;
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function getExdates(exdate) {
  if (!exdate) return new Set();
  const values = Array.isArray(exdate) ? exdate : (typeof exdate === 'object' ? Object.values(exdate) : [exdate]);
  const set = new Set();
  values.forEach(value => {
    const date = toDate(value);
    if (date) set.add(date.getTime());
  });
  return set;
}

function isCancelledException(event) {
  const text = `${event.summary || ''} ${event.description || ''}`.toLowerCase();
  return /annul(?:e|\\u00e9)e/.test(text);
}

function inRange(date, range) {
  return date >= range.start && date <= range.end;
}

function collectOccurrences(parsedData, range, filter) {
  const occurrences = [];

  Object.values(parsedData).forEach(entry => {
    if (!entry || entry.type !== 'VEVENT') return;
    if (!entry.summary || !entry.start || !entry.end) return;

    if (!passesFilter(entry, filter)) return;

    const start = toDate(entry.start);
    if (!start) return;

    if (!entry.rrule) {
      if (inRange(start, range)) {
        occurrences.push({ summary: entry.summary, start, uid: entry.uid || 'n/a', source: 'single' });
      }
      return;
    }

    let rule;
    try {
      if (typeof entry.rrule === 'string') {
        rule = rrulestr(entry.rrule, { dtstart: start });
      } else {
        rule = rrulestr(entry.rrule.toString(), { dtstart: start });
      }
    } catch {
      if (inRange(start, range)) {
        occurrences.push({ summary: entry.summary, start, uid: entry.uid || 'n/a', source: 'rrule-fallback' });
      }
      return;
    }

    const exdates = getExdates(entry.exdate);
    const exceptions = entry.recurrences ? Object.values(entry.recurrences) : [];
    const exceptionIds = new Set();
    exceptions.forEach(exception => {
      const recId = toDate(exception.recurrenceid || exception.recurrenceId || exception.start);
      if (recId) exceptionIds.add(recId.getTime());
    });

    const between = rule.between(range.start, range.end, true);
    between.forEach(occurrence => {
      const timestamp = occurrence.getTime();
      if (exdates.has(timestamp)) return;
      if (exceptionIds.has(timestamp)) return;
      occurrences.push({ summary: entry.summary, start: occurrence, uid: entry.uid || 'n/a', source: 'rrule' });
    });

    exceptions.forEach(exception => {
      if (isCancelledException(exception)) return;
      const excStart = toDate(exception.start || exception.recurrenceid);
      if (!excStart || !inRange(excStart, range)) return;
      occurrences.push({
        summary: exception.summary || entry.summary,
        start: excStart,
        uid: exception.uid || entry.uid || 'n/a',
        source: 'exception'
      });
    });
  });

  return occurrences;
}

function buildKey(occurrence) {
  const summary = normalizeSummary(occurrence.summary || '').toUpperCase();
  return `${summary}|${formatParis(occurrence.start)}`;
}

function extractUrlsFromMasters(masterIds) {
  const content = fs.readFileSync(mastersFile, 'utf8');
  const urls = {};
  masterIds.forEach(masterId => {
    const escaped = masterId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b\\s*:\\s*{[\\s\\S]*?\\burl\\s*:\\s*'([^']+)'`, 'm');
    const match = content.match(regex);
    if (!match) {
      throw new Error(`Could not find URL for master '${masterId}' in sorbonne-masters.ts`);
    }
    urls[masterId] = match[1];
  });
  return urls;
}

function getAuthFromUrl(url, fallbackUser, fallbackPass) {
  try {
    const parsed = new URL(url);
    if (parsed.username && parsed.password) {
      return { user: parsed.username, pass: parsed.password, url: `${parsed.protocol}//${parsed.host}${parsed.pathname}` };
    }
  } catch {
    // Ignore invalid URL - handled by fetch
  }
  return { user: fallbackUser, pass: fallbackPass, url };
}

async function fetchToFile(url, dest, auth, fresh) {
  if (!fresh && fs.existsSync(dest)) {
    return dest;
  }

  const headers = {};
  if (auth?.user && auth?.pass) {
    headers.Authorization = `Basic ${Buffer.from(`${auth.user}:${auth.pass}`).toString('base64')}`;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) {
      clearTimeout(timeoutId);
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }
    const data = await response.text();
    clearTimeout(timeoutId);
    fs.writeFileSync(dest, data);
    return dest;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`Fetch failed for ${url} (${reason}); falling back to curl.`);
    const authArg = auth?.user && auth?.pass ? [`-u`, `${auth.user}:${auth.pass}`] : [];
    const result = spawnSync('curl', [
      '-fsS',
      '--max-time', String(Math.ceil(FETCH_TIMEOUT_MS / 1000)),
      '--connect-timeout', '8',
      ...authArg,
      url,
      '-o', dest
    ], { stdio: 'pipe' });

    if (result.status !== 0) {
      const stderr = result.stderr ? String(result.stderr) : '';
      throw new Error(`Failed to fetch ${url} (fetch error: ${reason}, curl status: ${result.status}) ${stderr}`);
    }
  }
  return dest;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args['--help'] || args['--h']) {
    usage();
    process.exit(0);
  }

  const url = args['--url'];
  const mastersArg = args['--masters'];
  const startArg = args['--start'];
  const endArg = args['--end'];
  const fresh = !!args['--fresh'];
  const caldavUser = args['--caldav-user'] || DEFAULT_CALDAV_USER;
  const caldavPass = args['--caldav-pass'] || DEFAULT_CALDAV_PASS;

  if (!url) {
    usage();
    throw new Error('Missing --url');
  }

  ensureDir(cacheDir);

  const masters = mastersArg?.split(',').map(item => item.trim()).filter(Boolean) || [];
  const calendarUrl = url;

  if (!calendarUrl) {
    throw new Error('Missing calendar URL');
  }

  if (!masters.length) {
    throw new Error('No masters provided. Use --masters.');
  }

  const startDate = parseDateInput(startArg);
  const endDate = parseDateInput(endArg);

  if (!startDate || !endDate) {
    throw new Error('Missing --start or --end');
  }

  if (startDate >= endDate) {
    throw new Error('Start date must be before end date');
  }

  const range = { start: startDate, end: endDate };

  console.log('Calendar audit settings:');
  console.log(`- Calendar URL: ${calendarUrl}`);
  console.log(`- Masters: ${masters.join(', ')}`);
  console.log(`- Audit range: ${startDate.toISOString()} -> ${endDate.toISOString()}`);
  console.log('');

  const masterUrls = extractUrlsFromMasters(masters);
  const sourceFiles = [];
  for (const master of masters) {
    const rawUrl = masterUrls[master];
    const auth = getAuthFromUrl(rawUrl, caldavUser, caldavPass);
    const dest = path.join(cacheDir, `source-${master}.ics`);
    console.log(`Fetching source ICS for ${master}...`);
    const filePath = await fetchToFile(auth.url, dest, auth, fresh);
    sourceFiles.push(filePath);
    console.log(`- Saved ${filePath}`);
  }

  const outputPath = path.join(cacheDir, `clearmyday-${token || 'manual'}.ics`);
  console.log('Fetching ClearMyDay ICS...');
  await fetchToFile(calendarUrl, outputPath, null, fresh);
  console.log(`- Saved ${outputPath}`);
  console.log('');

  const sourceParsed = {};
  for (const file of sourceFiles) {
    const data = fs.readFileSync(file, 'utf8');
    const parsed = ical.parseICS(data);
    Object.assign(sourceParsed, parsed);
  }

  const outputParsed = ical.parseICS(fs.readFileSync(outputPath, 'utf8'));

  const filteredSourceOccurrences = collectOccurrences(sourceParsed, range, filter);
  const outputOccurrences = collectOccurrences(outputParsed, range, null);

  const sourceMap = new Map();
  filteredSourceOccurrences.forEach(item => sourceMap.set(buildKey(item), item));
  const outputMap = new Map();
  outputOccurrences.forEach(item => outputMap.set(buildKey(item), item));

  const missingKeys = Array.from(sourceMap.keys()).filter(key => !outputMap.has(key));
  const extraKeys = Array.from(outputMap.keys()).filter(key => !sourceMap.has(key));

  console.log(`Source occurrences (filtered): ${filteredSourceOccurrences.length}`);
  console.log(`Output occurrences: ${outputOccurrences.length}`);
  console.log(`Missing occurrences: ${missingKeys.length}`);
  console.log(`Extra occurrences: ${extraKeys.length}`);
  console.log('');

  if (missingKeys.length) {
    console.log('Missing occurrences (source -> output):');
    missingKeys
      .map(key => sourceMap.get(key))
      .sort((a, b) => a.start - b.start)
      .forEach(item => {
        console.log(`- ${formatParis(item.start)} | ${normalizeSummary(item.summary)} | ${item.uid}`);
      });
    console.log('');
  }

  if (extraKeys.length) {
    console.log('Extra occurrences (output not in source):');
    extraKeys
      .map(key => outputMap.get(key))
      .sort((a, b) => a.start - b.start)
      .forEach(item => {
        console.log(`- ${formatParis(item.start)} | ${normalizeSummary(item.summary)} | ${item.uid}`);
      });
    console.log('');
  }

  if (missingKeys.length || extraKeys.length) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
