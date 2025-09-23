// Recurrence handling utilities for calendar events

import { RRule } from 'rrule';

export interface RecurringEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  rrule?: string;
  location?: string;
  description?: string;
}

export interface ExpandedEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  location?: string;
  description?: string;
  isRecurring: boolean;
  originalEventId?: string;
  occurrenceIndex?: number;
}

/**
 * Expand recurring events based on RRULE within a date range
 */
export function expandRecurringEvents(
  events: RecurringEvent[],
  dateRange: { start: Date; end: Date }
): ExpandedEvent[] {
  const expandedEvents: ExpandedEvent[] = [];

  events.forEach((event, eventIndex) => {
    if (!event.rrule) {
      // Non-recurring event - add as-is if within date range
      if (event.start >= dateRange.start && event.start <= dateRange.end) {
        expandedEvents.push({
          ...event,
          isRecurring: false
        });
      }
      return;
    }

    try {
      // Parse the RRULE
      const rrule = RRule.fromString(event.rrule);
      
      // Calculate event duration
      const duration = event.end.getTime() - event.start.getTime();
      
      // Generate occurrences within the date range
      const occurrences = rrule.between(dateRange.start, dateRange.end, true);
      
      occurrences.forEach((occurrenceStart, occurrenceIndex) => {
        const occurrenceEnd = new Date(occurrenceStart.getTime() + duration);
        
        expandedEvents.push({
          id: `${event.id}-occurrence-${occurrenceIndex}`,
          title: event.title,
          start: occurrenceStart,
          end: occurrenceEnd,
          location: event.location,
          description: event.description,
          isRecurring: true,
          originalEventId: event.id,
          occurrenceIndex
        });
      });
      
    } catch (error) {
      console.warn(`Failed to expand recurring event ${event.id}:`, error);
      console.warn(`RRULE was: ${event.rrule}`);
      
      // Fallback: include the original event if it's within range
      if (event.start >= dateRange.start && event.start <= dateRange.end) {
        expandedEvents.push({
          ...event,
          isRecurring: false
        });
      }
    }
  });

  return expandedEvents.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Parse RRULE string and return human-readable description
 */
export function getRRuleDescription(rruleString: string): string {
  try {
    const rrule = RRule.fromString(rruleString);
    return rrule.toText();
  } catch (error) {
    return `Invalid recurrence rule: ${rruleString}`;
  }
}

/**
 * Validate if an RRULE string is valid
 */
export function isValidRRule(rruleString: string): boolean {
  try {
    RRule.fromString(rruleString);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the next N occurrences of a recurring event
 */
export function getNextOccurrences(
  event: RecurringEvent,
  count: number = 5,
  after: Date = new Date()
): Date[] {
  if (!event.rrule) {
    return event.start > after ? [event.start] : [];
  }

  try {
    const rrule = RRule.fromString(event.rrule);
    // Use between method to get multiple occurrences
    const endDate = new Date(after.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1 year from after date
    const occurrences = rrule.between(after, endDate, true);
    return occurrences.slice(0, count);
  } catch (error) {
    console.warn(`Failed to get next occurrences for event ${event.id}:`, error);
    return [];
  }
}
