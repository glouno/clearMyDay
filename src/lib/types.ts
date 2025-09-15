// Core types for the ClearMyDay application

export interface CalendarEvent {
  uid: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  categories?: string[];
  rrule?: string;
  recurrenceId?: Date;
}

export interface FilterConfig {
  masters: ('DAC' | 'IMA' | 'ANDROIDE')[];
  courses: string[];
  groups: {
    td?: string;    // e.g., "TD2", "Group 5" (legacy global)
    tme?: string;   // e.g., "TME B" (legacy global)
  };
  courseGroups?: {
    [courseId: string]: string; // Single group number per course (e.g., "2" for both TD2 and TME2)
  };
  dateRange: {
    start: Date;
    end: Date;
  };
  customRules?: {
    include?: string[];
    exclude?: string[];
    regex?: boolean;
  };
}

export interface SorborneCalendarSource {
  id: 'DAC' | 'IMA' | 'ANDROIDE';
  name: string;
  url: string;
  courses: string[];
  defaultGroups: {
    td?: string;
    tme?: string;
  };
}

export interface CalendarSource {
  name: string;
  url: string;
  auth: {
    username: string;
    password: string;
  };
}

export interface PersonalCalendarConfig {
  id: string;
  name: string;
  token: string;
  filter: FilterConfig;
  createdAt: Date;
  lastUpdated: Date;
}

export interface CalendarFetchResult {
  success: boolean;
  events: CalendarEvent[];
  error?: string;
  lastModified?: Date;
  etag?: string;
}

export interface GroupDetectionResult {
  td: string[];
  tme: string[];
  other: string[];
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    database?: 'up' | 'down';
    caldav: {
      DAC: 'up' | 'down';
      IMA: 'up' | 'down';
      ANDROIDE: 'up' | 'down';
    };
  };
  uptime: number;
  version: string;
}
