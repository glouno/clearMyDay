export type CalendarWindowPolicy = 'academic-year' | 'semester-1' | 'semester-2';
export type LegacyCalendarWindowPolicy = CalendarWindowPolicy | 'rolling';

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

function parisDateParts(now: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const value = (type: string) => Number(parts.find(part => part.type === type)?.value);
  return { year: value('year'), month: value('month') - 1, day: value('day') };
}

export function currentAcademicYearStart(now: Date = new Date()): number {
  const { year, month } = parisDateParts(now);
  // getMonth-style values are zero-based; September is month 8.
  return month >= 8 ? year : year - 1;
}

export function dateRangeForPolicy(
  policy: CalendarWindowPolicy,
  academicYearStart: number
): { start: Date; end: Date } {
  if (policy === 'semester-1') {
    return {
      start: utcDay(academicYearStart, 8, 1),
      // Exclusive boundary: includes M1/M2 events through January 8.
      end: utcDay(academicYearStart + 1, 0, 9)
    };
  }

  if (policy === 'semester-2') {
    return {
      // Deliberate overlap with S1 for events around the semester transition.
      start: utcDay(academicYearStart + 1, 0, 1),
      end: utcDay(academicYearStart + 1, 8, 1)
    };
  }

  return {
    start: utcDay(academicYearStart, 8, 1),
    end: utcDay(academicYearStart + 1, 8, 1)
  };
}

export function inferLegacyDateRangePolicy(dateRange: {
  start: string | Date;
  end: string | Date;
}): CalendarWindowPolicy {
  const start = new Date(dateRange.start);
  const end = new Date(dateRange.end);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    return 'academic-year';
  }

  const durationDays = (end.getTime() - start.getTime()) / DAY_MS;
  const startMonth = start.getUTCMonth();
  const endMonth = end.getUTCMonth();

  if (startMonth === 8 && endMonth === 0 && durationDays <= 160) {
    return 'semester-1';
  }

  if (startMonth === 0 && endMonth === 6 && durationDays <= 220) {
    return 'semester-2';
  }

  return 'academic-year';
}

export function inferLegacyAcademicYearStart(
  dateRange: { start: string | Date; end: string | Date },
  createdAt: string | Date | undefined,
  now: Date = new Date()
): number {
  if (createdAt) {
    const created = new Date(createdAt);
    if (!isNaN(created.getTime())) {
      return currentAcademicYearStart(created);
    }
  }

  const start = new Date(dateRange.start);
  if (!isNaN(start.getTime()) && start.getUTCMonth() === 8) {
    return start.getUTCFullYear();
  }

  return currentAcademicYearStart(now);
}

export function resolveDateRange(
  policy: LegacyCalendarWindowPolicy | undefined,
  legacyDateRange: { start: string | Date; end: string | Date },
  academicYearStart: number | undefined,
  createdAt?: string | Date,
  now: Date = new Date()
): { policy: CalendarWindowPolicy; academicYearStart: number; start: Date; end: Date } {
  const effectivePolicy = !policy || policy === 'rolling'
    ? inferLegacyDateRangePolicy(legacyDateRange)
    : policy;
  const effectiveYear = Number.isInteger(academicYearStart)
    && academicYearStart! >= 2000
    && academicYearStart! <= 2100
    ? academicYearStart!
    : inferLegacyAcademicYearStart(legacyDateRange, createdAt, now);

  return {
    policy: effectivePolicy,
    academicYearStart: effectiveYear,
    ...dateRangeForPolicy(effectivePolicy, effectiveYear)
  };
}
