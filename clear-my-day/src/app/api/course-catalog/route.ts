import { NextRequest, NextResponse } from 'next/server';
import { caldavClient } from '@/lib/caldav-client';
import { SORBONNE_CALENDARS } from '@/lib/constants';
import { CalendarEvent, CalendarFetchResult } from '@/lib/types';
import { extractCourseFromSummaryDetailed } from '@/lib/course-extractor';
import { supabase, isCacheValid, CACHE_TTL_HOURS } from '@/lib/supabase';

type EventType = 'cours' | 'td' | 'tme' | 'exam' | 'soutenance' | 'rattrapage' | 'other';

function detectType(summary: string): EventType {
  const lowerSummary = summary.toLowerCase();
  if (lowerSummary.includes('cours')) return 'cours';
  if (lowerSummary.includes('exam') || lowerSummary.includes('examen')) return 'exam';
  if (lowerSummary.includes('soutenance')) return 'soutenance';
  if (lowerSummary.includes('rattrapage')) return 'rattrapage';
  if (lowerSummary.includes('tme')) return 'tme';
  if (lowerSummary.includes('td')) return 'td';
  return 'other';
}

interface CatalogCourseEntry {
  totalEvents: number;
  types: Record<EventType, number>;
  matchedBy: Record<string, number>;
  samples: string[];
}

interface CatalogSourceResult {
  success: boolean;
  error?: string;
  minEvents: number;
  hardcodedCourses: string[];
  discoveredCourses: string[];
  courses: Record<string, CatalogCourseEntry>;
  unknownSamples: string[];
}

function buildCatalogForEvents(events: CalendarEvent[]): { courses: Record<string, CatalogCourseEntry>; unknownSamples: string[] } {
  const courses: Record<string, CatalogCourseEntry> = {};
  const unknownSamples: string[] = [];

  for (const event of events) {
    const summary = event.summary || '';
    const type = detectType(summary);
    const extracted = extractCourseFromSummaryDetailed(summary);

    if (!extracted.course) {
      if (unknownSamples.length < 30) {
        unknownSamples.push(summary);
      }
      continue;
    }

    if (!courses[extracted.course]) {
      courses[extracted.course] = {
        totalEvents: 0,
        types: { cours: 0, td: 0, tme: 0, exam: 0, soutenance: 0, rattrapage: 0, other: 0 },
        matchedBy: {},
        samples: []
      };
    }

    const entry = courses[extracted.course];
    entry.totalEvents++;
    entry.types[type] = (entry.types[type] || 0) + 1;
    if (extracted.matchedBy) {
      entry.matchedBy[extracted.matchedBy] = (entry.matchedBy[extracted.matchedBy] || 0) + 1;
    }

    if (entry.samples.length < 10 && !entry.samples.includes(summary)) {
      entry.samples.push(summary);
    }
  }

  return { courses, unknownSamples };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sources = searchParams.get('sources')?.split(',').filter(Boolean) || ['DAC'];
    const minEvents = Math.max(1, parseInt(searchParams.get('minEvents') || '3', 10) || 3);

    const validSources = sources.filter(source => Object.keys(SORBONNE_CALENDARS).includes(source));

    if (validSources.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No valid sources specified',
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    const cachedResults: Record<string, CatalogSourceResult> = {};
    const sourcesToFetch: string[] = [];

    if (supabase) {
      for (const source of validSources) {
        try {
          const cacheKey = `course-catalog-${source}`;
          const { data: cachedData, error } = await supabase
            .from('analyze_events_cache')
            .select('*')
            .eq('id', cacheKey)
            .single();

          if (!error && cachedData && isCacheValid(cachedData)) {
            const cachedResult = cachedData.data as CatalogSourceResult;
            if (cachedResult.minEvents === minEvents) {
              cachedResults[source] = cachedResult;
            } else {
              sourcesToFetch.push(source);
            }
          } else {
            sourcesToFetch.push(source);
          }
        } catch {
          sourcesToFetch.push(source);
        }
      }
    } else {
      sourcesToFetch.push(...validSources);
    }

    const fetchedResults: Record<string, CatalogSourceResult> = {};

    if (sourcesToFetch.length > 0) {
      const fetchPromise = caldavClient.fetchAllCalendars(sourcesToFetch);
      const overallTimeout = process.env.NODE_ENV === 'production' ? 50000 : 35000;
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Overall fetch timeout')), overallTimeout));

      const fetchResults = await Promise.race([fetchPromise, timeoutPromise]) as Record<string, CalendarFetchResult>;

      for (const source of sourcesToFetch) {
        const hardcodedCourses = SORBONNE_CALENDARS[source]?.courses || [];

        const result = fetchResults[source];
        if (!result || !result.success) {
          fetchedResults[source] = {
            success: false,
            error: result?.error || 'Unknown error',
            minEvents,
            hardcodedCourses,
            discoveredCourses: [],
            courses: {},
            unknownSamples: []
          };
          continue;
        }

        const catalog = buildCatalogForEvents(result.events);
        const discoveredCourses = Object.keys(catalog.courses)
          .filter(course => catalog.courses[course].totalEvents >= minEvents)
          .sort((a, b) => catalog.courses[b].totalEvents - catalog.courses[a].totalEvents)
          .map(course => course);

        const sourceResult: CatalogSourceResult = {
          success: true,
          minEvents,
          hardcodedCourses,
          discoveredCourses,
          courses: catalog.courses,
          unknownSamples: catalog.unknownSamples
        };

        fetchedResults[source] = sourceResult;

        if (supabase) {
          try {
            const cacheKey = `course-catalog-${source}`;
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + CACHE_TTL_HOURS);

            await supabase
              .from('analyze_events_cache')
              .upsert({
                id: cacheKey,
                sources: [source],
                data: sourceResult,
                expires_at: expiresAt.toISOString()
              });
          } catch {
            // Ignore caching failures
          }
        }
      }
    }

    const combined = { ...cachedResults, ...fetchedResults };

    return NextResponse.json({
      success: Object.values(combined).some(r => r.success),
      data: {
        sources: combined
      },
      cached: Object.keys(cachedResults).length > 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
