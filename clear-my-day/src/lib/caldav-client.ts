// CalDAV client for fetching Sorbonne University calendar data

import { CalendarEvent, CalendarFetchResult, SorborneCalendarSource } from './types';
import { SORBONNE_AUTH, APP_CONFIG } from './constants';

export class CalDAVClient {
  private cache = new Map<string, { data: CalendarEvent[]; timestamp: number; etag?: string }>();

  /**
   * Fetch calendar events from a Sorbonne CalDAV source
   */
  async fetchCalendar(source: SorborneCalendarSource): Promise<CalendarFetchResult> {
    try {
      console.log(`Fetching calendar for ${source.id} from ${source.url}`);

      // Check cache first
      const cached = this.cache.get(source.id);
      if (cached && Date.now() - cached.timestamp < APP_CONFIG.CACHE_TIMEOUT) {
        console.log(`Using cached data for ${source.id}`);
        return {
          success: true,
          events: cached.data,
          lastModified: new Date(cached.timestamp)
        };
      }

      // Fetch from CalDAV server
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), APP_CONFIG.TIMEOUT);

      // Remove credentials from URL if present and use Authorization header instead
      const cleanUrl = source.url.replace(/https?:\/\/[^@]+@/, (match) => {
        return match.split('@')[0].split('://')[0] + '://';
      });

      const response = await fetch(cleanUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${SORBONNE_AUTH.username}:${SORBONNE_AUTH.password}`).toString('base64')}`,
          'User-Agent': 'ClearMyDay/1.0 (Sorbonne Calendar Filter)',
          'Accept': 'text/calendar, application/calendar+xml',
          'Cache-Control': 'no-cache',
          ...(cached?.etag && { 'If-None-Match': cached.etag })
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.status === 304 && cached) {
        console.log(`Calendar ${source.id} not modified, using cache`);
        return {
          success: true,
          events: cached.data,
          lastModified: new Date(cached.timestamp)
        };
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const icsContent = await response.text();
      const events = this.parseICSContent(icsContent, source.id);

      // Update cache
      const etag = response.headers.get('etag');
      this.cache.set(source.id, {
        data: events,
        timestamp: Date.now(),
        etag: etag || undefined
      });

      console.log(`Successfully fetched ${events.length} events for ${source.id}`);

      return {
        success: true,
        events,
        lastModified: new Date(),
        etag: etag || undefined
      };

    } catch (error) {
      console.error(`Failed to fetch calendar ${source.id}:`, error);
      
      // Return cached data if available, even if stale
      const cached = this.cache.get(source.id);
      if (cached) {
        console.log(`Using stale cached data for ${source.id}`);
        return {
          success: true,
          events: cached.data,
          lastModified: new Date(cached.timestamp),
          error: `Using cached data: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }

      return {
        success: false,
        events: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Fetch calendars for multiple masters in parallel
   */
  async fetchAllCalendars(masterIds: string[]): Promise<Record<string, CalendarFetchResult>> {
    const { SORBONNE_CALENDARS } = await import('./constants');
    
    const results: Record<string, CalendarFetchResult> = {};
    
    // Fetch all calendars in parallel
    const fetchPromises = masterIds.map(async (masterId) => {
      const source = SORBONNE_CALENDARS[masterId];
      if (!source) {
        results[masterId] = {
          success: false,
          events: [],
          error: `Unknown master program: ${masterId}`
        };
        return;
      }

      results[masterId] = await this.fetchCalendar(source);
    });

    await Promise.all(fetchPromises);
    return results;
  }

  /**
   * Parse ICS content into CalendarEvent objects
   */
  private parseICSContent(icsContent: string, sourceId: string): CalendarEvent[] {
    const events: CalendarEvent[] = [];
    const lines = icsContent.split(/\r\n|\n/);
    
    let currentEvent: Partial<CalendarEvent> = {};
    let inEvent = false;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine === 'BEGIN:VEVENT') {
        inEvent = true;
        currentEvent = { categories: [sourceId] };
      } else if (trimmedLine === 'END:VEVENT' && inEvent) {
        if (currentEvent.uid && currentEvent.summary && currentEvent.start && currentEvent.end) {
          events.push(currentEvent as CalendarEvent);
        }
        currentEvent = {};
        inEvent = false;
      } else if (inEvent) {
        this.parseEventLine(trimmedLine, currentEvent);
      }
    }

    return events;
  }

  /**
   * Parse a single line of an ICS event
   */
  private parseEventLine(line: string, event: Partial<CalendarEvent>): void {
    if (line.startsWith('UID:')) {
      event.uid = line.substring(4);
    } else if (line.startsWith('SUMMARY:')) {
      event.summary = this.unescapeICSText(line.substring(8));
    } else if (line.startsWith('DTSTART')) {
      const dateStr = this.extractDateFromLine(line);
      if (dateStr) {
        event.start = this.parseICSDate(dateStr);
      }
    } else if (line.startsWith('DTEND')) {
      const dateStr = this.extractDateFromLine(line);
      if (dateStr) {
        event.end = this.parseICSDate(dateStr);
      }
    } else if (line.startsWith('LOCATION:')) {
      event.location = this.unescapeICSText(line.substring(9));
    } else if (line.startsWith('DESCRIPTION:')) {
      event.description = this.unescapeICSText(line.substring(12));
    } else if (line.startsWith('RRULE:')) {
      event.rrule = line.substring(6);
    } else if (line.startsWith('RECURRENCE-ID')) {
      const dateStr = this.extractDateFromLine(line);
      if (dateStr) {
        event.recurrenceId = new Date(this.parseICSDate(dateStr));
      }
    }
  }

  /**
   * Extract date string from ICS line (handles TZID parameters)
   */
  private extractDateFromLine(line: string): string | null {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) return null;
    return line.substring(colonIndex + 1);
  }

  /**
   * Parse ICS date format to ISO string
   */
  private parseICSDate(dateStr: string): string {
    if (dateStr.includes('T')) {
      // DateTime format: 20240101T080000Z or 20240101T080000
      const cleanStr = dateStr.replace(/[TZ]/g, '');
      const year = cleanStr.substring(0, 4);
      const month = cleanStr.substring(4, 6);
      const day = cleanStr.substring(6, 8);
      const hour = cleanStr.substring(8, 10) || '00';
      const minute = cleanStr.substring(10, 12) || '00';
      const second = cleanStr.substring(12, 14) || '00';
      
      let date: Date;
      if (dateStr.endsWith('Z')) {
        // UTC time
        date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
      } else {
        // Local time - treat as Europe/Paris
        date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
      }
      
      return date.toISOString();
    } else {
      // Date format: 20240101
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      const date = new Date(`${year}-${month}-${day}`);
      return date.toISOString();
    }
  }

  /**
   * Unescape ICS text content
   */
  private unescapeICSText(text: string): string {
    return text
      .replace(/\\n/g, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\');
  }

  /**
   * Clear cache for a specific source or all sources
   */
  clearCache(sourceId?: string): void {
    if (sourceId) {
      this.cache.delete(sourceId);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: Array<{ id: string; age: number; eventCount: number }> } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([id, data]) => ({
      id,
      age: Math.round((now - data.timestamp) / 1000),
      eventCount: data.data.length
    }));

    return {
      size: this.cache.size,
      entries
    };
  }
}

// Export singleton instance
export const caldavClient = new CalDAVClient();
export default CalDAVClient;
