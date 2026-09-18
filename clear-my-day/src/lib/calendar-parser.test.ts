import { describe, expect, it } from 'vitest';
import { CalendarParser } from './calendar-parser';
import type { CalendarEvent, FilterConfig } from './types';

const range = {
  start: new Date('2026-09-01T00:00:00Z'),
  end: new Date('2027-09-01T00:00:00Z')
};

function filter(overrides: Partial<FilterConfig> = {}): FilterConfig {
  return {
    masters: ['DAC'],
    courses: ['DALAS'],
    groups: { td: '', tme: '' },
    courseGroups: {},
    dateRange: range,
    ...overrides
  };
}

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    uid: 'series-1',
    summary: 'UM4IN814-DALAS-Cours',
    start: new Date('2026-09-07T11:45:00Z'),
    end: new Date('2026-09-07T13:45:00Z'),
    ...overrides
  };
}

describe('calendar event filtering', () => {
  it('keeps selected courses and excludes other courses', () => {
    const parser = new CalendarParser();
    const result = parser.filterEvents([
      event(),
      event({ uid: 'other', summary: 'UM4IN800-LRC-Cours' })
    ], filter());
    expect(result.map(item => item.uid)).toEqual(['series-1']);
  });

  it('preserves EXDATE and recurrence overrides', () => {
    const parser = new CalendarParser();
    const originalOccurrence = new Date('2026-09-14T11:45:00Z');
    const result = parser.filterEvents([
      event({ rrule: 'FREQ=WEEKLY;COUNT=3', exdate: [originalOccurrence] }),
      event({
        recurrenceId: originalOccurrence,
        start: new Date('2026-09-15T11:45:00Z'),
        end: new Date('2026-09-15T13:45:00Z'),
        location: 'Moved room'
      })
    ], filter());

    expect(result).toHaveLength(2);
    expect(result[0].exdate?.map(date => date.toISOString())).toContain(originalOccurrence.toISOString());
    expect(result[1].rrule).toBeUndefined();
  });

  it('treats an unnumbered TD as group 1', () => {
    const parser = new CalendarParser();
    const td = event({ summary: 'UM4IN814-DALAS-TD' });
    expect(parser.filterEvents([td], filter({ courseGroups: { DALAS: '1' } }))).toHaveLength(1);
    expect(parser.filterEvents([td], filter({ courseGroups: { DALAS: '2' } }))).toHaveLength(0);
  });

  it('filters quantum course identifiers with non-numeric unit codes', () => {
    const parser = new CalendarParser();
    const quantum = event({ summary: 'UM5INQ01-QAlg-Cours' });
    expect(parser.filterEvents([quantum], filter({ courses: ['QALG'] }))).toHaveLength(1);
    expect(parser.filterEvents([quantum], filter({ courses: ['QCRYPT'] }))).toHaveLength(0);
  });
});
