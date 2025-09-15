// Shared storage for calendar configurations
// In production, this should be replaced with Redis or a database

export interface CalendarConfig {
  name: string;
  filter: {
    masters: ('DAC' | 'IMA' | 'ANDROIDE')[];
    courses: string[];
    courseGroups?: { [courseId: string]: string }; // Single group number per course
    groups?: { td?: string; tme?: string }; // Legacy support
    dateRange: {
      start: string;
      end: string;
    };
  };
  createdAt: Date;
}

// Global storage that persists across module reloads in development
declare global {
  var __calendarConfigs: Map<string, CalendarConfig> | undefined;
}

// In-memory storage for calendar configurations
// In production, replace with persistent storage
export const calendarConfigs = globalThis.__calendarConfigs ?? new Map<string, CalendarConfig>();

if (process.env.NODE_ENV === 'development') {
  globalThis.__calendarConfigs = calendarConfigs;
}
