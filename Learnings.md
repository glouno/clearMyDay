# Sorbonne Calendar Filtering Tool - Complete Project Learnings

## Project Overview

### Objective
Create a web application that allows Sorbonne University students to generate personalized calendar subscriptions by filtering the official university calendar based on their selected master programs, courses, and group numbers. The tool eliminates irrelevant events and provides clean, focused calendar feeds that students can subscribe to in their preferred calendar applications.

### Core Problem Statement
Sorbonne University provides comprehensive calendar feeds via CalDAV that contain ALL events for ALL students across multiple master programs (DAC, IMA, ANDROIDE). Students need to manually filter through hundreds of irrelevant events to find their specific courses and group sessions (TD/TME). This tool automates that filtering process.

## Technical Architecture

### Technology Stack
- **Frontend**: Next.js 14+ with React, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes
- **Calendar Protocol**: CalDAV for fetching, ICS for serving
- **Storage**: In-memory for development (needs persistent storage for production)
- **Authentication**: Token-based calendar subscriptions (no user accounts)

### Key Components

#### 1. CalDAV Client (`/lib/caldav-client.ts`)
- Fetches calendar data from Sorbonne's CalDAV servers
- Handles authentication with hardcoded credentials
- Implements caching and retry logic
- Parses ICS format into JavaScript objects

**Critical Implementation Details:**
```typescript
// Sorbonne CalDAV endpoints
const SORBONNE_CALENDARS = {
  DAC: {
    url: 'https://caldav.sorbonne-universite.fr/caldav.php/...',
    courses: ['MLBDA', 'AAGB', 'BIMA', 'CODEL', 'IMA', 'MAPSI', 'MOBJ', 'MOGPL', 'NOYAU', 'PNLA', 'RES', 'RLADL', 'SAR', 'SFPN']
  },
  // ... other masters
};
```

#### 2. Calendar Parser (`/lib/calendar-parser.ts`)
**Most Critical Component** - Contains the core filtering logic.

**Event Summary Format Analysis:**
Sorbonne events follow specific naming patterns:
- **Cours**: `MU4IN801-MLBDA-Cours` (no group number)
- **TD Sessions**: `MU4IN801-MLBDA-TD2-Groupe_2` or `UM4IN801-MLBDA-TD2`
- **TME Sessions**: `MU4IN801-MLBDA-TME2-Groupe_2` or `UM4IN801-MLBDA-TME2`
- **Exams**: `MU4IN801-MLBDA-Examen` (no group number)
- **Other**: `MU4IN801-MLBDA-ER1`, `MU4IN801-MLBDA-Consultation de copies`

**Critical Regex Patterns for Group Detection:**
```typescript
const tdPatterns = [
  /4I\d+-TD(\d+)-/i,           // MU4IN801-MLBDA-TD2-
  /4I\d+\s*-\s*TD(\d+)\s+/i,   // MU4IN801-MLBDA-TD2 
  /MU4IN\d+-\w+-TD(\d+)/i,     // MU4IN801-MLBDA-TD2
  /-TD(\d+)-/i,                // Generic -TD2-
  /\bTD(\d+)\b/i               // Word boundary TD2
];

const tmePatterns = [
  /4I\d+-TME(\d+)-/i,          // Similar patterns for TME
  /4I\d+\s*-\s*TME(\d+)\s+/i,
  /MU4IN\d+-\w+-TME(\d+)/i,
  /-TME(\d+)-?/i,
  /\bTME(\d+)\b/i
];
```

**Filtering Logic Evolution:**
1. **Initial Approach (WRONG)**: Negative filtering - exclude events that don't match
2. **Final Approach (CORRECT)**: Positive filtering - include all general events + matching group events

```typescript
// CORRECT: Positive filtering approach
matchesCourseGroup(event: CalendarEvent, courseId: string, groupNumber: string): boolean {
  const summary = event.summary;
  
  // Always include non-group-specific events for this course
  if (this.isGeneralCourseEvent(summary, courseId)) {
    return true;
  }
  
  // Include TD/TME events that match the selected group
  if (this.hasGroupNumber(summary, groupNumber)) {
    return true;
  }
  
  return false;
}
```

#### 3. Filter Configuration (`/lib/types.ts`)
**Key Type Definitions:**
```typescript
interface FilterConfig {
  masters: ('DAC' | 'IMA' | 'ANDROIDE')[];
  courses: string[];
  groups: { td?: string; tme?: string; };        // Legacy - kept for compatibility
  courseGroups?: { [courseId: string]: string }; // NEW: Single group per course
  dateRange: { start: Date; end: Date; };
}
```

**Critical Design Decision:** Changed from separate TD/TME group selections to single group number per course. When group "2" is selected for MLBDA, it includes both TD2 and TME2 sessions.

#### 4. API Endpoints

**`/api/fetch-calendar`** - Fetches and combines calendar data
**`/api/analyze-events`** - Analyzes event patterns (debugging tool)
**`/api/generate-calendar`** - Creates filtered calendar configuration
**`/api/calendar/[token]`** - Serves ICS feed for subscription

### UI Components

#### SimplifiedCalendarSelector (Final Working Version)
- Single group selection per course (not separate TD/TME)
- Auto-detects available groups from real calendar data
- Shows clear preview of what will be included

#### FilteredEventsPreview
- Shows deduplicated list of events that will be included
- Categorizes by type (Cours, TD, TME, Exam, Other)
- Critical for user confidence and debugging

## Major Technical Challenges & Solutions

### 1. Group Filtering Logic
**Problem**: Initial implementation used negative filtering which caused conflicts when both TD and TME groups were selected.

**Solution**: Switched to positive filtering:
- Include ALL general events (cours, exams, consultations)
- Include ONLY TD/TME events that match the selected group number
- Exclude TD/TME events from other groups

### 2. Event Summary Parsing
**Problem**: Sorbonne uses inconsistent naming patterns across different courses and time periods.

**Solution**: Multiple regex patterns with fallbacks, extensive pattern testing with real data.

### 3. Calendar Subscription URLs
**Problem**: Need to provide persistent calendar feeds without user accounts.

**Solution**: Token-based system where each filter configuration gets a unique token and subscription URL.

### 4. UI State Management
**Problem**: Complex state synchronization between master selection, course selection, and group detection.

**Solution**: Simplified to single group selection per course, auto-detection of available groups.

## Data Flow

1. **User Selection**: Master → Courses → Groups
2. **Group Detection**: Fetch real calendar data, parse event summaries, extract available groups
3. **Filter Preview**: Show user exactly what events will be included
4. **Calendar Generation**: Create token, store filter config, generate subscription URL
5. **ICS Serving**: Token-based endpoint serves filtered ICS feed

## Critical Implementation Insights

### CalDAV Authentication
```typescript
// Hardcoded for prototype - needs secure credential management
const auth = Buffer.from(`${username}:${password}`).toString('base64');
headers: { 'Authorization': `Basic ${auth}` }
```

### Event Deduplication
Events can appear multiple times in calendar feeds. Always deduplicate by summary + start time.

### Date Handling
Sorbonne events use various date formats. Robust parsing required:
```typescript
const startDate = event.dtstart?.toJSDate() || new Date(event.start);
```

### Rate Limiting
Implement rate limiting on API endpoints to prevent abuse:
```typescript
const rateLimiter = new Map();
// Check requests per IP per time window
```

## Testing Strategy

### Manual Testing Commands
```bash
# Test calendar fetching
curl "http://localhost:3002/api/fetch-calendar?sources=DAC"

# Test event analysis
curl "http://localhost:3002/api/analyze-events?sources=DAC"

# Test filtered calendar generation
curl -X POST "http://localhost:3002/api/generate-calendar" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","filter":{...}}'
```

### Key Test Cases
1. Group filtering accuracy (include correct TD/TME, exclude others)
2. General event inclusion (cours, exams always included)
3. Date range filtering
4. Multiple course selection
5. Edge cases (courses with no groups, malformed event names)

## Production Considerations

### Security
- Replace hardcoded CalDAV credentials with secure storage
- Implement proper rate limiting
- Add input validation and sanitization
- Consider CORS policies

### Scalability
- Replace in-memory storage with persistent database
- Add caching layers for CalDAV responses
- Implement background jobs for calendar updates
- Add monitoring and logging

### User Experience
- Add loading states and error handling
- Implement calendar subscription validation
- Add user feedback mechanisms
- Consider mobile responsiveness

## Common Pitfalls & Debugging

### Event Not Appearing in Filtered Calendar
1. Check event summary format matches regex patterns
2. Verify course ID extraction is working
3. Confirm group number detection
4. Test with `/api/analyze-events` endpoint

### Calendar Subscription Not Working
1. Verify ICS format validity
2. Check token storage and retrieval
3. Test subscription URL accessibility
4. Validate calendar app compatibility

### Performance Issues
1. CalDAV responses can be large - implement caching
2. Event parsing is CPU-intensive - consider background processing
3. Multiple concurrent requests can overwhelm CalDAV server

## Future Enhancements

### High Priority
- Persistent storage for production deployment
- Secure credential management
- Comprehensive error handling and user feedback

### Medium Priority
- Multiple group selection per course
- Custom date range selection
- Calendar sharing and collaboration features
- Mobile app or PWA version

### Low Priority
- Integration with other university calendar systems
- Advanced filtering (by professor, room, etc.)
- Calendar analytics and insights

## File Structure Reference

```
src/
├── app/
│   ├── api/
│   │   ├── analyze-events/route.ts     # Event pattern analysis
│   │   ├── calendar/[token]/route.ts   # ICS feed serving
│   │   ├── fetch-calendar/route.ts     # CalDAV data fetching
│   │   ├── generate-calendar/route.ts  # Filter config creation
│   │   └── health/route.ts            # Health check
│   └── page.tsx                       # Main UI page
├── lib/
│   ├── calendar-parser.ts             # Core filtering logic
│   ├── calendar-storage.ts            # In-memory storage
│   ├── caldav-client.ts              # CalDAV client
│   ├── constants.ts                  # Configuration
│   ├── ics-generator.ts              # ICS generation utilities
│   └── types.ts                      # TypeScript definitions
└── components/
    ├── SimplifiedCalendarSelector.tsx # Main UI component
    └── FilteredEventsPreview.tsx     # Event preview component
```

## Key Takeaways for Future Development

1. **Start with real data analysis** - Understanding actual event formats is crucial
2. **Positive filtering is more reliable** than negative filtering for complex rules
3. **User preview is essential** - Users need to see what they're getting
4. **Simple UI wins** - Single group selection is clearer than separate TD/TME dropdowns
5. **Token-based subscriptions** work well for calendar feeds without user accounts
6. **Extensive regex testing** is required for parsing university calendar formats
7. **Caching is critical** for CalDAV performance
8. **Error handling and debugging tools** are essential for complex filtering logic

This document contains everything needed to rebuild or extend this project effectively.
