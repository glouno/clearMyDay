// Debug endpoint to test ICS parsing and calendar event generation

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, filter } = body;

    // Generate a test calendar with the selected groups
    const response = await fetch(`${request.nextUrl.origin}/api/generate-calendar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, filter })
    });

    const data = await response.json();
    if (!data.success) {
      return NextResponse.json({ success: false, error: 'Failed to generate calendar', details: data });
    }

    // Fetch the raw ICS content
    const calendarResponse = await fetch(data.data.subscriptionUrl);
    const icsContent = await calendarResponse.text();

    // Debug: Parse the ICS content step by step
    const lines = icsContent.split(/\r\n|\n/);
    const debugInfo = {
      totalLines: lines.length,
      firstFewLines: lines.slice(0, 10),
      lastFewLines: lines.slice(-10),
      eventBlocks: [] as any[],
      parseErrors: [] as any[]
    };

    // Find all VEVENT blocks
    let currentEvent: any = {};
    let inEvent = false;
    let eventCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line === 'BEGIN:VEVENT') {
        inEvent = true;
        currentEvent = { lineStart: i, rawLines: [] };
        eventCount++;
      } else if (line === 'END:VEVENT') {
        if (inEvent) {
          currentEvent.lineEnd = i;
          currentEvent.rawLines.push(line);
          
          // Try to parse this event
          try {
            const parsedEvent = parseEventBlock(currentEvent.rawLines);
            currentEvent.parsed = parsedEvent;
          } catch (error) {
            currentEvent.parseError = error instanceof Error ? error.message : 'Unknown error';
            debugInfo.parseErrors.push({
              eventIndex: eventCount - 1,
              error: currentEvent.parseError,
              rawLines: currentEvent.rawLines
            });
          }
          
          debugInfo.eventBlocks.push(currentEvent);
        }
        inEvent = false;
      } else if (inEvent) {
        currentEvent.rawLines.push(line);
      }
    }

    return NextResponse.json({
      success: true,
      debug: debugInfo,
      rawIcsPreview: icsContent.substring(0, 1000) + (icsContent.length > 1000 ? '...' : ''),
      eventCount,
      subscriptionUrl: data.data.subscriptionUrl
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

function parseEventBlock(lines: string[]): any {
  const event: any = {};
  
  for (const line of lines) {
    if (line.startsWith('SUMMARY:')) {
      event.title = line.substring(8);
    } else if (line.startsWith('DTSTART')) {
      // Handle both DTSTART: and DTSTART;TZID=Europe/Paris: formats
      const colonIndex = line.indexOf(':');
      if (colonIndex !== -1) {
        const dateStr = line.substring(colonIndex + 1);
        event.start = parseICSDate(dateStr);
        event.rawStart = dateStr;
      }
    } else if (line.startsWith('DTEND')) {
      // Handle both DTEND: and DTEND;TZID=Europe/Paris: formats
      const colonIndex = line.indexOf(':');
      if (colonIndex !== -1) {
        const dateStr = line.substring(colonIndex + 1);
        event.end = parseICSDate(dateStr);
        event.rawEnd = dateStr;
      }
    } else if (line.startsWith('UID:')) {
      event.id = line.substring(4);
    } else if (line.startsWith('RRULE:')) {
      event.rrule = line.substring(6);
    } else if (line.startsWith('LOCATION:')) {
      event.location = line.substring(9);
    } else if (line.startsWith('DESCRIPTION:')) {
      event.description = line.substring(12);
    }
  }
  
  if (!event.title || !event.start || !event.end) {
    throw new Error(`Incomplete event: title=${!!event.title}, start=${!!event.start}, end=${!!event.end}, rawLines=${lines.join('|')}`);
  }
  
  return event;
}

function parseICSDate(dateStr: string): Date {
  // Handle different ICS date formats
  if (dateStr.includes('T')) {
    // DateTime format: 20240101T080000Z or 20240101T080000
    const cleanStr = dateStr.replace(/[TZ]/g, '');
    const year = cleanStr.substring(0, 4);
    const month = cleanStr.substring(4, 6);
    const day = cleanStr.substring(6, 8);
    const hour = cleanStr.substring(8, 10) || '00';
    const minute = cleanStr.substring(10, 12) || '00';
    const second = cleanStr.substring(12, 14) || '00';
    
    const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${dateStr.endsWith('Z') ? 'Z' : ''}`);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date: ${dateStr}`);
    }
    return date;
  } else {
    // Date format: 20240101
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    const date = new Date(`${year}-${month}-${day}`);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date: ${dateStr}`);
    }
    return date;
  }
}
