export const COURSE_EXTRACTION_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: '4I_TD_TME_SUFFIX', regex: /^4I\d+-(?:TD|TME)\d+-([A-Z]+)/i },
  { name: 'MU4IN_PREFIX', regex: /^MU4IN\d+-([A-Z]+)-/i },
  { name: 'UM4IN_PREFIX', regex: /^UM4IN\d+-([A-Z]+)-/i },
  { name: 'MU4IN_INFIX', regex: /MU4IN\d+-([A-Z]+)-(?:TD|TME|Cours|ER)/i },
  { name: 'UM4IN_INFIX', regex: /UM4IN\d+-([A-Z]+)-(?:TD|TME|Cours|ER)/i }
];

export function extractCourseFromSummaryDetailed(summary: string): { course: string | null; matchedBy: string | null } {
  if (!summary) return { course: null, matchedBy: null };

  if (/\b(OIP|INOIP)\b/i.test(summary)) {
    return { course: 'OIP', matchedBy: 'OIP_KEYWORD' };
  }

  if (/\bLVAN\b/i.test(summary) || /anglais/i.test(summary)) {
    return { course: 'ANGLAIS', matchedBy: 'ANGLAIS_LVAN' };
  }

  for (const entry of COURSE_EXTRACTION_PATTERNS) {
    const match = summary.match(entry.regex);
    if (match) {
      return { course: match[1].toUpperCase(), matchedBy: entry.name };
    }
  }

  if (!/^(?:UM|MU|4I)/i.test(summary)) {
    return { course: null, matchedBy: null };
  }

  const excludeTokens = new Set([
    'UM',
    'MU',
    'TD',
    'TME',
    'TP',
    'COURS',
    'EXAM',
    'EXAMEN',
    'SALLE',
    'AMPHI',
    'GROUPE',
    'GROUP',
    'GR'
  ]);

  const candidates = summary
    .split(/[^A-Z]+/)
    .map(t => t.trim())
    .filter(t => t.length >= 2 && t.length <= 10)
    .filter(t => /^[A-Z]{2,10}$/.test(t))
    .filter(t => !excludeTokens.has(t));

  if (candidates.length > 0) {
    return { course: candidates[0].toUpperCase(), matchedBy: 'FALLBACK_TOKEN' };
  }

  return { course: null, matchedBy: null };
}

export function extractCourseFromSummary(summary: string): string | null {
  return extractCourseFromSummaryDetailed(summary).course;
}
