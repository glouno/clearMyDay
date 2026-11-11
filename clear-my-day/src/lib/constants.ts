// Configuration constants for the ClearMyDay application

import { SorborneCalendarSource } from './types';
import { CONFIRMED_MASTERS, ALL_SORBONNE_MASTERS } from './sorbonne-masters';

// Sorbonne University Calendar Sources
// Use CONFIRMED_MASTERS for production, ALL_SORBONNE_MASTERS for testing
export const SORBONNE_CALENDARS: Record<string, SorborneCalendarSource> = 
  process.env.NODE_ENV === 'production' ? CONFIRMED_MASTERS : ALL_SORBONNE_MASTERS;

// Authentication credentials for Sorbonne calendars
export const SORBONNE_AUTH = {
  username: 'student.master',
  password: 'guest'
};

// Application configuration
export const APP_CONFIG = {
  // Default date range for calendar events (days)
  DEFAULT_DATE_RANGE_PAST: 30,     // Days in the past to include
  DEFAULT_DATE_RANGE_FUTURE: 365,  // Days in the future to include
  CALENDAR_CACHE_TTL: 3600000,     // 1 hour in milliseconds
  CACHE_TIMEOUT: 3600000,          // 1 hour in milliseconds
  RATE_LIMIT_REQUESTS_PER_MINUTE: 60,
  RATE_LIMIT_REQUESTS_PER_TOKEN: 10,
  MAX_RESPONSE_TIME_MS: 5000,
  MAX_RETRIES: process.env.NODE_ENV === 'production' ? 2 : 2,  // Allow retries for unreliable Sorbonne servers
  TIMEOUT: process.env.NODE_ENV === 'production' ? 20000 : 15000,   // 20s for production, 15s for dev (Sorbonne servers are slow)
  MIN_CACHE_SIZE: 100,             // Minimum events to cache
  MAX_CACHE_SIZE: 10000,           // Maximum events to cache
  DEFAULT_TIMEZONE: 'Europe/Paris',
  TIMEZONE: 'Europe/Paris',
  ICS_VERSION: '2.0',
  CALENDAR_PRODUCT_ID: '-//ClearMyDay//ClearMyDay Calendar Filter//EN',
  REFRESH_INTERVAL_MINUTES: 15,
  TOKEN_LENGTH: 32,
  TOKEN_EXPIRY_DAYS: 365
};

// Group detection patterns
export const GROUP_PATTERNS = {
  TD: [
    /TD\s*(\d+)/i,           // TD1, TD 2, etc.
    /Groupe\s*(\d+)/i,       // Groupe 1, Groupe 2, etc.
    /Group\s*(\d+)/i,        // Group 1, Group 2, etc.
    /G(\d+)/i                // G1, G2, etc.
  ],
  TME: [
    /TME\s*([A-Z])(?:\s|$)/i,        // TME A, TME B, etc. - Fixed with word boundary
    /TP\s*([A-Z])(?:\s|$)/i,         // TP A, TP B, etc. - Fixed with word boundary
    /Groupe\s*([A-Z])(?:\s|$)/i      // Groupe A, Groupe B, etc. - Fixed with word boundary
  ]
};

// Course code patterns for filtering
export const COURSE_PATTERNS = {
  // DAC courses
  DALAS: /DALAS/i,
  LRC: /LRC/i,
  MLBDA: /MLBDA/i,
  MAPSI: /MAPSI/i,
  MOGPL: /MOGPL/i,
  
  // IMA courses
  BIMA: /BIMA/i,
  
  // ANDROIDE courses
  IREC: /IREC/i,
  
  // Add more courses as needed - this should be dynamic based on masters
};

// HTTP headers for calendar requests
export const HTTP_HEADERS = {
  USER_AGENT: 'ClearMyDay/1.0 (Sorbonne Calendar Filter)',
  ACCEPT: 'text/calendar, application/calendar+xml, text/plain',
  CACHE_CONTROL: 'no-cache'
};

export const CALENDAR_HEADERS = {
  'User-Agent': HTTP_HEADERS.USER_AGENT,
  'Accept': HTTP_HEADERS.ACCEPT,
  'Cache-Control': HTTP_HEADERS.CACHE_CONTROL
};

// Error messages
export const ERROR_MESSAGES = {
  CALENDAR_FETCH_FAILED: 'Failed to fetch calendar data from upstream source',
  INVALID_TOKEN: 'Invalid or expired calendar token',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded. Please try again later',
  INVALID_FILTER_CONFIG: 'Invalid filter configuration provided',
  CALENDAR_PARSE_ERROR: 'Failed to parse calendar data',
  UPSTREAM_UNAVAILABLE: 'Upstream calendar service is currently unavailable'
};

// Success metrics thresholds
export const SUCCESS_METRICS = {
  MIN_EVENT_REDUCTION_PERCENT: 80,
  MAX_SETUP_TIME_SECONDS: 180,
  MIN_UPTIME_PERCENT: 99.9,
  MAX_RESPONSE_TIME_MS: 500
};
