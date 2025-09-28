// API endpoint for analyzing calendar events and detecting available groups

import { NextRequest, NextResponse } from 'next/server';
import { caldavClient } from '@/lib/caldav-client';
import { SORBONNE_CALENDARS } from '@/lib/constants';
import { CalendarEvent, CalendarFetchResult } from '@/lib/types';

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
    types: { [type: string]: number };
    groups: { td: string[]; tme: string[] };
  };
}

function analyzeEventSummary(summary: string): EventAnalysis {
  const lowerSummary = summary.toLowerCase();
  
  // Extract course information
  const coursePatterns = [
    /([A-Z]{2,6})\s*[-\s]/,  // MLBDA, DALAS, etc.
    /\b([A-Z]{2,6})\b/       // Standalone course codes
  ];
  
  let course: string | undefined = undefined;
  for (const pattern of coursePatterns) {
    const match = summary.match(pattern);
    if (match) {
      course = match[1];
      break;
    }
  }
  
  // Determine event type and extract group
  let type: EventAnalysis['type'] = 'other';
  let group: string | undefined = undefined;
  
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

    // Fetch events from specified sources
    const allEvents: CalendarEvent[] = [];
    const results: { [source: string]: { success: boolean; error?: string; eventCount: number } } = {};

    const validSources = sources.filter(source => 
      Object.keys(SORBONNE_CALENDARS).includes(source)
    );

    if (validSources.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid sources specified',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    // Fetch from all sources with timeout protection
    console.log(`Fetching events from sources: ${validSources.join(', ')}`);
    
    try {
      // Add overall timeout for the entire operation (45 seconds max for production)
      const fetchPromise = caldavClient.fetchAllCalendars(validSources);
      const overallTimeout = process.env.NODE_ENV === 'production' ? 45000 : 25000;
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Overall fetch timeout')), overallTimeout)
      );
      
      const fetchResults = await Promise.race([fetchPromise, timeoutPromise]) as Record<string, CalendarFetchResult>;
      
      // Process results
      for (const [source, result] of Object.entries(fetchResults)) {
        if (result.success) {
          allEvents.push(...result.events);
          results[source] = { success: true, eventCount: result.events.length };
          console.log(`✅ ${source}: ${result.events.length} events`);
        } else {
          results[source] = { success: false, error: result.error, eventCount: 0 };
          console.log(`❌ ${source}: ${result.error}`);
        }
      }
    } catch (error) {
      console.log(`⚠️ Fetch operation timed out or failed: ${error}`);
      // Mark all sources as failed but provide helpful error message
      for (const source of validSources) {
        results[source] = { 
          success: false, 
          error: 'Sorbonne servers are slow - this is normal. Try refreshing the page in a few seconds.', 
          eventCount: 0 
        };
      }
      
      // Return partial success even if no events were fetched
      // This allows the UI to show the error message instead of completely failing
      return NextResponse.json({
        success: false,
        error: 'Calendar servers are temporarily slow. Please try again in a moment.',
        data: {
          summary: {
            totalEvents: 0,
            analyzedEvents: 0,
            coursesFound: 0,
            eventsByType: {
              cours: 0, td: 0, tme: 0, exam: 0, soutenance: 0, rattrapage: 0, other: 0
            }
          },
          courseAnalysis: {},
          topPatterns: [],
          sources: Object.entries(results).map(([source, result]) => ({
            source,
            ...result
          }))
        },
        timestamp: new Date().toISOString()
      });
    }

    // Analyze events
    const courseAnalysis: CourseAnalysis = {};
    const patternCounts = new Map<string, number>();
    const eventAnalyses: EventAnalysis[] = [];

    for (const event of allEvents) {
      const analysis = analyzeEventSummary(event.summary);
      
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
            types: {},
            groups: { td: [], tme: [] }
          };
        }
        
        const courseData = courseAnalysis[analysis.course];
        courseData.totalEvents++;
        courseData.types[analysis.type] = (courseData.types[analysis.type] || 0) + 1;
        
        // Collect unique groups
        if (analysis.type === 'td' && analysis.group && !courseData.groups.td.includes(analysis.group)) {
          courseData.groups.td.push(analysis.group);
        }
        if (analysis.type === 'tme' && analysis.group && !courseData.groups.tme.includes(analysis.group)) {
          courseData.groups.tme.push(analysis.group);
        }
      }
    }

    // Sort groups numerically
    Object.values(courseAnalysis).forEach(course => {
      course.groups.td.sort((a, b) => parseInt(a) - parseInt(b));
      course.groups.tme.sort((a, b) => parseInt(a) - parseInt(b));
    });

    // Convert pattern counts to array and sort
    const topPatterns = Array.from(patternCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([pattern, count]) => ({ pattern, count }));

    // Determine if we have any successful results
    const hasSuccessfulResults = Object.values(results).some(r => r.success);

    return NextResponse.json({
      success: hasSuccessfulResults, // Success if at least one source worked
      data: {
        summary: {
          totalEvents: allEvents.length,
          analyzedEvents: eventAnalyses.length,
          coursesFound: Object.keys(courseAnalysis).length,
          eventsByType: {
            cours: eventAnalyses.filter(e => e.type === 'cours').length,
            td: eventAnalyses.filter(e => e.type === 'td').length,
            tme: eventAnalyses.filter(e => e.type === 'tme').length,
            exam: eventAnalyses.filter(e => e.type === 'exam').length,
            soutenance: eventAnalyses.filter(e => e.type === 'soutenance').length,
            rattrapage: eventAnalyses.filter(e => e.type === 'rattrapage').length,
            other: eventAnalyses.filter(e => e.type === 'other').length
          }
        },
        courseAnalysis,
        topPatterns,
        sources: Object.entries(results).map(([source, result]) => ({
          source,
          ...result
        }))
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in analyze-events:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
