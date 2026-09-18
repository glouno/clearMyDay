const NOISE_TOKENS = new Set([
  'UM', 'MU', 'IN', 'TD', 'TME', 'TP', 'COURS', 'EXAM', 'EXAMEN',
  'SALLE', 'AMPHI', 'GROUPE', 'GROUP', 'GR'
]);

/** Extract the course code used in Sorbonne calendar summaries. */
export function extractCourseFromSummary(summary: string): string | null {
  if (!summary) return null;

  if (/\b(OIP|INOIP)\b/i.test(summary)) return 'OIP';
  if (/\bLVAN\b/i.test(summary) || /anglais/i.test(summary)) return 'ANGLAIS';

  // The unit identifier is not always numeric: quantum calendars use INQ/PYQ.
  const patterns = [
    /^4I\d+-(?:TD|TME)\d+-([A-Z][A-Z0-9_]*)/i,
    /^(?:MU|UM)\d+(?:IN|PY)[A-Z0-9]+-([A-Z][A-Z0-9_]*)/i
  ];

  for (const pattern of patterns) {
    const match = summary.match(pattern);
    if (match) return match[1].toUpperCase();
  }

  if (/^(?:UM|MU|4I)/i.test(summary)) {
    const candidates = summary.split('-')
      .map(token => token.trim())
      .filter(token => token.length >= 2
        && token.length <= 16
        && /^[A-Z][A-Z0-9_]*$/.test(token)
        && !NOISE_TOKENS.has(token));

    return candidates[0]?.toUpperCase() ?? null;
  }

  return null;
}
