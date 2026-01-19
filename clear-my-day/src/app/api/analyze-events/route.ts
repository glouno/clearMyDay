// API endpoint for analyzing calendar events and detecting available groups

import { NextRequest, NextResponse } from 'next/server';
import { caldavClient } from '@/lib/caldav-client';
import { SORBONNE_CALENDARS } from '@/lib/constants';
import { CalendarEvent, CalendarFetchResult } from '@/lib/types';
import { supabase, isCacheValid, CACHE_TTL_HOURS } from '@/lib/supabase';

// Simple course extractor helper
function extractCourseFromSummary(summary: string): string | null {
  if (!summary) return null;

  if (/\b(OIP|INOIP)\b/i.test(summary)) return 'OIP';
  if (/\bLVAN\b/i.test(summary) || /anglais/i.test(summary)) return 'ANGLAIS';

  // Try standard patterns
  const patterns = [
    /^4I\d+-(?:TD|TME)\d+-([A-Z]+)/i,
    /^MU4IN\d+-([A-Z]+)-/i,
    /^UM4IN\d+-([A-Z]+)-/i,
    /MU4IN\d+-([A-Z]+)-(?:TD|TME|Cours|ER)/i,
    /UM4IN\d+-([A-Z]+)-(?:TD|TME|Cours|ER)/i
  ];

  for (const pattern of patterns) {
    const match = summary.match(pattern);
    if (match) return match[1].toUpperCase();
  }

  // Fallback: splitting by hyphen
  if (/^(?:UM|MU|4I)/i.test(summary)) {
    const excludeTokens = new Set(['UM', 'MU', 'IN', 'TD', 'TME', 'TP', 'COURS', 'EXAM', 'EXAMEN', 'SALLE', 'AMPHI', 'GROUPE', 'GROUP', 'GR']);
    const candidates = summary.split('-')
      .map(t => t.trim())
      .filter(t => t.length >= 2 && t.length <= 10 && /^[A-Z]{2,10}$/.test(t) && !excludeTokens.has(t));

    if (candidates.length > 0) return candidates[0].toUpperCase();
  }

  return null;
}

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

interface SourceAnalysisResult {
  success: boolean;
  error?: string;
  summary?: {
    totalEvents: number;
    analyzedEvents: number;
    coursesFound: number;
    eventsByType: { [type: string]: number };
  };
  courseAnalysis?: CourseAnalysis;
  topPatterns?: Array<{ pattern: string; count: number }>;
}

function analyzeEventSummary(summary: string): EventAnalysis {
  const lowerSummary = summary.toLowerCase();

  const extractedCourse = extractCourseFromSummary(summary);
  const course: string | undefined = extractedCourse || undefined;

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

  // Check for OIP-specific group patterns (Gr2, Gr3, etc.)
  if (!group) {
    const grMatch = summary.match(/gr(?:oupe)?\s*(\d+)/i);
    if (grMatch) {
      group = grMatch[1];
      // If it's a group event but type not set, mark as 'other' with group
      if (type === 'other') {
        type = 'td'; // Treat Gr groups like TD groups
      }
    }
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

    // NEW STRATEGY: Check cache for each individual master
    const cachedResults: { [source: string]: SourceAnalysisResult } = {};
    const sourcesToFetch: string[] = [];

    if (supabase) {
      for (const source of validSources) {
        try {
          const cacheKey = `analyze-events-${source}`; // Individual cache key
          const { data: cachedData, error } = await supabase
            .from('analyze_events_cache')
            .select('*')
            .eq('id', cacheKey)
            .single();

          if (!error && cachedData && isCacheValid(cachedData)) {
            console.log(`✅ Cache hit for ${source}`);
            cachedResults[source] = cachedData.data;
          } else {
            console.log(`❌ Cache miss for ${source}`);
            sourcesToFetch.push(source);
          }
        } catch (cacheError) {
          console.warn(`Cache check failed for ${source}:`, cacheError);
          sourcesToFetch.push(source);
        }
      }
    } else {
      sourcesToFetch.push(...validSources);
    }

    // Fetch events only from sources not in cache
    const fetchedResults: { [source: string]: SourceAnalysisResult } = {};

    if (sourcesToFetch.length > 0) {
      console.log(`Fetching events from sources: ${sourcesToFetch.join(', ')}`);

      try {
        // Add overall timeout for the entire operation (50 seconds max for production)
        const fetchPromise = caldavClient.fetchAllCalendars(sourcesToFetch);
        const overallTimeout = process.env.NODE_ENV === 'production' ? 50000 : 35000;
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Overall fetch timeout')), overallTimeout)
        );

        const fetchResults = await Promise.race([fetchPromise, timeoutPromise]) as Record<string, CalendarFetchResult>;

        // Process and analyze each source individually
        for (const source of sourcesToFetch) {
          const result = fetchResults[source];
          if (result && result.success) {
            const sourceAnalysis = await analyzeSourceEvents(source, result.events, courseFilter);
            fetchedResults[source] = sourceAnalysis;

            // Cache this individual source result
            if (supabase) {
              try {
                const cacheKey = `analyze-events-${source}`;
                const expiresAt = new Date();
                expiresAt.setHours(expiresAt.getHours() + CACHE_TTL_HOURS);

                await supabase
                  .from('analyze_events_cache')
                  .upsert({
                    id: cacheKey,
                    sources: [source], // Single source array
                    data: sourceAnalysis,
                    expires_at: expiresAt.toISOString()
                  });

                console.log(`💾 Cached results for ${source}`);
              } catch (cacheError) {
                console.warn(`Failed to cache results for ${source}:`, cacheError);
              }
            }
          } else {
            console.log(`❌ ${source}: ${result?.error || 'Unknown error'}`);
            fetchedResults[source] = {
              success: false,
              error: result?.error || 'Unknown error',
              courseAnalysis: {},
              summary: { totalEvents: 0, analyzedEvents: 0, coursesFound: 0, eventsByType: {} }
            };
          }
        }
      } catch (error) {
        console.log(`⚠️ Fetch operation timed out or failed: ${error}`);
        for (const source of sourcesToFetch) {
          fetchedResults[source] = {
            success: false,
            error: 'Sorbonne servers are slow - this is normal. Try refreshing the page in a few seconds.',
            courseAnalysis: {},
            summary: { totalEvents: 0, analyzedEvents: 0, coursesFound: 0, eventsByType: {} }
          };
        }
      }
    }

    // Combine cached and fetched results
    const allSourceResults = { ...cachedResults, ...fetchedResults };

    // Merge all course analyses from different sources
    const combinedCourseAnalysis: CourseAnalysis = {};
    const combinedPatterns = new Map<string, number>();
    let totalEvents = 0;
    let totalAnalyzed = 0;
    const eventsByType = {
      cours: 0, td: 0, tme: 0, exam: 0, soutenance: 0, rattrapage: 0, other: 0
    };

    const sourceResults: Array<{
      source: string;
      success: boolean;
      error?: string;
      eventCount: number;
    }> = [];

    for (const [source, sourceData] of Object.entries(allSourceResults)) {
      if (sourceData.success !== false) {
        // Merge course analysis
        if (sourceData.courseAnalysis) {
          Object.assign(combinedCourseAnalysis, sourceData.courseAnalysis);
        }

        // Merge patterns
        if (sourceData.topPatterns) {
          sourceData.topPatterns.forEach((p: { pattern: string; count: number }) => {
            combinedPatterns.set(p.pattern, (combinedPatterns.get(p.pattern) || 0) + p.count);
          });
        }

        // Merge summary stats
        if (sourceData.summary) {
          totalEvents += sourceData.summary.totalEvents || 0;
          totalAnalyzed += sourceData.summary.analyzedEvents || 0;

          if (sourceData.summary.eventsByType) {
            Object.keys(eventsByType).forEach(type => {
              const eventCount = sourceData.summary?.eventsByType?.[type] || 0;
              eventsByType[type as keyof typeof eventsByType] += eventCount;
            });
          }
        }

        sourceResults.push({
          source,
          success: true,
          eventCount: sourceData.summary?.totalEvents || 0
        });
      } else {
        sourceResults.push({
          source,
          success: false,
          error: sourceData.error || 'Unknown error',
          eventCount: 0
        });
      }
    }

    // Convert combined patterns to sorted array
    const topPatterns = Array.from(combinedPatterns.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([pattern, count]) => ({ pattern, count }));

    const hasSuccessfulResults = sourceResults.some(r => r.success);

    const responseData = {
      summary: {
        totalEvents,
        analyzedEvents: totalAnalyzed,
        coursesFound: Object.keys(combinedCourseAnalysis).length,
        eventsByType
      },
      courseAnalysis: combinedCourseAnalysis,
      topPatterns,
      sources: sourceResults
    };

    return NextResponse.json({
      success: hasSuccessfulResults,
      data: responseData,
      cached: Object.keys(cachedResults).length > 0,
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

// Helper function to analyze events from a single source
async function analyzeSourceEvents(source: string, events: CalendarEvent[], courseFilter?: string | null) {
  const courseAnalysis: CourseAnalysis = {};
  const patternCounts = new Map<string, number>();
  const eventAnalyses: EventAnalysis[] = [];

  for (const event of events) {
    const analysis = analyzeEventSummary(event.summary);

    // Filter by course if specified
    if (courseFilter && analysis.course !== courseFilter.toUpperCase()) {
      continue;
    }

    eventAnalyses.push(analysis);

    // Count patterns
    const patternKey = analysis.summary.replace(/\d+/g, 'X');
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

  return {
    success: true,
    summary: {
      totalEvents: events.length,
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
    topPatterns
  };
}
