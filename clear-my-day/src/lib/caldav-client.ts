// CalDAV client for fetching calendar data from Sorbonne endpoints

import { CalendarFetchResult, CalendarEvent, CalendarSource } from './types';
import { SORBONNE_CALENDARS, SORBONNE_AUTH, APP_CONFIG, HTTP_HEADERS, ERROR_MESSAGES } from './constants';

// Using node-ical for ICS parsing instead of xml2js
import * as ical from 'node-ical';

/**
 * Calculate current academic year date range
 * Academic year runs from September 1st to August 31st
 * Returns dates for current + next academic year
 */
function getAcademicYearRange(): { start: string; end: string } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11
  
  // If we're in Sept-Dec (months 8-11), academic year started this year
  // If we're in Jan-Aug (months 0-7), academic year started last year
  const academicYearStartYear = currentMonth >= 8 ? currentYear : currentYear - 1;
  
  // Start: September 1st of academic year start
  const start = new Date(Date.UTC(academicYearStartYear, 8, 1, 0, 0, 0));
  
  // End: August 31st, 2 years later (covers current + next academic year)
  const end = new Date(Date.UTC(academicYearStartYear + 2, 7, 31, 23, 59, 59));
  
  // Format as CalDAV time-range format: YYYYMMDDTHHmmssZ
  const formatCalDAVDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };
  
  return {
    start: formatCalDAVDate(start),
    end: formatCalDAVDate(end)
  };
}

// interface FetchOptions { // Unused interface
//   timeout?: number;
//   retries?: number;
//   retryDelay?: number;
// }

class CalDAVClient {
  private cache = new Map<string, { data: string; timestamp: number }>();
  private readonly cacheTimeout = APP_CONFIG.CACHE_TIMEOUT;
  private readonly maxRetries = APP_CONFIG.MAX_RETRIES;
  private readonly timeout = APP_CONFIG.TIMEOUT;

  /**
   * Fetch calendar data from a Sorbonne calendar source
   * Uses CalDAV REPORT method with time-range filtering for current academic year
   */
  async fetchCalendar(
    source: CalendarSource
  ): Promise<string> {
    const cacheKey = `calendar_${source.name}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    let lastError: Error | null = null;
    
    // Get academic year date range (Sept current year + 2 years)
    const { start, end } = getAcademicYearRange();
    console.log(`📅 Fetching ${source.name} calendar for academic year: ${start} to ${end}`);
    
    // CalDAV REPORT XML body with time-range filter
    const reportBody = `<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <C:calendar-data />
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="${start}" end="${end}"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Create manual timeout controller (AbortSignal.timeout not reliable in Vercel)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        const response = await fetch(source.url, {
          method: 'REPORT',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${source.auth.username}:${source.auth.password}`).toString('base64')}`,
            'User-Agent': HTTP_HEADERS.USER_AGENT,
            'Content-Type': 'application/xml; charset=utf-8',
            'Depth': '1',
          },
          body: reportBody,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const xmlData = await response.text();
        
        // Parse XML multistatus response and extract ICS data
        const calendarData = this.parseCalDAVMultiStatus(xmlData);
        
        if (!calendarData || !calendarData.includes('BEGIN:VCALENDAR')) {
          throw new Error('Invalid calendar data received - missing VCALENDAR');
        }
        
        // Cache the successful response
        this.cache.set(cacheKey, {
          data: calendarData,
          timestamp: Date.now()
        });

        return calendarData;
      } catch (error) {
        lastError = error as Error;
        console.warn(`Attempt ${attempt}/${this.maxRetries} failed for ${source.name}:`, error);
        
        if (attempt < this.maxRetries) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Failed to fetch calendar ${source.name} after ${this.maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Parse CalDAV multistatus XML response and extract ICS calendar data
   * Combines multiple VCALENDAR entries into a single ICS file
   */
  private parseCalDAVMultiStatus(xmlData: string): string {
    // Extract all calendar-data content from XML
    const calendarDataRegex = /<C:calendar-data[^>]*>([\s\S]*?)<\/C:calendar-data>/gi;
    const matches = xmlData.matchAll(calendarDataRegex);
    
    const events: string[] = [];
    let timezoneData = '';
    
    for (const match of matches) {
      const icsContent = match[1].trim();
      
      // Extract VTIMEZONE (use first one found)
      if (!timezoneData && icsContent.includes('BEGIN:VTIMEZONE')) {
        const tzMatch = icsContent.match(/BEGIN:VTIMEZONE[\s\S]*?END:VTIMEZONE/);
        if (tzMatch) {
          timezoneData = tzMatch[0];
        }
      }
      
      // Extract VEVENT
      const eventMatches = icsContent.matchAll(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g);
      for (const eventMatch of eventMatches) {
        events.push(eventMatch[0]);
      }
    }
    
    // Combine into single ICS file
    const icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ClearMyDay//Sorbonne Calendar Sync//EN',
      'CALSCALE:GREGORIAN',
    ];
    
    if (timezoneData) {
      icsLines.push(timezoneData);
    }
    
    icsLines.push(...events);
    icsLines.push('END:VCALENDAR');
    
    return icsLines.join('\r\n');
  }

  /**
   * Fetch calendar data with timeout
   */
  private async fetchWithTimeout(url: string, timeout: number): Promise<CalendarFetchResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': HTTP_HEADERS.USER_AGENT,
          'Accept': HTTP_HEADERS.ACCEPT,
          'Cache-Control': HTTP_HEADERS.CACHE_CONTROL
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const icsData = await response.text();
      const events = this.parseICSData(icsData);

      return {
        success: true,
        events,
        lastModified: response.headers.get('last-modified') 
          ? new Date(response.headers.get('last-modified')!) 
          : undefined,
        etag: response.headers.get('etag') || undefined
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout');
        }
        throw error;
      }
      
      throw new Error('Unknown error occurred');
    }
  }

  /**
   * Parse ICS data and convert to CalendarEvent objects
   */
  private parseICSData(icsData: string): CalendarEvent[] {
    try {
      const parsedData = ical.parseICS(icsData);
      const events: CalendarEvent[] = [];

      for (const key in parsedData) {
        const event = parsedData[key];
        
        if (event.type === 'VEVENT') {
          // Skip events without required fields
          if (!event.summary || !event.start || !event.end) {
            continue;
          }

          // Parse EXDATE (exception dates) - node-ical returns them as an array or object
          let exdates: Date[] | undefined = undefined;
          if (event.exdate) {
            console.log(`[CALDAV] Parsing EXDATE for ${event.uid} (${event.summary}): type=${typeof event.exdate}, isArray=${Array.isArray(event.exdate)}`);
            if (Array.isArray(event.exdate)) {
              exdates = event.exdate.map((d: Date | string | number) => new Date(d));
              console.log(`[CALDAV]   Parsed ${exdates.length} EXDATE entries from array`);
            } else if (typeof event.exdate === 'object') {
              // Sometimes exdate is an object with date keys
              const exdateValues = Object.values(event.exdate) as (Date | string | number)[];
              exdates = exdateValues.map((d) => new Date(d));
              console.log(`[CALDAV]   Parsed ${exdates.length} EXDATE entries from object`);
            } else {
              // Single exdate
              exdates = [new Date(event.exdate)];
              console.log(`[CALDAV]   Parsed 1 EXDATE entry from single value`);
            }
            if (exdates && exdates.length > 0) {
              console.log(`[CALDAV]   EXDATE dates: ${exdates.map(d => d.toISOString()).join(', ')}`);
            }
          }

          const calendarEvent: CalendarEvent = {
            uid: event.uid || key,
            summary: event.summary,
            description: event.description || undefined,
            start: new Date(event.start),
            end: new Date(event.end),
            location: event.location || undefined,
            categories: undefined, // Categories not reliably available in node-ical
            rrule: event.rrule ? event.rrule.toString() : undefined,
            recurrenceId: event.recurrenceid ? new Date(event.recurrenceid) : undefined,
            exdate: exdates
          };

          events.push(calendarEvent);
        }
      }

      return events;
    } catch (error) {
      console.error('Failed to parse ICS data:', error);
      throw new Error(ERROR_MESSAGES.CALENDAR_PARSE_ERROR);
    }
  }

  /**
   * Fetch all Sorbonne calendars
   */
  async fetchAllCalendars(sources: string[]): Promise<Record<string, CalendarFetchResult>> {
    const results: Record<string, CalendarFetchResult> = {};
    
    // Fetch all calendars in parallel
    const promises = sources.map(async (sourceId) => {
      try {
        const sorborneSource = SORBONNE_CALENDARS[sourceId as keyof typeof SORBONNE_CALENDARS];
        if (!sorborneSource) throw new Error(`Unknown source: ${sourceId}`);
        
        // Convert SorborneCalendarSource to CalendarSource
        // Handle URLs with embedded auth (https://user:pass@domain.com/path)
        let cleanUrl = sorborneSource.url;
        let auth = SORBONNE_AUTH;
        
        if (sorborneSource.url.includes('@')) {
          // Extract embedded auth from URL
          const urlParts = sorborneSource.url.match(/https?:\/\/([^:]+):([^@]+)@(.+)/);
          if (urlParts) {
            const [, username, password, restOfUrl] = urlParts;
            cleanUrl = `https://${restOfUrl}`;
            auth = { username, password };
          }
        }
        
        const source: CalendarSource = {
          name: sorborneSource.name,
          url: cleanUrl,
          auth: auth
        };
        
        const icsData = await this.fetchCalendar(source);
        const events = this.parseICSData(icsData);
        
        return { sourceId, result: { success: true, events } };
      } catch (error) {
        return { sourceId, result: { success: false, events: [], error: error instanceof Error ? error.message : 'Unknown error' } };
      }
    });

    const responses = await Promise.allSettled(promises);
    
    responses.forEach((response, index) => {
      const sourceId = sources[index];
      
      if (response.status === 'fulfilled') {
        results[sourceId] = response.value.result;
      } else {
        results[sourceId] = {
          success: false,
          events: [],
          error: `Failed to fetch ${sourceId}: ${response.reason}`
        };
      }
    });

    return results;
  }

  /**
   * Check health of all calendar sources
   */
  async healthCheck(): Promise<Record<string, 'up' | 'down'>> {
    const health: Record<string, 'up' | 'down'> = {};
    
    const promises = Object.keys(SORBONNE_CALENDARS).map(async (sourceId) => {
      try {
        const sorborneSource = SORBONNE_CALENDARS[sourceId as keyof typeof SORBONNE_CALENDARS];
        if (!sorborneSource) throw new Error(`Unknown source: ${sourceId}`);
        
        // Convert SorborneCalendarSource to CalendarSource
        // Handle URLs with embedded auth (https://user:pass@domain.com/path)
        let cleanUrl = sorborneSource.url;
        let auth = SORBONNE_AUTH;
        
        if (sorborneSource.url.includes('@')) {
          // Extract embedded auth from URL
          const urlParts = sorborneSource.url.match(/https?:\/\/([^:]+):([^@]+)@(.+)/);
          if (urlParts) {
            const [, username, password, restOfUrl] = urlParts;
            cleanUrl = `https://${restOfUrl}`;
            auth = { username, password };
          }
        }
        
        const source: CalendarSource = {
          name: sorborneSource.name,
          url: cleanUrl,
          auth: auth
        };
        
        await this.fetchCalendar(source);
        return { sourceId, status: 'up' as const };
      } catch {
        return { sourceId, status: 'down' as const };
      }
    });

    const responses = await Promise.allSettled(promises);
    
    responses.forEach((response, index) => {
      const sourceId = Object.keys(SORBONNE_CALENDARS)[index];
      
      if (response.status === 'fulfilled') {
        health[sourceId] = response.value.status;
      } else {
        health[sourceId] = 'down';
      }
    });

    return health;
  }

  /**
   * Clear cache for a specific source or all sources
   */
  clearCache(sourceId?: string): void {
    if (sourceId) {
      this.cache.delete(`calendar_${sourceId}`);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const caldavClient = new CalDAVClient();
export default CalDAVClient;
