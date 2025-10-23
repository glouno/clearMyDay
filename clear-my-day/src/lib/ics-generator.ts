// ICS feed generator for creating personalized calendar feeds

import { CalendarEvent, PersonalCalendarConfig, FilterConfig } from './types';
import { APP_CONFIG } from './constants';

export class ICSGenerator {
  /**
   * Generate a complete ICS feed from filtered events
   */
  generateICS(
    events: CalendarEvent[], 
    config: PersonalCalendarConfig
  ): string {
    const lines: string[] = [];
    
    // Calendar header
    lines.push('BEGIN:VCALENDAR');
    lines.push('VERSION:2.0');
    lines.push(`PRODID:${APP_CONFIG.CALENDAR_PRODUCT_ID}`);
    lines.push('CALSCALE:GREGORIAN');
    lines.push('METHOD:PUBLISH');
    
    // Calendar properties
    lines.push(`X-WR-CALNAME:${this.escapeText(config.name)}`);
    lines.push(`X-WR-CALDESC:Personalized Sorbonne calendar - ${config.name}`);
    lines.push(`X-WR-TIMEZONE:${APP_CONFIG.TIMEZONE}`);
    lines.push(`X-PUBLISHED-TTL:PT${APP_CONFIG.REFRESH_INTERVAL_MINUTES}M`);
    
    // Timezone definition
    lines.push(...this.generateTimezone());
    
    // Events
    events.forEach(event => {
      lines.push(...this.generateEvent(event));
    });
    
    // Calendar footer
    lines.push('END:VCALENDAR');
    
    return lines.join('\r\n');
  }

  /**
   * Generate timezone definition for Europe/Paris
   */
  private generateTimezone(): string[] {
    return [
      'BEGIN:VTIMEZONE',
      'TZID:Europe/Paris',
      'BEGIN:DAYLIGHT',
      'TZOFFSETFROM:+0100',
      'TZOFFSETTO:+0200',
      'TZNAME:CEST',
      'DTSTART:20070325T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
      'END:DAYLIGHT',
      'BEGIN:STANDARD',
      'TZOFFSETFROM:+0200',
      'TZOFFSETTO:+0100',
      'TZNAME:CET',
      'DTSTART:20071028T030000',
      'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
      'END:STANDARD',
      'END:VTIMEZONE'
    ];
  }

  /**
   * Generate ICS event block
   */
  private generateEvent(event: CalendarEvent): string[] {
    const lines: string[] = [];
    
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.uid}`);
    lines.push(`DTSTART;TZID=Europe/Paris:${this.formatDateTime(new Date(event.start))}`);
    lines.push(`DTEND;TZID=Europe/Paris:${this.formatDateTime(new Date(event.end))}`);
    lines.push(`SUMMARY:${this.escapeText(event.summary)}`);
    
    if (event.description) {
      lines.push(`DESCRIPTION:${this.escapeText(event.description)}`);
    }
    
    if (event.location) {
      lines.push(`LOCATION:${this.escapeText(event.location)}`);
    }
    
    if (event.categories && event.categories.length > 0) {
      lines.push(`CATEGORIES:${event.categories.map(cat => this.escapeText(cat)).join(',')}`);
    }
    
    // Add creation and modification timestamps (RFC 5545 requires UTC format with Z suffix)
    const nowUTC = this.formatDateTimeUTC(new Date());
    lines.push(`CREATED:${nowUTC}`);
    lines.push(`LAST-MODIFIED:${nowUTC}`);
    lines.push(`DTSTAMP:${nowUTC}`);
    
    // Add recurrence rule if present
    if (event.rrule) {
      // Fix RRULE timezone issues for Apple Calendar compatibility
      const fixedRrule = this.fixRruleTimezone(event.rrule);
      lines.push(`RRULE:${fixedRrule}`);
    }
    
    // Add exception dates (EXDATE) if present
    if (event.exdate && event.exdate.length > 0) {
      // Group EXDATE entries if there are multiple (RFC 5545 allows comma-separated list)
      const exdateStrings = event.exdate.map(exd => this.formatDateTime(new Date(exd)));
      lines.push(`EXDATE;TZID=Europe/Paris:${exdateStrings.join(',')}`);
    }
    
    // Add recurrence ID if present
    if (event.recurrenceId) {
      lines.push(`RECURRENCE-ID;TZID=Europe/Paris:${this.formatDateTime(event.recurrenceId)}`);
    }
    
    lines.push('END:VEVENT');
    
    return lines;
  }

  /**
   * Format date/time for ICS format in Europe/Paris timezone (YYYYMMDDTHHMMSS)
   */
  private formatDateTime(date: Date): string {
    // Convert to Paris timezone using Intl.DateTimeFormat
    const parisTime = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).formatToParts(date);

    const year = parisTime.find(part => part.type === 'year')?.value || '';
    const month = parisTime.find(part => part.type === 'month')?.value || '';
    const day = parisTime.find(part => part.type === 'day')?.value || '';
    const hours = parisTime.find(part => part.type === 'hour')?.value || '';
    const minutes = parisTime.find(part => part.type === 'minute')?.value || '';
    const seconds = parisTime.find(part => part.type === 'second')?.value || '';
    
    return `${year}${month}${day}T${hours}${minutes}${seconds}`;
  }

  /**
   * Format date/time in UTC for ICS format (YYYYMMDDTHHMMSSZ)
   * Required for DTSTAMP, CREATED, and LAST-MODIFIED per RFC 5545
   */
  private formatDateTimeUTC(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
  }

  /**
   * Fix RRULE timezone issues for better Apple Calendar compatibility
   * Also handles malformed RRULEs from source calendars (e.g., Sorbonne CalDAV)
   */
  private fixRruleTimezone(rrule: string): string {
    let fixedRrule = rrule;
    
    // Handle malformed RRULE with embedded DTSTART (common in some CalDAV servers)
    // Example: "DTSTART;TZID=Europe/Paris:20250915T134500\nRRULE:FREQ=WEEKLY;UNTIL=20250915T215959"
    if (fixedRrule.includes('DTSTART')) {
      // Extract only the actual RRULE part (after DTSTART line and after "RRULE:" prefix)
      const rruleParts = fixedRrule.split(/[\r\n]+/);
      const actualRrule = rruleParts.find(part => part.includes('FREQ='));
      if (actualRrule) {
        // Remove "RRULE:" prefix if present
        fixedRrule = actualRrule.replace(/^RRULE:/i, '');
      }
    }
    
    // Remove any remaining DTSTART parameters from RRULE (shouldn't be there per RFC 5545)
    fixedRrule = fixedRrule.replace(/;?DTSTART[^;]*(;|$)/g, '$1');
    
    // Convert UTC UNTIL dates to local timezone format for better compatibility
    // Example: FREQ=WEEKLY;UNTIL=20250408T215959Z -> FREQ=WEEKLY;UNTIL=20250408T235959
    fixedRrule = fixedRrule.replace(/UNTIL=(\d{8})T(\d{6})Z/g, (match, date, time) => {
      // Parse the UTC date
      const utcDate = new Date(`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}T${time.slice(0,2)}:${time.slice(2,4)}:${time.slice(4,6)}Z`);
      
      // Convert to Europe/Paris timezone (properly handle DST)
      const parisDate = new Date(utcDate.toLocaleString("en-US", {timeZone: "Europe/Paris"}));
      
      // Format back to RRULE format (without Z for local time)
      const localDateStr = this.formatDateTime(parisDate);
      return `UNTIL=${localDateStr}`;
    });
    
    // Clean up any leading/trailing semicolons or whitespace
    fixedRrule = fixedRrule.replace(/^;+|;+$/g, '').trim();
    
    return fixedRrule;
  }

  /**
   * Escape text for ICS format
   */
  private escapeText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')  // Escape backslashes
      .replace(/;/g, '\\;')    // Escape semicolons
      .replace(/,/g, '\\,')    // Escape commas
      .replace(/\n/g, '\\n')   // Escape newlines
      .replace(/\r/g, '')      // Remove carriage returns
      .trim();
  }

  /**
   * Generate a unique token for calendar access
   */
  generateToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    for (let i = 0; i < APP_CONFIG.TOKEN_LENGTH; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }

  /**
   * Validate generated ICS content
   */
  validateICS(icsContent: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Basic structure validation
    if (!icsContent.includes('BEGIN:VCALENDAR')) {
      errors.push('Missing VCALENDAR begin tag');
    }
    
    if (!icsContent.includes('END:VCALENDAR')) {
      errors.push('Missing VCALENDAR end tag');
    }
    
    if (!icsContent.includes('VERSION:2.0')) {
      errors.push('Missing or incorrect VERSION');
    }
    
    if (!icsContent.includes('PRODID:')) {
      errors.push('Missing PRODID');
    }
    
    // Check for balanced BEGIN/END tags
    const beginCount = (icsContent.match(/BEGIN:/g) || []).length;
    const endCount = (icsContent.match(/END:/g) || []).length;
    
    if (beginCount !== endCount) {
      errors.push('Unbalanced BEGIN/END tags');
    }
    
    // Check line endings
    if (icsContent.includes('\n') && !icsContent.includes('\r\n')) {
      errors.push('Incorrect line endings (should be CRLF)');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get ICS content length and statistics
   */
  getICSStats(icsContent: string) {
    const lines = icsContent.split('\r\n');
    const eventCount = (icsContent.match(/BEGIN:VEVENT/g) || []).length;
    
    return {
      totalLines: lines.length,
      totalBytes: new Blob([icsContent]).size,
      eventCount,
      averageBytesPerEvent: eventCount > 0 ? Math.round(new Blob([icsContent]).size / eventCount) : 0
    };
  }

  /**
   * Create calendar configuration from filter settings
   */
  createCalendarConfig(
    name: string,
    token: string,
    filter: FilterConfig
  ): PersonalCalendarConfig {
    return {
      id: `cal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      token,
      filter,
      createdAt: new Date(),
      lastUpdated: new Date()
    };
  }

  /**
   * Generate HTTP headers for ICS response
   */
  getICSHeaders(): Record<string, string> {
    return {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="calendar.ics"',
      'Cache-Control': `public, max-age=${Math.floor(APP_CONFIG.CALENDAR_CACHE_TTL / 1000)}`,
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };
  }
}

// Export singleton instance
export const icsGenerator = new ICSGenerator();
export default ICSGenerator;
