// Calendar parsing and filtering logic for Sorbonne University events

import { CalendarEvent, FilterConfig } from './types';
import { GROUP_PATTERNS, COURSE_PATTERNS } from './constants';

export class CalendarParser {
  /**
   * Filter events based on user configuration
   */
  filterEvents(events: CalendarEvent[], filter: FilterConfig): CalendarEvent[] {
    console.log(`Filtering ${events.length} events with config:`, filter);

    let filteredEvents = events;

    // Filter by date range
    if (filter.dateRange) {
      filteredEvents = filteredEvents.filter(event => {
        const eventDate = new Date(event.start);
        const startDate = new Date(filter.dateRange.start);
        const endDate = new Date(filter.dateRange.end);
        return eventDate >= startDate && eventDate <= endDate;
      });
    }

    // Filter by courses
    if (filter.courses && filter.courses.length > 0) {
      filteredEvents = filteredEvents.filter(event => {
        return filter.courses.some(courseId => 
          this.eventMatchesCourse(event, courseId)
        );
      });
    }

    // Filter by groups (new per-course group system)
    if (filter.courseGroups && Object.keys(filter.courseGroups).length > 0) {
      filteredEvents = filteredEvents.filter(event => {
        return this.eventMatchesGroupFilter(event, filter.courseGroups!, filter.courses);
      });
    }

    // Legacy global group filter (for backward compatibility)
    if (filter.groups && (filter.groups.td || filter.groups.tme)) {
      filteredEvents = filteredEvents.filter(event => {
        return this.eventMatchesLegacyGroups(event, filter.groups);
      });
    }

    console.log(`Filtered to ${filteredEvents.length} events`);
    return filteredEvents;
  }

  /**
   * Check if an event matches a specific course
   */
  private eventMatchesCourse(event: CalendarEvent, courseId: string): boolean {
    const summary = event.summary?.toLowerCase() || '';
    const description = event.description?.toLowerCase() || '';
    const location = event.location?.toLowerCase() || '';
    
    const courseIdLower = courseId.toLowerCase();
    
    // Direct course ID match
    if (summary.includes(courseIdLower) || description.includes(courseIdLower) || location.includes(courseIdLower)) {
      return true;
    }

    // Check against known course patterns
    const pattern = COURSE_PATTERNS[courseId as keyof typeof COURSE_PATTERNS];
    if (pattern) {
      return pattern.test(summary) || pattern.test(description) || pattern.test(location);
    }

    return false;
  }

  /**
   * Check if an event matches the new per-course group filter
   */
  private eventMatchesGroupFilter(
    event: CalendarEvent, 
    courseGroups: { [courseId: string]: string },
    courses: string[]
  ): boolean {
    const summary = event.summary || '';
    
    // Find which course this event belongs to
    const matchingCourse = courses.find(courseId => this.eventMatchesCourse(event, courseId));
    
    if (!matchingCourse) {
      return true; // If we can't determine the course, include the event
    }

    const requiredGroup = courseGroups[matchingCourse];
    if (!requiredGroup) {
      return true; // No group filter for this course
    }

    // Check if the event matches the required group
    return this.eventMatchesGroup(event, requiredGroup);
  }

  /**
   * Check if an event matches a specific group number
   */
  private eventMatchesGroup(event: CalendarEvent, groupNumber: string): boolean {
    const summary = event.summary || '';
    const description = event.description || '';
    const location = event.location || '';
    
    const text = `${summary} ${description} ${location}`.toLowerCase();
    
    // Check for various group patterns
    const patterns = [
      new RegExp(`\\btd\\s*${groupNumber}\\b`, 'i'),
      new RegExp(`\\btme\\s*${groupNumber}\\b`, 'i'),
      new RegExp(`\\btp\\s*${groupNumber}\\b`, 'i'),
      new RegExp(`\\bgroupe?\\s*${groupNumber}\\b`, 'i'),
      new RegExp(`\\bgroup\\s*${groupNumber}\\b`, 'i'),
      new RegExp(`\\bg${groupNumber}\\b`, 'i'),
      new RegExp(`\\b${groupNumber}\\b`) // Just the number
    ];

    return patterns.some(pattern => pattern.test(text));
  }

  /**
   * Check if an event matches legacy global group filters
   */
  private eventMatchesLegacyGroups(event: CalendarEvent, groups: { td?: string; tme?: string }): boolean {
    const summary = event.summary || '';
    const description = event.description || '';
    const location = event.location || '';
    
    const text = `${summary} ${description} ${location}`;

    // Check TD group
    if (groups.td) {
      const tdMatch = GROUP_PATTERNS.TD.some(pattern => {
        const match = text.match(pattern);
        return match && match[1] === groups.td;
      });
      if (this.eventContainsTD(text) && !tdMatch) {
        return false;
      }
    }

    // Check TME group
    if (groups.tme) {
      const tmeMatch = GROUP_PATTERNS.TME.some(pattern => {
        const match = text.match(pattern);
        return match && match[1] === groups.tme;
      });
      if (this.eventContainsTME(text) && !tmeMatch) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if event text contains TD-related keywords
   */
  private eventContainsTD(text: string): boolean {
    return /\b(td|travaux?\s+dirigés?)\b/i.test(text);
  }

  /**
   * Check if event text contains TME/TP-related keywords
   */
  private eventContainsTME(text: string): boolean {
    return /\b(tme|tp|travaux?\s+pratiques?)\b/i.test(text);
  }

  /**
   * Analyze events to detect available groups for each course
   */
  analyzeGroups(events: CalendarEvent[], courses: string[]): { [courseId: string]: { td: string[]; tme: string[] } } {
    const analysis: { [courseId: string]: { td: string[]; tme: string[] } } = {};

    courses.forEach(courseId => {
      analysis[courseId] = { td: [], tme: [] };
      
      const courseEvents = events.filter(event => this.eventMatchesCourse(event, courseId));
      
      courseEvents.forEach(event => {
        const text = `${event.summary} ${event.description} ${event.location}`;
        
        // Extract TD groups
        GROUP_PATTERNS.TD.forEach(pattern => {
          const matches = text.match(pattern);
          if (matches && matches[1]) {
            const group = matches[1];
            if (!analysis[courseId].td.includes(group)) {
              analysis[courseId].td.push(group);
            }
          }
        });

        // Extract TME groups
        GROUP_PATTERNS.TME.forEach(pattern => {
          const matches = text.match(pattern);
          if (matches && matches[1]) {
            const group = matches[1];
            if (!analysis[courseId].tme.includes(group)) {
              analysis[courseId].tme.push(group);
            }
          }
        });
      });

      // Sort groups
      analysis[courseId].td.sort();
      analysis[courseId].tme.sort();
    });

    return analysis;
  }

  /**
   * Get event type based on summary and description
   */
  getEventType(event: CalendarEvent): 'cours' | 'td' | 'tme' | 'exam' | 'other' {
    const text = `${event.summary} ${event.description}`.toLowerCase();
    
    if (/\b(exam|examen|controle|partiel|rattrapage)\b/i.test(text)) {
      return 'exam';
    }
    
    if (/\b(td|travaux?\s+dirigés?)\b/i.test(text)) {
      return 'td';
    }
    
    if (/\b(tme|tp|travaux?\s+pratiques?)\b/i.test(text)) {
      return 'tme';
    }
    
    if (/\b(cours|lecture|cm)\b/i.test(text)) {
      return 'cours';
    }
    
    return 'other';
  }

  /**
   * Extract course ID from event summary
   */
  extractCourseId(event: CalendarEvent): string | null {
    const summary = event.summary || '';
    
    // Try to match common course ID patterns
    const patterns = [
      /\b([A-Z]{2,6}\d*)\b/g, // MLBDA, DALAS, etc.
      /\b(MU\d+[A-Z]+\d*)\b/g // MU4IN801, etc.
    ];

    for (const pattern of patterns) {
      const matches = summary.match(pattern);
      if (matches) {
        return matches[0];
      }
    }

    return null;
  }

  /**
   * Get statistics about filtered events
   */
  getFilterStats(originalEvents: CalendarEvent[], filteredEvents: CalendarEvent[]): {
    total: number;
    filtered: number;
    reductionPercent: number;
    byType: { [type: string]: number };
  } {
    const byType: { [type: string]: number } = {};
    
    filteredEvents.forEach(event => {
      const type = this.getEventType(event);
      byType[type] = (byType[type] || 0) + 1;
    });

    return {
      total: originalEvents.length,
      filtered: filteredEvents.length,
      reductionPercent: Math.round((1 - filteredEvents.length / originalEvents.length) * 100),
      byType
    };
  }
}

// Export singleton instance
export const calendarParser = new CalendarParser();
export default CalendarParser;
