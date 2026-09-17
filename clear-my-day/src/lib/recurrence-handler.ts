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

  events.forEach((event) => {
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
      // Parse the RRULE with the original event start date as DTSTART
      // This ensures the correct day of the week is preserved
      const rruleOptions = RRule.parseString(event.rrule);
      rruleOptions.dtstart = event.start; // Use original event start date
      const rrule = new RRule(rruleOptions);
      
      // Calculate event duration
      const duration = event.end.getTime() - event.start.getTime();
      
      // Generate occurrences within the date range
      const occurrences = rrule.between(dateRange.start, dateRange.end, true);
      
      console.log(`Event ${event.title}: RRULE=${event.rrule}, Generated ${occurrences.length} occurrences`);
      console.log(`Original event time: ${event.start.toLocaleString()} (day: ${event.start.getDay()})`);
      
      occurrences.forEach((occurrenceStart, occurrenceIndex) => {
        // Preserve the original time of day from the event
        const originalHour = event.start.getHours();
        const originalMinute = event.start.getMinutes();
        const originalSecond = event.start.getSeconds();
        
        // Set the occurrence to the correct date but with original time
        const correctedStart = new Date(occurrenceStart);
        correctedStart.setHours(originalHour, originalMinute, originalSecond);
        
        const correctedEnd = new Date(correctedStart.getTime() + duration);
        
        // Debug first few occurrences
        if (occurrenceIndex < 3) {
          console.log(`  Occurrence ${occurrenceIndex}: ${correctedStart.toLocaleString()} (day: ${correctedStart.getDay()})`);
        }
        
        expandedEvents.push({
          id: `${event.id}-occurrence-${occurrenceIndex}`,
          title: event.title,
          start: correctedStart,
          end: correctedEnd,
          location: event.location,
          description: event.description,
          isRecurring: true,
          originalEventId: event.id,
          occurrenceIndex
        });
      });
      
    } catch {
      console.warn(`Failed to expand recurring event ${event.id}`);
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
  } catch {
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
