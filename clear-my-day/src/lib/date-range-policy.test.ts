import { describe, expect, it } from 'vitest';
import { currentAcademicYearStart, dateRangeForPolicy, resolveDateRange } from './date-range-policy';

describe('academic calendar windows', () => {
  it('does not roll into the next academic year during August', () => {
    expect(currentAcademicYearStart(new Date('2026-08-31T12:00:00Z'))).toBe(2025);
  });

  it('rolls into the next academic year in September', () => {
    expect(currentAcademicYearStart(new Date('2026-09-01T12:00:00Z'))).toBe(2026);
  });

  it('uses an exclusive September boundary for a full academic year', () => {
    const range = dateRangeForPolicy('academic-year', 2026);
    expect(range.start.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(range.end.toISOString()).toBe('2027-09-01T00:00:00.000Z');
  });

  it('keeps explicitly pinned subscriptions on their academic year', () => {
    const range = resolveDateRange(
      'academic-year',
      { start: '2025-09-01', end: '2026-09-01' },
      2025,
      undefined,
      new Date('2027-01-01T00:00:00Z')
    );
    expect(range.academicYearStart).toBe(2025);
  });
});
