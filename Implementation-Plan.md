# ClearMyDay Implementation Plan
## Personalized University Calendar Filter - Sorbonne Prototype

---

## Overview

This document outlines the step-by-step implementation plan for building a personalized calendar filtering tool, starting with a Sorbonne-specific prototype. Each phase includes detailed tasks, evaluation criteria, and quality assurance steps to ensure robust, production-ready code.

---

## Phase 1: Foundation & Setup (Day 1)

### Step 1.1: Project Initialization
**Objective**: Set up a modern Next.js project with TypeScript and essential dependencies.

**Tasks**:
```bash
npx create-next-app@latest clear-my-day --typescript --tailwind --eslint --app
cd clear-my-day
npm install ical node-ical react-big-calendar moment date-fns
npm install -D @types/node-ical
```

**Quality Checks**:
- [ ] TypeScript compilation passes without errors
- [ ] ESLint runs without warnings
- [ ] Tailwind CSS classes render correctly
- [ ] Development server starts successfully (`npm run dev`)
- [ ] All dependencies install without conflicts

**Evaluation Criteria**:
- Build time < 30 seconds
- No security vulnerabilities in dependencies (`npm audit`)
- Hot reload works properly

---

### Step 1.2: Project Structure Setup
**Objective**: Establish a clean, scalable folder structure.

**Directory Structure**:
```
clear-my-day/
├── app/
│   ├── page.tsx                 # Main calendar selection UI
│   ├── preview/page.tsx         # Calendar preview page
│   ├── api/
│   │   ├── calendar/[token]/route.ts    # ICS feed generator
│   │   ├── fetch-calendar/route.ts      # CalDAV fetcher
│   │   └── health/route.ts              # Health check endpoint
│   └── globals.css
├── lib/
│   ├── calendar-parser.ts       # Event filtering logic
│   ├── ics-generator.ts         # Personal feed creation
│   ├── caldav-client.ts         # CalDAV connection utilities
│   ├── types.ts                 # TypeScript interfaces
│   └── constants.ts             # Configuration constants
├── components/
│   ├── CalendarSelector.tsx     # Master/course selection UI
│   ├── CalendarPreview.tsx      # Event preview component
│   └── FilterControls.tsx       # Group/course filtering
└── tests/
    ├── unit/
    └── integration/
```

**Quality Checks**:
- [ ] All TypeScript files have proper type definitions
- [ ] Import paths are consistent and relative
- [ ] Each file has a single responsibility
- [ ] Barrel exports are used where appropriate

---

## Phase 2: Core Backend Logic (Day 1-2)

### Step 2.1: CalDAV Client Implementation
**Objective**: Create a robust client to fetch calendar data from Sorbonne endpoints.

**File**: `lib/caldav-client.ts`

**Requirements**:
- Support for basic auth (`student.master:guest`)
- Error handling for network failures
- Timeout configuration (30s max)
- Retry logic with exponential backoff
- Response validation

**Sorbonne Endpoints**:
```typescript
const SORBONNE_CALENDARS = {
  DAC: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/DAC/M1_DAC',
  IMA: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/IMA/M1_IMA',
  ANDROIDE: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/ANDROIDE/M1_ANDROIDE'
};
```

**Quality Checks**:
- [ ] Handles HTTP errors gracefully (401, 404, 500, timeout)
- [ ] Validates ICS format before parsing
- [ ] Logs meaningful error messages
- [ ] Returns consistent error types
- [ ] Memory usage stays under 50MB for large calendars

**Testing**:
```bash
# Test with actual Sorbonne endpoints
curl -u "student.master:guest" "https://cal.ufr-info-p6.jussieu.fr/caldav.php/DAC/M1_DAC"
```

**Evaluation Criteria**:
- Successfully fetches all 3 Sorbonne calendars
- Response time < 5 seconds per calendar
- Handles malformed ICS data without crashing
- Proper TypeScript types for all return values

---

### Step 2.2: Calendar Parser & Filter Engine
**Objective**: Parse ICS data and implement intelligent filtering logic.

**File**: `lib/calendar-parser.ts`

**Core Features**:
- Parse ICS events using `node-ical`
- Extract course codes, group numbers, professor names
- Filter by specific courses (DALAS, LRC, MLBDA, MAPSI, MOGPL)
- Group detection (TD2, TME B, Group 5, etc.)
- Date range filtering (configurable window)

**Filter Logic**:
```typescript
interface FilterConfig {
  masters: ('DAC' | 'IMA' | 'ANDROIDE')[];
  courses: string[];
  groups: {
    td?: string;    // e.g., "TD2", "Group 5"
    tme?: string;   // e.g., "TME B"
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
```

**Quality Checks**:
- [ ] Correctly parses recurring events
- [ ] Handles timezone conversions (Europe/Paris)
- [ ] Group detection works for various naming patterns
- [ ] Performance: processes 1000+ events in < 1 second
- [ ] Memory efficient (streaming where possible)

**Testing Strategy**:
```typescript
// Unit tests for filter logic
describe('Calendar Parser', () => {
  test('filters DALAS group 5 events correctly');
  test('excludes events from unwanted groups');
  test('handles malformed event data gracefully');
  test('respects date range boundaries');
});
```

**Evaluation Criteria**:
- 95%+ accuracy in group detection
- Zero false positives for excluded courses
- Handles edge cases (missing fields, special characters)
- Comprehensive test coverage (>80%)

---

### Step 2.3: ICS Feed Generator
**Objective**: Generate clean, standards-compliant ICS feeds for filtered events.

**File**: `lib/ics-generator.ts`

**Features**:
- RFC 5545 compliant ICS format
- Custom calendar properties (name, description, timezone)
- Unique event UIDs to prevent duplicates
- Proper VTIMEZONE definitions
- Refresh hints for calendar clients

**Quality Checks**:
- [ ] Generated ICS validates against RFC 5545
- [ ] Works with major calendar clients (Apple, Google, Outlook)
- [ ] Proper escaping of special characters
- [ ] Consistent event UIDs across regenerations
- [ ] Includes all required ICS properties

**Validation Tools**:
```bash
# Validate generated ICS files
icalendar-validator output.ics
```

**Evaluation Criteria**:
- ICS files import successfully in 3+ calendar applications
- No parsing errors or warnings
- Events display correctly with proper times/dates
- Calendar name and metadata appear correctly

---

## Phase 3: Frontend Development (Day 2)

### Step 3.1: Calendar Selection UI
**Objective**: Create an intuitive interface for selecting masters, courses, and groups.

**File**: `components/CalendarSelector.tsx`

**UI Requirements**:
- Master selection (DAC, IMA, ANDROIDE) with checkboxes
- Dynamic course list based on selected masters
- Group selection with auto-detection from calendar data
- Real-time preview of selection impact
- Clear visual feedback for selections

**Specific Sorbonne Configuration**:
```typescript
const SORBONNE_CONFIG = {
  DAC: {
    courses: ['DALAS', 'LRC', 'MLBDA'],
    defaultGroups: { td: '5', tme: 'B' }
  },
  IMA: {
    courses: ['MAPSI'],
    defaultGroups: { td: '5' }
  },
  ANDROIDE: {
    courses: ['MOGPL'],
    defaultGroups: {}
  }
};
```

**Quality Checks**:
- [ ] Responsive design (mobile-first)
- [ ] Accessible (ARIA labels, keyboard navigation)
- [ ] Form validation with clear error messages
- [ ] Loading states during calendar fetching
- [ ] Persists selections in URL/localStorage

**Evaluation Criteria**:
- Setup time < 3 minutes (per PRD success metric)
- Works on mobile devices (iOS Safari, Chrome)
- No layout shifts during loading
- Intuitive UX (user testing with 3+ people)

---

### Step 3.2: Calendar Preview Component
**Objective**: Show filtered events in a visual calendar before generating subscription.

**File**: `components/CalendarPreview.tsx`

**Features**:
- React Big Calendar integration
- Week/month view toggle
- Event details on hover/click
- Color coding by course/master
- Loading states and error handling

**Quality Checks**:
- [ ] Renders 100+ events without performance issues
- [ ] Proper timezone handling
- [ ] Events display correct times and titles
- [ ] Responsive calendar layout
- [ ] Smooth interactions (no lag)

**Performance Targets**:
- Initial render < 500ms
- Smooth scrolling and navigation
- Memory usage < 100MB with large datasets

---

## Phase 4: API Development (Day 2-3)

### Step 4.1: Calendar Fetch API
**Objective**: Secure endpoint to fetch and cache upstream calendar data.

**File**: `app/api/fetch-calendar/route.ts`

**Features**:
- Rate limiting (max 10 requests/minute per IP)
- Caching with appropriate TTL (15 minutes)
- Error handling and logging
- CORS configuration
- Request validation

**Quality Checks**:
- [ ] Handles concurrent requests efficiently
- [ ] Proper HTTP status codes
- [ ] Security headers included
- [ ] Request/response logging
- [ ] Graceful degradation on upstream failures

---

### Step 4.2: Personal ICS Feed API
**Objective**: Generate tokenized, personalized ICS feeds.

**File**: `app/api/calendar/[token]/route.ts`

**Features**:
- Token-based access (UUID v4)
- Dynamic ICS generation
- Proper HTTP headers for calendar clients
- ETag support for caching
- Usage analytics (optional)

**Security Considerations**:
- No sensitive data in URLs
- Token rotation capability
- Rate limiting per token
- Request logging for debugging

**Quality Checks**:
- [ ] Response time < 500ms (per PRD metric)
- [ ] Proper Content-Type headers
- [ ] Works with curl/wget
- [ ] Handles malformed tokens gracefully
- [ ] Scales to 100+ concurrent requests

---

## Phase 5: Testing & Quality Assurance (Day 3)

### Step 5.1: Automated Testing
**Test Categories**:

**Unit Tests** (`tests/unit/`):
- Calendar parsing logic
- Filter functions
- ICS generation
- Utility functions

**Integration Tests** (`tests/integration/`):
- API endpoint responses
- End-to-end calendar flow
- External CalDAV connectivity
- Calendar client compatibility

**Testing Commands**:
```bash
npm run test              # Unit tests
npm run test:integration  # Integration tests
npm run test:e2e         # End-to-end tests
npm run test:coverage    # Coverage report
```

**Quality Gates**:
- [ ] >80% code coverage
- [ ] All tests pass in CI/CD
- [ ] No memory leaks in long-running tests
- [ ] Performance benchmarks met

---

### Step 5.2: Manual Testing Checklist

**Functional Testing**:
- [ ] Can select DAC + DALAS group 5
- [ ] Can select IMA + MAPSI group 5  
- [ ] Can select ANDROIDE + MOGPL
- [ ] Can combine multiple masters
- [ ] Generated ICS imports correctly in Apple Calendar
- [ ] Generated ICS imports correctly in Google Calendar
- [ ] Generated ICS imports correctly in Outlook
- [ ] Calendar updates when upstream changes
- [ ] Handles network failures gracefully

**Performance Testing**:
- [ ] Page loads in <3 seconds on 3G
- [ ] Calendar preview renders in <500ms
- [ ] ICS generation completes in <500ms
- [ ] Memory usage stays under 200MB
- [ ] No memory leaks after extended use

**Security Testing**:
- [ ] No credentials exposed in client-side code
- [ ] Rate limiting works correctly
- [ ] Invalid tokens return 404
- [ ] No XSS vulnerabilities
- [ ] HTTPS enforced in production

---

## Phase 6: Deployment & Monitoring (Day 3)

### Step 6.1: Vercel Deployment
**Configuration**:

**Environment Variables**:
```bash
SORBONNE_USERNAME=student.master
SORBONNE_PASSWORD=guest
REDIS_URL=redis://...          # Optional caching
DATABASE_URL=postgres://...    # Optional persistence
```

**Vercel Configuration** (`vercel.json`):
```json
{
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/api/calendar/(.*)",
      "headers": [
        {
          "key": "Content-Type",
          "value": "text/calendar; charset=utf-8"
        },
        {
          "key": "Cache-Control",
          "value": "public, max-age=900"
        }
      ]
    }
  ]
}
```

**Quality Checks**:
- [ ] Deployment completes without errors
- [ ] Environment variables are secure
- [ ] HTTPS certificate is valid
- [ ] All API endpoints respond correctly
- [ ] Static assets load properly

---

### Step 6.2: Monitoring & Health Checks
**Health Check Endpoint** (`app/api/health/route.ts`):
- Database connectivity
- External CalDAV availability
- Memory/CPU usage
- Response time metrics

**Monitoring Setup**:
- Vercel Analytics integration
- Error tracking (Sentry optional)
- Uptime monitoring
- Performance metrics

**Success Metrics Tracking**:
- Setup completion time
- Event reduction percentage
- Feed request success rate
- User adoption metrics

---

## Phase 7: Documentation & Handoff (Day 3)

### Step 7.1: User Documentation
**Create** (`README.md`):
- Quick start guide
- Subscription URL setup instructions
- Troubleshooting common issues
- Calendar client-specific instructions

### Step 7.2: Developer Documentation
**Technical Documentation**:
- API documentation
- Architecture overview
- Deployment guide
- Contributing guidelines

---

## Risk Mitigation Strategies

### Technical Risks
- **Upstream calendar changes**: Version configuration, health checks
- **Rate limiting**: Implement caching, request queuing
- **Performance issues**: Lazy loading, pagination, caching
- **Security vulnerabilities**: Regular dependency updates, security headers

### Operational Risks
- **High traffic**: Auto-scaling on Vercel, CDN usage
- **Data loss**: Regular backups, stateless design
- **Service downtime**: Health checks, graceful degradation

---

## Success Criteria

### MVP Launch (Week 1)
- [ ] 5+ Sorbonne students successfully using the tool
- [ ] <3 minute setup time achieved
- [ ] >80% event reduction demonstrated
- [ ] 99%+ uptime in first week
- [ ] Zero security incidents

### Post-Launch (Week 2-4)
- [ ] 50+ active users
- [ ] <500ms median response time
- [ ] Positive user feedback (>4/5 rating)
- [ ] Ready for generalization to other universities

---

## Next Steps After MVP

1. **User Feedback Integration**: Collect and implement user suggestions
2. **Performance Optimization**: Based on real usage patterns
3. **Feature Expansion**: Advanced filtering, multiple calendars
4. **Generalization**: Abstract Sorbonne-specific logic for other universities
5. **Mobile App**: If web adoption is successful

---

*This implementation plan ensures high code quality through systematic testing, evaluation, and monitoring at each step. Each phase builds upon the previous one with clear success criteria and quality gates.*
