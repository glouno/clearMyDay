import { describe, expect, it } from 'vitest';
import { validateCalendarRequest } from './request-validation';

const validBody = {
  name: 'My calendar',
  filter: {
    masters: ['DAC'],
    courses: ['DALAS'],
    courseGroups: {},
    dateRange: { start: '2026-09-01', end: '2027-09-01' }
  }
};

describe('calendar request validation', () => {
  it('accepts a normal calendar request', () => {
    expect(validateCalendarRequest(validBody)).toBeNull();
  });

  it('rejects unknown upstream sources', () => {
    expect(validateCalendarRequest({
      ...validBody,
      filter: { ...validBody.filter, masters: ['attacker-controlled-source'] }
    })).toMatch(/invalid/);
  });

  it('rejects oversized names and course lists', () => {
    expect(validateCalendarRequest({ ...validBody, name: 'x'.repeat(101) })).toMatch(/100/);
    expect(validateCalendarRequest({
      ...validBody,
      filter: { ...validBody.filter, courses: Array.from({ length: 101 }, (_, i) => `C${i}`) }
    })).toMatch(/100/);
  });
});
