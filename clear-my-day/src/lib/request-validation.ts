import { SORBONNE_CALENDARS } from './constants';

type CalendarRequestBody = {
  name?: unknown;
  filter?: {
    masters?: unknown;
    courses?: unknown;
    courseGroups?: unknown;
    dateRange?: unknown;
  };
};

export function validateCalendarRequest(body: CalendarRequestBody): string | null {
  if (typeof body.name !== 'string' || body.name.trim().length === 0 || body.name.length > 100) {
    return 'Calendar name must contain between 1 and 100 characters';
  }

  if (!body.filter || !Array.isArray(body.filter.masters) || body.filter.masters.length === 0) {
    return 'At least one master program must be selected';
  }

  const allowedMasters = new Set(Object.keys(SORBONNE_CALENDARS));
  if (body.filter.masters.length > allowedMasters.size
    || body.filter.masters.some(master => typeof master !== 'string' || !allowedMasters.has(master))) {
    return 'One or more master programs are invalid';
  }

  if (!Array.isArray(body.filter.courses)
    || body.filter.courses.length > 100
    || body.filter.courses.some(course => typeof course !== 'string' || course.length > 64)) {
    return 'Courses must be a valid list of at most 100 course identifiers';
  }

  if (body.filter.courseGroups !== undefined
    && (typeof body.filter.courseGroups !== 'object' || body.filter.courseGroups === null || Array.isArray(body.filter.courseGroups))) {
    return 'Course groups must be an object';
  }

  if (!body.filter.dateRange || typeof body.filter.dateRange !== 'object') {
    return 'A date range is required';
  }

  return null;
}
