// Health check endpoint for monitoring system status

import { NextResponse } from 'next/server';
import { caldavClient } from '@/lib/caldav-client';
import { HealthCheckResponse } from '@/lib/types';

const startTime = Date.now();

export async function GET() {
  try {
    // Check CalDAV sources
    const caldavHealth = await caldavClient.healthCheck();
    
    // Determine overall status
    const allServicesUp = Object.values(caldavHealth).every(status => status === 'up');
    const someServicesUp = Object.values(caldavHealth).some(status => status === 'up');
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (allServicesUp) {
      overallStatus = 'healthy';
    } else if (someServicesUp) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'unhealthy';
    }

    const response: HealthCheckResponse = {
      status: overallStatus,
      services: {
        caldav: caldavHealth as { DAC: 'up' | 'down'; IMA: 'up' | 'down'; ANDROIDE: 'up' | 'down' }
      },
      uptime: Math.floor((Date.now() - startTime) / 1000),
      version: '1.0.0'
    };

    const httpStatus = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;

    return NextResponse.json(response, { status: httpStatus });

  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json({
      status: 'unhealthy',
      services: {
        caldav: {
          DAC: 'down',
          IMA: 'down',
          ANDROIDE: 'down'
        }
      },
      uptime: Math.floor((Date.now() - startTime) / 1000),
      version: '1.0.0',
      error: error instanceof Error ? error.message : 'Unknown error'
    } as HealthCheckResponse, { status: 503 });
  }
}
