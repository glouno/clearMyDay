import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const BOT_REGEX = /(googlebot|bingbot|lighthouse|pagespeed|chrome-lighthouse|headless|ahrefsbot|semrush|uptimerobot|vercel-screenshot|slackbot|facebookexternalhit|twitterbot|whatsapp|telegram)/i;

export function middleware(request: NextRequest) {
  const ua = request.headers.get('user-agent') || '';
  const country = request.headers.get('x-vercel-ip-country') || '??';
  const city = request.headers.get('x-vercel-ip-city') || '';
  const cache = request.headers.get('x-vercel-cache') || 'unknown';
  const isBot = BOT_REGEX.test(ua);
  
  // Log to Vercel function logs (1h retention on free tier)
  console.log(JSON.stringify({
    path: request.nextUrl.pathname,
    country,
    city,
    cache,
    isBot: isBot ? 'BOT' : 'HUMAN',
    ua: ua.substring(0, 100) // First 100 chars to avoid log spam
  }));
  
  return NextResponse.next();
}

export const config = {
  // Only monitor homepage and API routes
  matcher: ['/', '/api/:path*'],
};
