// Calendar parsing and filtering logic

import { CalendarEvent, FilterConfig, GroupDetectionResult } from './types';
import { GROUP_PATTERNS, COURSE_PATTERNS, APP_CONFIG } from './constants';
import { RRule } from 'rrule';

export class CalendarParser {
  /**
   * Filter events based on the provided configuration
   */
  filterEvents(events: CalendarEvent[], filter: FilterConfig): CalendarEvent[] {
    return events.filter(event => {
      // Date range filter
      if (!this.isEventInDateRange(event, filter.dateRange)) {
        return false;
      }

      // Course filter - only apply if courses are specified
      if (filter.courses.length > 0 && !this.matchesCourses(event, filter.courses)) {
        return false;
      }

      // Group filter - only apply if groups are specified
      if (!this.matchesGroups(event, filter)) {
        return false;
      }

      // Custom rules filter
      if (filter.customRules && !this.matchesCustomRules(event, filter.customRules)) {
        return false;
      }

      // If no specific filters, include all academic events (exclude holidays, etc.)
      if (filter.courses.length === 0 && !filter.groups.td && !filter.groups.tme) {
        return this.isAcademicEvent(event);
      }

      return true;
    });
  }

  /**
   * Check if event is academic (not holiday, administrative, etc.)
   */
  private isAcademicEvent(event: CalendarEvent): boolean {
    const summary = event.summary.toLowerCase();
    
    // Exclude holidays and non-academic events
    const excludePatterns = [
      /férié/i,
      /congé/i,
      /vacances/i,
      /holiday/i
    ];
    
    if (excludePatterns.some(pattern => pattern.test(summary))) {
      return false;
    }
    
    // Include events with course codes or academic keywords
    const academicPatterns = [
      /4I\d+/i,           // Old format: 4I801, 4I802, etc.
      /MU4IN\d+/i,        // New format: MU4IN801, etc.
      /UM4IN\d+/i,        // Alternative format
      /td\d+/i,           // TD sessions
      /tme\d+/i,          // TME sessions
      /cours/i,           // Courses
      /examen/i,          // Exams
      /controle/i,        // Tests
      /projet/i,          // Projects
      /conference/i,      // Conferences
      /seminaire/i        // Seminars
    ];
    
    return academicPatterns.some(pattern => pattern.test(summary));
  }

  /**
   * Check if event falls within the specified date range
   */
  private isEventInDateRange(event: CalendarEvent, dateRange: { start: Date; end: Date }): boolean {
    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);
    
    // Event overlaps with date range if:
    // - Event starts before range ends AND
    // - Event ends after range starts
    return eventStart < dateRange.end && eventEnd > dateRange.start;
  }

  /**
   * Check if event matches any of the specified courses
   */
  private matchesCourses(event: CalendarEvent, courses: string[]): boolean {
    const eventText = `${event.summary} ${event.description || ''}`.toLowerCase();
    
    return courses.some(course => {
      const pattern = COURSE_PATTERNS[course as keyof typeof COURSE_PATTERNS];
      if (pattern) {
        return pattern.test(eventText);
      }
      
      // Fallback to simple string matching
      return eventText.includes(course.toLowerCase());
    });
  }

  /**
   * Check if event should be included based on course group filtering
   */
  private matchesGroups(event: CalendarEvent, filter: FilterConfig): boolean {
    const eventText = `${event.summary} ${event.description || ''}`;
    
    // Extract course from event summary
    const courseId = this.extractCourseFromEvent(event);
    
    // Check course-specific groups first
    if (filter.courseGroups && courseId && filter.courseGroups[courseId]) {
      const groupNumber = filter.courseGroups[courseId];
      return this.matchesCourseGroup(eventText, groupNumber);
    }
    
    // Fall back to global groups (legacy support)
    const globalGroups = filter.groups;
    if (!globalGroups || ((!globalGroups.td || globalGroups.td === '') && (!globalGroups.tme || globalGroups.tme === ''))) {
      return true;
    }
    
    return this.shouldIncludeEvent(eventText, globalGroups);
  }

  /**
   * Extract course ID from event (e.g., "IAMSI" from "4I806-TD1-IAMSI")
   */
  private extractCourseFromEvent(event: CalendarEvent): string | null {
    const summary = event.summary;
    
    // Try different patterns to extract course
    const patterns = [
      /^4I\d+-(?:TD|TME)\d+-([A-Z]+)/i,           // 4I806-TD1-IAMSI -> IAMSI
      /^MU4IN\d+-([A-Z]+)-/i,                     // MU4IN806-IAMSI-TME1 -> IAMSI
      /^UM4IN\d+-([A-Z]+)-/i,                     // UM4IN814-DALAS-TD1 -> DALAS
      /MU4IN\d+-([A-Z]+)-(?:TD|TME|Cours|ER)/i,   // MU4IN811-ML-TD1 -> ML
    ];
    
    for (const pattern of patterns) {
      const match = summary.match(pattern);
      if (match) {
        return match[1].toUpperCase();
      }
    }
    
    return null;
  }

  /**
   * Check if event matches the specified course group (positive filtering)
   */
  private matchesCourseGroup(eventText: string, groupNumber: string): boolean {
    // Check if this is a group-specific event (TD or TME)
    const tdPattern = new RegExp(`(?:^4I\\d+-TD|MU4IN\\d+-.*-TD|UM4IN\\d+-.*-TD|\\bTD\\s*)(\\d+)(?![0-9])`, 'i');
    const tmePattern = new RegExp(`(?:^4I\\d+-TME|MU4IN\\d+-.*-TME|UM4IN\\d+-.*-TME|\\bTME\\s*)(\\d+)(?![0-9])`, 'i');
    
    const tdMatch = eventText.match(tdPattern);
    const tmeMatch = eventText.match(tmePattern);
    
    // If this is a TD event, check if it matches our group
    if (tdMatch) {
      return tdMatch[1] === groupNumber;
    }
    
    // If this is a TME event, check if it matches our group
    if (tmeMatch) {
      return tmeMatch[1] === groupNumber;
    }
    
    // If it's not a group-specific event (cours, exam, soutenance, etc.), include it
    return true;
  }

  /**
   * Legacy method for backward compatibility with negative filtering
   */
  private shouldIncludeEvent(eventText: string, groups: { td?: string; tme?: string }): boolean {
    // If no groups specified, include all events
    if ((!groups.td || groups.td === '') && (!groups.tme || groups.tme === '')) {
      return true;
    }

    // Check if this event belongs to a different TD group
    if (groups.td && groups.td !== '') {
      const otherTdPattern = new RegExp(`(?:^4I\\d+-TD|MU4IN\\d+-.*-TD|UM4IN\\d+-.*-TD|\\bTD\\s*)(\\d+)(?![0-9])`, 'i');
      const tdMatch = eventText.match(otherTdPattern);
      
      if (tdMatch && tdMatch[1] !== groups.td) {
        // This event belongs to a different TD group, exclude it
        return false;
      }
    }

    // Check if this event belongs to a different TME group
    if (groups.tme && groups.tme !== '') {
      const otherTmePattern = new RegExp(`(?:^4I\\d+-TME|MU4IN\\d+-.*-TME|UM4IN\\d+-.*-TME|\\bTME\\s*)(\\d+)(?![0-9])`, 'i');
      const tmeMatch = eventText.match(otherTmePattern);
      
      if (tmeMatch && tmeMatch[1] !== groups.tme) {
        // This event belongs to a different TME group, exclude it
        return false;
      }
    }

    // Include all other events (cours, exams, soutenances, etc.)
    return true;
  }

  /**
   * Legacy method for backward compatibility
   */
  private matchesSpecificGroups(eventText: string, groups: { td?: string; tme?: string }): boolean {
    return this.shouldIncludeEvent(eventText, groups);
  }

  /**
   * Check if event text matches a specific group pattern
   */
  private matchesGroupPattern(eventText: string, groupValue: string, groupType: 'TD' | 'TME'): boolean {
    const patterns = GROUP_PATTERNS[groupType];
    
    return patterns.some(pattern => {
      const match = eventText.match(pattern);
      if (match) {
        const extractedValue = match[1];
        return extractedValue.toLowerCase() === groupValue.toLowerCase();
      }
      return false;
    });
  }

  /**
   * Check if event matches custom include/exclude rules
   */
  private matchesCustomRules(
    event: CalendarEvent, 
    rules: { include?: string[]; exclude?: string[]; regex?: boolean }
  ): boolean {
    const eventText = `${event.summary} ${event.description || ''} ${event.location || ''}`;
    
    // Check exclude rules first
    if (rules.exclude && rules.exclude.length > 0) {
      const isExcluded = rules.exclude.some(rule => {
        if (rules.regex) {
          try {
            const regex = new RegExp(rule, 'i');
            return regex.test(eventText);
          } catch {
            // Fallback to string matching if regex is invalid
            return eventText.toLowerCase().includes(rule.toLowerCase());
          }
        }
        return eventText.toLowerCase().includes(rule.toLowerCase());
      });
      
      if (isExcluded) {
        return false;
      }
    }

    // Check include rules
    if (rules.include && rules.include.length > 0) {
      return rules.include.some(rule => {
        if (rules.regex) {
          try {
            const regex = new RegExp(rule, 'i');
            return regex.test(eventText);
          } catch {
            // Fallback to string matching if regex is invalid
            return eventText.toLowerCase().includes(rule.toLowerCase());
          }
        }
        return eventText.toLowerCase().includes(rule.toLowerCase());
      });
    }

    return true;
  }

  /**
   * Auto-detect available groups from a set of events
   */
  detectGroups(events: CalendarEvent[]): GroupDetectionResult {
    const tdGroups = new Set<string>();
    const tmeGroups = new Set<string>();
    const otherGroups = new Set<string>();

    events.forEach(event => {
      const summary = event.summary.toLowerCase();
      
      // Look for TD groups (TD1, TD2, etc.) - more flexible patterns
      const tdMatches = [
        summary.match(/td(\d+)/),
        summary.match(/-td(\d+)/),
        summary.match(/td\s*(\d+)/),
      ];
      
      for (const match of tdMatches) {
        if (match) {
          tdGroups.add(match[1]);
          break;
        }
      }
      
      // Look for TME groups (TME1, TME2, etc.) - more flexible patterns
      const tmeMatches = [
        summary.match(/tme(\d+)/),
        summary.match(/-tme(\d+)/),
        summary.match(/tme\s*(\d+)/),
        summary.match(/tme([a-z])/), // Also catch TME-A, TME-B style
      ];
      
      for (const match of tmeMatches) {
        if (match) {
          tmeGroups.add(match[1].toUpperCase());
          break;
        }
      }
      
      // Look for other group patterns
      const otherMatch = summary.match(/(?:groupe?|group)\s*([a-z0-9]+)/i);
      if (otherMatch && !Array.from(tdGroups).length && !Array.from(tmeGroups).length) {
        otherGroups.add(otherMatch[1].toUpperCase());
      }
    });

    return {
      td: Array.from(tdGroups).sort(),
      tme: Array.from(tmeGroups).sort(),
      other: Array.from(otherGroups).sort()
    };
  }

  /**
   * Get statistics about filtering results
   */
  getFilterStats(originalEvents: CalendarEvent[], filteredEvents: CalendarEvent[]) {
    const originalCount = originalEvents.length;
    const filteredCount = filteredEvents.length;
    const reductionPercent = originalCount > 0 
      ? Math.round(((originalCount - filteredCount) / originalCount) * 100)
      : 0;

    return {
      originalCount,
      filteredCount,
      removedCount: originalCount - filteredCount,
      reductionPercent,
      meetsTarget: reductionPercent >= 80 // From success metrics
    };
  }

  /**
   * Expand recurring events within a date range
   */
  expandRecurringEvents(events: CalendarEvent[], dateRange: { start: Date; end: Date }): CalendarEvent[] {
    const expandedEvents: CalendarEvent[] = [];

    events.forEach(event => {
      if (!event.rrule) {
        // Non-recurring event
        expandedEvents.push(event);
        return;
      }

      // For now, we'll handle basic recurring events
      // In a production app, you'd want to use a proper RRULE library
      try {
        const occurrences = this.generateRecurrenceOccurrences(event, dateRange);
        expandedEvents.push(...occurrences);
      } catch (error) {
        console.warn('Failed to expand recurring event:', event.uid, error);
        // Include original event as fallback
        expandedEvents.push(event);
      }
    });

    return expandedEvents;
  }

  /**
   * Generate occurrences for a recurring event using RRULE library
   */
  private generateRecurrenceOccurrences(
    event: CalendarEvent, 
    dateRange: { start: Date; end: Date }
  ): CalendarEvent[] {
    const occurrences: CalendarEvent[] = [];
    
    if (!event.rrule) {
      return [event];
    }

    try {
      // Parse the RRULE string
      const rrule = RRule.fromString(event.rrule);
      
      // Get the start date from the event
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      const duration = eventEnd.getTime() - eventStart.getTime();
      
      // Generate occurrences within the date range
      const occurrenceDates = rrule.between(dateRange.start, dateRange.end, true);
      
      occurrenceDates.forEach((occurrenceDate: Date, index: number) => {
        const occurrenceEnd = new Date(occurrenceDate.getTime() + duration);
        
        // Create a new event for each occurrence
        const occurrence: CalendarEvent = {
          ...event,
          uid: `${event.uid}-occurrence-${index}`,
          start: occurrenceDate.toISOString(),
          end: occurrenceEnd.toISOString(),
          // Remove rrule from individual occurrences
          rrule: undefined
        };
        
        occurrences.push(occurrence);
      });
      
      return occurrences;
      
    } catch (error) {
      console.warn('Failed to parse RRULE for event:', event.uid, event.rrule, error);
      // Fallback to original event
      return [event];
    }
  }

  /**
   * Create default date range for filtering
   */
  createDefaultDateRange(): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - APP_CONFIG.DEFAULT_DATE_RANGE_PAST);
    
    const end = new Date(now);
    end.setDate(end.getDate() + APP_CONFIG.DEFAULT_DATE_RANGE_FUTURE);

    return { start, end };
  }

  /**
   * Validate filter configuration
   */
  validateFilterConfig(filter: FilterConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check masters
    if (!filter.masters || filter.masters.length === 0) {
      errors.push('At least one master must be selected');
    }

    // Check date range - handle both Date objects and strings
    let startDate: Date;
    let endDate: Date;
    
    try {
      startDate = typeof filter.dateRange.start === 'string' 
        ? new Date(filter.dateRange.start) 
        : filter.dateRange.start;
      endDate = typeof filter.dateRange.end === 'string' 
        ? new Date(filter.dateRange.end) 
        : filter.dateRange.end;
        
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        errors.push('Invalid date format in date range');
      } else {
        if (startDate >= endDate) {
          errors.push('Start date must be before end date');
        }

        // Check if date range is reasonable (not more than 2 years)
        const maxRange = 2 * 365 * 24 * 60 * 60 * 1000; // 2 years in milliseconds
        if (endDate.getTime() - startDate.getTime() > maxRange) {
          errors.push('Date range cannot exceed 2 years');
        }
      }
    } catch (error) {
      errors.push('Invalid date range format');
    }

    // Check custom rules
    if (filter.customRules?.regex && filter.customRules.include) {
      filter.customRules.include.forEach((rule, index) => {
        try {
          new RegExp(rule);
        } catch {
          errors.push(`Invalid regex in include rule ${index + 1}: ${rule}`);
        }
      });
    }

    if (filter.customRules?.regex && filter.customRules.exclude) {
      filter.customRules.exclude.forEach((rule, index) => {
        try {
          new RegExp(rule);
        } catch {
          errors.push(`Invalid regex in exclude rule ${index + 1}: ${rule}`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
export const calendarParser = new CalendarParser();
export default CalendarParser;
