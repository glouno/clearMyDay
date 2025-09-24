// ICS feed generator for creating personalized calendar feeds

import { CalendarEvent, PersonalCalendarConfig } from './types';
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
    
    // Add creation and modification timestamps
    const now = this.formatDateTime(new Date());
    lines.push(`CREATED:${now}`);
    lines.push(`LAST-MODIFIED:${now}`);
    lines.push(`DTSTAMP:${now}`);
    
    // Add recurrence rule if present
    if (event.rrule) {
      // Fix RRULE timezone issues for Apple Calendar compatibility
      const fixedRrule = this.fixRruleTimezone(event.rrule);
      lines.push(`RRULE:${fixedRrule}`);
    }
    
    // Add recurrence ID if present
    if (event.recurrenceId) {
      lines.push(`RECURRENCE-ID;TZID=Europe/Paris:${this.formatDateTime(event.recurrenceId)}`);
    }
    
    lines.push('END:VEVENT');
    
    return lines;
  }

  /**
   * Format date/time for ICS format (YYYYMMDDTHHMMSS)
   */
  private formatDateTime(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}T${hours}${minutes}${seconds}`;
  }

  /**
   * Fix RRULE timezone issues for better Apple Calendar compatibility
   */
  private fixRruleTimezone(rrule: string): string {
    let fixedRrule = rrule;
    
    // Remove any DTSTART from RRULE (it shouldn't be there)
    fixedRrule = fixedRrule.replace(/;DTSTART=[^;]*/g, '');
    
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
    filter: any
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
