// API endpoint for analyzing calendar events, timezone handling, and field usage

import { NextRequest, NextResponse } from 'next/server';
import { caldavClient } from '@/lib/caldav-client';
import { SORBONNE_CALENDARS } from '@/lib/constants';
import { CalendarEvent } from '@/lib/types';

interface EventAnalysis {
  summary: string;
  course?: string;
  type: 'cours' | 'td' | 'tme' | 'exam' | 'soutenance' | 'rattrapage' | 'other';
  group?: string;
  pattern: string;
  count: number;
}

interface CourseAnalysis {
  [courseId: string]: {
    totalEvents: number;
    eventTypes: {
      [type: string]: {
        count: number;
        examples: string[];
        groups?: string[];
      };
    };
  };
}

function analyzeEventSummary(summary: string): EventAnalysis {
  const lowerSummary = summary.toLowerCase();
  
  // Extract course ID patterns
  const coursePatterns = [
    /(?:MU)?4IN\d+[-_]?([A-Z]+)/i,
    /([A-Z]{3,})-(?:cours|td|tme)/i,
    /(?:cours|td|tme).*?([A-Z]{3,})/i
  ];
  
  let course = null;
  for (const pattern of coursePatterns) {
    const match = summary.match(pattern);
    if (match) {
      course = match[1];
      break;
    }
  }
  
  // Determine event type and extract group
  let type: EventAnalysis['type'] = 'other';
  let group = null;
  
  if (lowerSummary.includes('cours')) {
    type = 'cours';
  } else if (lowerSummary.includes('exam')) {
    type = 'exam';
  } else if (lowerSummary.includes('soutenance')) {
    type = 'soutenance';
  } else if (lowerSummary.includes('rattrapage')) {
    type = 'rattrapage';
  } else if (lowerSummary.includes('td')) {
    type = 'td';
    const tdMatch = summary.match(/td\s*(\d+)/i);
    if (tdMatch) group = tdMatch[1];
  } else if (lowerSummary.includes('tme')) {
    type = 'tme';
    const tmeMatch = summary.match(/tme\s*(\d+)/i);
    if (tmeMatch) group = tmeMatch[1];
  }
  
  return {
    summary,
    course,
    type,
    group,
    pattern: summary,
    count: 1
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sources = searchParams.get('sources')?.split(',') || ['DAC'];
    const courseFilter = searchParams.get('course'); // Optional course filter
    const analyzeTimezones = searchParams.get('timezones') === 'true'; // Timezone analysis flag
    
    // Validate sources against available calendars
    const validSources = sources.filter(source => 
      Object.keys(SORBONNE_CALENDARS).includes(source)
    );

    if (validSources.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid calendar sources specified' },
        { status: 400 }
      );
    }

    // Fetch calendar data
    const results = await caldavClient.fetchAllCalendars(validSources);
    
    // Combine all events
    const allEvents = Object.values(results)
      .filter(result => result.success)
      .flatMap(result => result.events);

    if (allEvents.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          totalEvents: 0,
          analysis: {},
          patterns: []
        }
      });
    }

    // Analyze events
    const courseAnalysis: CourseAnalysis = {};
    const patternCounts = new Map<string, number>();
    const eventAnalyses: EventAnalysis[] = [];
    const fieldUsage = new Map<string, number>();
    const timezoneAnalysis = {
      dstTransitionEvents: [] as CalendarEvent[],
      timezoneUsage: new Map<string, number>(),
      october2024Events: [] as CalendarEvent[]
    };

    for (const event of allEvents) {
      const analysis = analyzeEventSummary(event.summary);
      
      // Analyze field usage
      Object.keys(event).forEach(field => {
        fieldUsage.set(field, (fieldUsage.get(field) || 0) + 1);
      });
      
      // Timezone analysis for DST investigation
      if (analyzeTimezones && event.start) {
        const eventDate = new Date(event.start);
        const isOctober2024 = eventDate.getFullYear() === 2024 && eventDate.getMonth() === 9; // October is month 9
        
        if (isOctober2024) {
          timezoneAnalysis.october2024Events.push({
            summary: event.summary,
            start: event.start,
            date: eventDate.toISOString(),
            weekOfMonth: Math.ceil(eventDate.getDate() / 7),
            dayOfWeek: eventDate.getDay()
          });
        }
        
        // Check for DST transition (last Sunday of October 2024 was Oct 27)
        if (eventDate >= new Date('2024-10-20') && eventDate <= new Date('2024-11-03')) {
          timezoneAnalysis.dstTransitionEvents.push({
            summary: event.summary,
            start: event.start,
            date: eventDate.toISOString(),
            beforeDST: eventDate < new Date('2024-10-27T02:00:00Z'),
            timezone: 'Europe/Paris'
          });
        }
      }
      
      // Filter by course if specified
      if (courseFilter && analysis.course !== courseFilter.toUpperCase()) {
        continue;
      }
      
      eventAnalyses.push(analysis);
      
      // Count patterns
      const patternKey = analysis.summary.replace(/\d+/g, 'X'); // Replace numbers with X for pattern matching
      patternCounts.set(patternKey, (patternCounts.get(patternKey) || 0) + 1);
      
      // Build course analysis
      if (analysis.course) {
        if (!courseAnalysis[analysis.course]) {
          courseAnalysis[analysis.course] = {
            totalEvents: 0,
            eventTypes: {}
          };
        }
        
        courseAnalysis[analysis.course].totalEvents++;
        
        const typeKey = analysis.group ? `${analysis.type}_${analysis.group}` : analysis.type;
        if (!courseAnalysis[analysis.course].eventTypes[typeKey]) {
          courseAnalysis[analysis.course].eventTypes[typeKey] = {
            count: 0,
            examples: [],
            groups: analysis.group ? [analysis.group] : undefined
          };
        }
        
        courseAnalysis[analysis.course].eventTypes[typeKey].count++;
        if (courseAnalysis[analysis.course].eventTypes[typeKey].examples.length < 3) {
          courseAnalysis[analysis.course].eventTypes[typeKey].examples.push(analysis.summary);
        }
        
        if (analysis.group && courseAnalysis[analysis.course].eventTypes[typeKey].groups) {
          if (!courseAnalysis[analysis.course].eventTypes[typeKey].groups!.includes(analysis.group)) {
            courseAnalysis[analysis.course].eventTypes[typeKey].groups!.push(analysis.group);
          }
        }
      }
    }

    // Get most common patterns
    const topPatterns = Array.from(patternCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([pattern, count]) => ({ pattern, count }));

    // Convert Maps to objects for JSON response
    const fieldUsageObj = Object.fromEntries(fieldUsage);
    const timezoneUsageObj = Object.fromEntries(timezoneAnalysis.timezoneUsage);

    return NextResponse.json({
      success: true,
      data: {
        totalEvents: eventAnalyses.length,
        courseAnalysis,
        topPatterns,
        eventTypes: {
          cours: eventAnalyses.filter(e => e.type === 'cours').length,
          td: eventAnalyses.filter(e => e.type === 'td').length,
          tme: eventAnalyses.filter(e => e.type === 'tme').length,
          exam: eventAnalyses.filter(e => e.type === 'exam').length,
          soutenance: eventAnalyses.filter(e => e.type === 'soutenance').length,
          rattrapage: eventAnalyses.filter(e => e.type === 'rattrapage').length,
          other: eventAnalyses.filter(e => e.type === 'other').length
        },
        fieldUsage: fieldUsageObj,
        ...(analyzeTimezones && {
          timezoneAnalysis: {
            dstTransitionEvents: timezoneAnalysis.dstTransitionEvents,
            october2024EventCount: timezoneAnalysis.october2024Events.length,
            october2024Events: timezoneAnalysis.october2024Events.slice(0, 10), // First 10 examples
            timezoneUsage: timezoneUsageObj
          }
        })
      }
    });

  } catch (error) {
    console.error('Error analyzing events:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to analyze events' },
      { status: 500 }
    );
  }
}
