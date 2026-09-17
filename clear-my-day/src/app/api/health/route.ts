// Health check endpoint for monitoring system status

import { NextResponse } from 'next/server';

const startTime = Date.now();

export async function GET() {
  // Keep the public liveness probe cheap. Probing every upstream calendar here
  // made each monitor request fan out into many slow CalDAV downloads.
  return NextResponse.json({
    status: 'healthy',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    version: '1.0.0'
  }, {
    headers: { 'Cache-Control': 'no-store' }
  });
}
