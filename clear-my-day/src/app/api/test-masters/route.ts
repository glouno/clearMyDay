// API endpoint to test all CalDAV masters and discover which ones are accessible

import { NextRequest, NextResponse } from 'next/server';
import { ALL_SORBONNE_MASTERS, testCalDAVEndpoint } from '@/lib/sorbonne-masters';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const testAll = searchParams.get('all') === 'true';
    const masterIds = searchParams.get('masters')?.split(',') || Object.keys(ALL_SORBONNE_MASTERS);

    const results: { [masterId: string]: { accessible: boolean; error?: string; name: string; url: string } } = {};

    // Test each master endpoint
    for (const masterId of masterIds) {
      const master = ALL_SORBONNE_MASTERS[masterId];
      if (!master) {
        results[masterId] = {
          accessible: false,
          error: 'Master not found',
          name: 'Unknown',
          url: 'Unknown'
        };
        continue;
      }

      console.log(`Testing ${masterId}: ${master.url}`);
      
      try {
        const isAccessible = await testCalDAVEndpoint(master);
        results[masterId] = {
          accessible: isAccessible,
          name: master.name,
          url: master.url
        };
      } catch (error) {
        results[masterId] = {
          accessible: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          name: master.name,
          url: master.url
        };
      }
    }

    // Summary statistics
    const totalTested = Object.keys(results).length;
    const accessible = Object.values(results).filter(r => r.accessible).length;
    const inaccessible = totalTested - accessible;

    return NextResponse.json({
      success: true,
      summary: {
        totalTested,
        accessible,
        inaccessible,
        accessibilityRate: `${Math.round((accessible / totalTested) * 100)}%`
      },
      results,
      accessibleMasters: Object.entries(results)
        .filter(([_, result]) => result.accessible)
        .map(([id, result]) => ({ id, name: result.name, url: result.url })),
      inaccessibleMasters: Object.entries(results)
        .filter(([_, result]) => !result.accessible)
        .map(([id, result]) => ({ id, name: result.name, url: result.url, error: result.error }))
    });

  } catch (error) {
    console.error('Error testing masters:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to test masters' },
      { status: 500 }
    );
  }
}

// Usage examples:
// GET /api/test-masters - Test all masters
// GET /api/test-masters?masters=DAC,IMA,AI2D - Test specific masters
// GET /api/test-masters?all=true - Force test all (same as default)
