// Calendar parsing and filtering logic

import { CalendarEvent, FilterConfig, GroupDetectionResult } from './types';
import { GROUP_PATTERNS, COURSE_PATTERNS, APP_CONFIG } from './constants';
import { rrulestr } from 'rrule';

export class CalendarParser {
  /**
   * Extract cancelled/rescheduled dates from event summaries
   * Parses patterns like "( report du 23/10 )" or "( séance annulée et reportée au 13/11 )"
   * Returns the date that was cancelled (e.g., "23/10" -> Date(2025-10-23))
   */
  private extractCancelledDate(summary: string, description?: string): Date | null {
    const text = `${summary} ${description || ''}`;
    
    // Match patterns like "report du 23/10", "annulée et reportée au 23/10", etc.
    const patterns = [
      /report.*?du\s+(\d{1,2})\/(\d{1,2})/i,
      /annulée.*?(\d{1,2})\/(\d{1,2})/i,
      /reporté.*?du\s+(\d{1,2})\/(\d{1,2})/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        
        // Determine the year based on the month (handle academic year Sept-Aug)
        const now = new Date();
        const currentMonth = now.getMonth() + 1; // 1-12
        const currentYear = now.getFullYear();
        
        // If month is Sept-Dec, use current year if we're in Sept-Dec, otherwise use current year
        // If month is Jan-Aug, use current year if we're past that month, otherwise use current year
        let year = currentYear;
        if (month >= 9) {
          // Sept-Dec: use current year if we're in Sept-Dec or later months
          if (currentMonth < 9) {
            year = currentYear - 1;
          }
        } else {
          // Jan-Aug: use current year if we're before Sept
          if (currentMonth >= 9) {
            year = currentYear + 1;
          }
        }
        
        try {
          // Use midday to avoid timezone boundary issues when converting to ISO string
          const cancelledDate = new Date(year, month - 1, day, 12, 0, 0);
          if (!isNaN(cancelledDate.getTime())) {
            return cancelledDate;
          }
        } catch {
          continue;
        }
      }
    }
    
    return null;
  }

  /**
   * Normalize recurring events without expanding them.
   * - Keeps base RRULE events intact
   * - Preserves/extends EXDATE lists using RECURRENCE-ID exception entries
   * - Drops cancelled exceptions ("annulée") while keeping rescheduled ones
   */
  private expandRecurringEvents(events: CalendarEvent[]): CalendarEvent[] {
    const normalized: CalendarEvent[] = [];

    const makeKey = (date: Date): string => {
      const dt = new Date(date);
      const pad = (value: number) => value.toString().padStart(2, '0');
      return [
        dt.getFullYear(),
        pad(dt.getMonth() + 1),
        pad(dt.getDate())
      ].join('-') + `T${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
    };

    const isCancelledException = (event: CalendarEvent): boolean => {
      const text = `${event.summary} ${event.description || ''}`.toLowerCase();
      return /annul[eé]e/.test(text);
    };

    const groups = new Map<string, { base?: CalendarEvent; exceptions: CalendarEvent[] }>();

    events.forEach(event => {
      if (!groups.has(event.uid)) {
        groups.set(event.uid, { exceptions: [] });
      }
      const entry = groups.get(event.uid)!;

      if (event.recurrenceId) {
        entry.exceptions.push(event);
        return;
      }

      if (!entry.base) {
        entry.base = event;
        return;
      }

      // Multiple non-recurring events with same UID: pass through
      normalized.push(event);
    });

    for (const { base, exceptions } of groups.values()) {
      if (!base) {
        exceptions.forEach(exception => {
          if (!isCancelledException(exception)) {
            normalized.push({ ...exception, rrule: undefined, exdate: undefined });
          }
        });
        continue;
      }

      if (!base.rrule) {
        normalized.push(base);
        exceptions.forEach(exception => {
          if (!isCancelledException(exception)) {
            normalized.push({ ...exception, rrule: undefined, exdate: undefined });
          }
        });
        continue;
      }

      const exdateMap = new Map<string, Date>();

      if (base.exdate && base.exdate.length > 0) {
        if (APP_CONFIG.DEBUG_LOGS) {
          console.log(`[PARSER] Base event ${base.uid} has ${base.exdate.length} EXDATE entries`);
        }
        base.exdate.forEach(ex => {
          const date = new Date(ex);
          const key = makeKey(date);
          exdateMap.set(key, date);
          if (APP_CONFIG.DEBUG_LOGS) {
            console.log(`[PARSER]   Added EXDATE: ${date.toISOString()} (key: ${key})`);
          }
        });
      } else {
        if (APP_CONFIG.DEBUG_LOGS) {
          console.log(`[PARSER] Base event ${base.uid} (${base.summary}) has NO EXDATE (exdate: ${base.exdate})`);
        }
      }

      const preservedExceptions: CalendarEvent[] = [];

      exceptions.forEach(exception => {
        if (!exception.recurrenceId) {
          preservedExceptions.push({ ...exception, rrule: undefined, exdate: undefined });
          return;
        }

        const occurrenceDate = new Date(exception.recurrenceId);
        if (isNaN(occurrenceDate.getTime())) {
          preservedExceptions.push({ ...exception, rrule: undefined, exdate: undefined });
          return;
        }

        // Always suppress the corresponding base RRULE occurrence for this exception
        const key = makeKey(occurrenceDate);
        exdateMap.set(key, occurrenceDate);

        // If this is a pure cancellation ("annulée"), do not keep a separate event
        if (isCancelledException(exception)) {
          return;
        }

        // Otherwise, keep the modified occurrence as an independent event (changed time/location, etc.)
        preservedExceptions.push({ ...exception, rrule: undefined, exdate: undefined });
      });

      const updatedBase: CalendarEvent = {
        ...base,
        exdate: Array.from(exdateMap.values()).sort((a, b) => a.getTime() - b.getTime())
      };

      normalized.push(updatedBase);
      preservedExceptions.forEach(exception => normalized.push(exception));
    }

    return normalized;
  }

  /**
   * Filter events based on the provided configuration
   */
  filterEvents(events: CalendarEvent[], filter: FilterConfig): CalendarEvent[] {
    // Normalize recurring events while preserving RRULE/EXDATE semantics
    const expandedEvents = this.expandRecurringEvents(events);
    
    return expandedEvents.filter(event => {
      // Date range filter (handles RRULE occurrences without expansion)
      if (!this.isEventInDateRange(event, filter.dateRange)) {
        return false;
      }

      // Check if this is a general event (SOI, conferences, orientation)
      // General events bypass course filtering but still respect group filtering
      const isGeneralEvent = this.isGeneralEvent(event);

      // Course filter - only apply if courses are specified AND event is not general
      if (filter.courses.length > 0 && !isGeneralEvent && !this.matchesCourses(event, filter.courses)) {
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
   * Check if event is a general event (SOI, conferences, orientation meetings)
   * These events should be included regardless of course selection
   */
  private isGeneralEvent(event: CalendarEvent): boolean {
    const summary = event.summary.toLowerCase();
    const description = (event.description || '').toLowerCase();
    const eventText = `${summary} ${description}`;
    
    // Patterns for general events that apply to all students
    // NOTE: OIP is NOT included here - it's a regular course with master-specific variants and groups
    const generalEventPatterns = [
      /\bsoi\b/i,                           // SOI events
      /service.*orientation/i,               // Service Orientation et Insertion
      /insertion.*professionnelle/i,         // Professional insertion (but not OIP/INOIP)
      /conf[eé]rence.*m[eé]tiers/i,         // Career conferences
      /r[eé]union.*rentr[eé]e/i,            // Orientation meetings
      /rentr[eé]e\s+(m1|m2|master)/i,       // M1/M2 orientation
      /assembl[eé]e.*g[eé]n[eé]rale/i,      // General assemblies
      /\bag\b.*m1|m1.*\bag\b/i,             // M1 AG
      /\bag\b.*m2|m2.*\bag\b/i,             // M2 AG
      /forum.*entreprise/i,                  // Career forums
      /journ[eé]e.*m[eé]tier/i,             // Career days
      /pr[eé]sentation.*master/i,           // Master presentations
      /information.*collective/i             // Collective information sessions
    ];
    
    return generalEventPatterns.some(pattern => pattern.test(eventText));
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

    if (!event.rrule) {
      return eventStart < dateRange.end && eventEnd > dateRange.start;
    }

    try {
      const rule = rrulestr(event.rrule, { dtstart: eventStart });
      // For RRULE events, check if there's ANY occurrence within the date range
      // We use 'between' to check if any occurrences fall within the window
      const occurrences = rule.between(dateRange.start, dateRange.end, true);
      return occurrences.length > 0;
    } catch (error) {
      console.warn(`⚠️ Failed to evaluate RRULE date range for ${event.uid}:`, error);
      return eventStart < dateRange.end && eventEnd > dateRange.start;
    }
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
    
    // Check for OIP events first (they have special patterns)
    // Examples: "OIP-AI2D-Gr2", "UM5INOIP-TD5", "OIPMIND-OIPMIND-Cours", "MU4INOIP-CS1"
    if (/\b(OIP|INOIP)\b/i.test(summary)) {
      return 'OIP';
    }
    
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
    const tdPattern = new RegExp(`(?:^4I\\d+-TD|MU4IN\\d+-.*-TD|UM4IN\\d+-.*-TD|UM5INOIP-TD|\\bTD\\s*)(\\d+)(?![0-9])`, 'i');
    const tmePattern = new RegExp(`(?:^4I\\d+-TME|MU4IN\\d+-.*-TME|UM4IN\\d+-.*-TME|UM5INOIP-TME|\\bTME\\s*)(\\d+)(?![0-9])`, 'i');
    // OIP-specific group pattern: "OIP-AI2D-Gr2" -> group "2"
    const oipGroupPattern = /(?:OIP.*-Gr|Groupe\s*)(\d+)/i;
    
    const tdMatch = eventText.match(tdPattern);
    const tmeMatch = eventText.match(tmePattern);
    const oipMatch = eventText.match(oipGroupPattern);
    
    // If this is a TD event, check if it matches our group
    if (tdMatch) {
      return tdMatch[1] === groupNumber;
    }
    
    // If this is a TME event, check if it matches our group
    if (tmeMatch) {
      return tmeMatch[1] === groupNumber;
    }
    
    // If this is an OIP group event, check if it matches
    if (oipMatch) {
      return oipMatch[1] === groupNumber;
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
    } catch {
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
