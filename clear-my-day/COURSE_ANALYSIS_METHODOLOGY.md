# Course Analysis Methodology & Future Generalization

## Table of Contents
1. [How the M2 Course Deep Analysis Was Performed](#methodology)
2. [Technical Details](#technical-details)
3. [Future: Auto-Detection System](#future-generalization)
4. [Implementation Feasibility](#feasibility-analysis)
5. [Recommended Approach](#recommended-approach)

---

## How the M2 Course Deep Analysis Was Performed {#methodology}

### Overview
The analysis leveraged **existing calendar data** from Sorbonne's CalDAV servers to identify which courses are actually active in 2024-2025, replacing outdated hardcoded lists.

### Step-by-Step Process

#### **1. Data Collection**
Used the `/api/analyze-events` endpoint which:
- Fetches calendar data from CalDAV URLs
- Parses ICS (iCalendar) format events
- Extracts course identifiers from event titles

**Example CalDAV URL:**
```
https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/DAC/M2_DAC
```

#### **2. Event Parsing & Course Extraction**
The `calendar-parser.ts` already had logic to:
- Extract course codes from event titles (e.g., "UM4IN814-DALAS-Cours" → "DALAS")
- Identify event types (cours, td, tme, exam)
- Detect group numbers (TD 1, TME 2, etc.)

**Pattern matching examples:**
```typescript
// Course code extraction
const courseMatch = title.match(/UM\d+IN\d+-([A-Z0-9]+)-/);
// Results in course codes like: DALAS, BDLE, AMAL, etc.
```

#### **3. Analysis via API Calls**
For each M2 master, I called:
```bash
curl "http://localhost:3000/api/analyze-events?sources=DAC_M2"
```

This returned:
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalEvents": 1258,
      "coursesFound": 32
    },
    "courseAnalysis": {
      "BDLE": {
        "totalEvents": 178,
        "types": {
          "cours": 49,
          "tme": 106,
          "exam": 13
        },
        "groups": {
          "td": [],
          "tme": ["1", "2", "3"]
        }
      },
      // ... more courses
    }
  }
}
```

#### **4. Event Count Ranking**
Extracted all course codes and sorted by event count:
```bash
curl -s "http://localhost:3000/api/analyze-events?sources=DAC_M2" | \
  jq '.data.courseAnalysis | to_entries | 
      map({course: .key, events: .value.totalEvents}) | 
      sort_by(-.events)'
```

**Results for DAC_M2:**
```
BDLE: 178 events
AMAL: 148 events
RLD: 92 events
REDS: 72 events
...
```

#### **5. Validation & Filtering**
- **Excluded noise:** Courses with <5 events (likely admin/test entries)
- **Excluded generic codes:** "TME", "TD", "EXAM", "COURS" (not real courses)
- **Excluded names:** Entries like "MARTIN", "BOUTIN" (professor names, not courses)
- **Kept meaningful codes:** All uppercase alphanumeric codes matching course patterns

#### **6. Manual Update**
Updated `sorbonne-masters.ts` with verified course lists:
```typescript
DAC_M2: {
  // Updated 2024-2025: Real courses with active events (sorted by event count)
  courses: ['BDLE', 'AMAL', 'RLD', 'REDS', 'LODAS', ...],
}
```

### Results Summary

| Master | Events Analyzed | Courses Found | Previously Listed | Added | Removed |
|--------|----------------|---------------|-------------------|-------|---------|
| DAC_M2 | 1,258 | 20 | 13 | +7 | 0 |
| IMA_M2 | 697 | 7 | 7 | +2 | -2 |
| ANDROIDE_M2 | 1,170 | 10 | 9 | +2 | -1 |
| RES_M2 | 1,541 | 12 | 11 | +5 | -4 |
| SAR_M2 | 550 | 9 | 4 | +5 | -1 |
| STL_M2 | 600 | 12 | 10 | +2 | 0 |

---

## Technical Details {#technical-details}

### Why This Works

**1. Structured Event Titles**
Sorbonne uses a consistent naming pattern:
```
UM4IN814-DALAS-Cours (R) TD 5
│   │    │      │        └─ Group
│   │    │      └─ Event type
│   │    └─ Course code
│   └─ Unit code
└─ Master code
```

**2. Existing Parser**
The `calendar-parser.ts` already extracts:
- Course codes via regex
- Event types (cours/td/tme/exam)
- Group numbers
- Timestamps

**3. Statistical Validation**
High event counts (50-178 events) indicate:
- Real courses with regular sessions
- Active throughout the semester
- Multiple event types (cours + td/tme + exam)

### Data Quality Indicators

**Good course indicators:**
- ✅ 20-200 events (full semester course)
- ✅ Multiple event types (cours, td, tme)
- ✅ Regular weekly pattern
- ✅ Group numbers present

**Noise indicators:**
- ❌ 1-4 events (one-off sessions)
- ❌ Generic names ("TME", "EXAM")
- ❌ Person names ("MARTIN", "BOUTIN")
- ❌ Administrative codes ("ATRIUM", "INOIP")

---

## Future: Auto-Detection System {#future-generalization}

### Vision
Instead of hardcoding courses, allow users to:
1. Paste a CalDAV URL
2. System auto-detects available courses
3. User selects from discovered courses
4. Generate filtered calendar

### Is This Feasible? **YES! ✅**

**No LLM required!** This can be done with deterministic pattern matching.

### Architecture

```
User Input: CalDAV URL
     ↓
Step 1: Fetch & Parse Calendar
     ↓
Step 2: Extract Course Codes (regex)
     ↓
Step 3: Statistical Analysis
     ↓ 
Step 4: Filter Noise
     ↓
Step 5: Present to User
     ↓
User Selects Courses & Groups
     ↓
Generate Filtered Calendar
```

### Implementation Approach

#### **Phase 1: URL Validation**
```typescript
async function validateCalDavUrl(url: string) {
  try {
    const response = await fetch(url);
    const icsData = await response.text();
    if (!icsData.includes('BEGIN:VCALENDAR')) {
      throw new Error('Invalid calendar data');
    }
    return true;
  } catch (error) {
    return false;
  }
}
```

#### **Phase 2: Auto-Discovery**
```typescript
async function discoverCourses(calendarUrl: string) {
  // Fetch calendar data
  const events = await fetchCalendarEvents(calendarUrl);
  
  // Extract course codes
  const courseStats = new Map<string, CourseInfo>();
  
  events.forEach(event => {
    const courseCode = extractCourseCode(event.title);
    if (!courseCode) return;
    
    if (!courseStats.has(courseCode)) {
      courseStats.set(courseCode, {
        code: courseCode,
        eventCount: 0,
        types: new Set(),
        groups: new Set(),
        firstSeen: event.start,
        lastSeen: event.end
      });
    }
    
    const stats = courseStats.get(courseCode)!;
    stats.eventCount++;
    stats.types.add(extractEventType(event.title));
    const group = extractGroup(event.title);
    if (group) stats.groups.add(group);
  });
  
  // Filter noise
  return Array.from(courseStats.values())
    .filter(course => course.eventCount >= 5) // Minimum threshold
    .filter(course => course.types.size > 1) // Multiple event types
    .filter(course => isValidCourseCode(course.code)) // Pattern match
    .sort((a, b) => b.eventCount - a.eventCount);
}
```

#### **Phase 3: Smart Filtering**
```typescript
function isValidCourseCode(code: string): boolean {
  // Must be 2-8 uppercase letters/numbers
  if (!/^[A-Z0-9]{2,8}$/.test(code)) return false;
  
  // Blacklist noise
  const noise = ['TD', 'TME', 'COURS', 'EXAM', 'TOEIC', 'IP', 'ATRIUM'];
  if (noise.includes(code)) return false;
  
  // Blacklist common names (heuristic)
  if (/^[A-Z]{1}[A-Z]{5,}$/.test(code)) {
    // Likely a name like "MARTIN", "BOUTIN"
    return false;
  }
  
  return true;
}
```

#### **Phase 4: User Interface**
```typescript
// New component: CalendarUrlInput
function CalendarUrlInput() {
  const [url, setUrl] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [courses, setCourses] = useState<DiscoveredCourse[]>([]);
  
  const handleDiscover = async () => {
    setDiscovering(true);
    const discovered = await discoverCourses(url);
    setCourses(discovered);
    setDiscovering(false);
  };
  
  return (
    <div>
      <input 
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste CalDAV URL..."
      />
      <button onClick={handleDiscover}>Discover Courses</button>
      
      {discovering && <Spinner />}
      
      {courses.length > 0 && (
        <CourseSelector courses={courses} />
      )}
    </div>
  );
}
```

---

## Feasibility Analysis {#feasibility-analysis}

### Complexity: **MEDIUM** 🟡

### Pros ✅
- **No LLM needed** - deterministic pattern matching works
- **Reuses existing code** - `calendar-parser.ts` already does most of the work
- **Fast** - analysis takes 1-2 seconds per calendar
- **Accurate** - event count is a reliable signal
- **Scalable** - works for any CalDAV calendar with consistent naming

### Challenges ⚠️
1. **URL Format Variations**
   - Different universities use different URL patterns
   - Authentication might vary (some use tokens instead of basic auth)
   - **Solution:** Support multiple auth methods

2. **Event Title Patterns**
   - Sorbonne has consistent patterns, but others might not
   - Course codes might be in different positions
   - **Solution:** Make regex patterns configurable

3. **Noise Detection**
   - Generic codes vary by institution
   - Need institution-specific blacklists
   - **Solution:** Use ML-free heuristics (code length, event count, etc.)

4. **Group Detection**
   - Group numbering varies (TD 1, Group A, Team Blue, etc.)
   - **Solution:** Multiple regex patterns with priority

### Required Changes

**New API Endpoint:**
```typescript
// /api/discover-courses
POST /api/discover-courses
Body: { calendarUrl: string }
Response: {
  success: boolean,
  courses: DiscoveredCourse[],
  metadata: {
    totalEvents: number,
    dateRange: { start: Date, end: Date }
  }
}
```

**New UI Component:**
```
SimplifiedCalendarSelector (current)
    ↓
Add mode toggle: "Preset Masters" | "Custom URL"
    ↓
If Custom URL: show CalendarUrlInput
    ↓
Auto-discover courses
    ↓
Present discovered courses for selection
```

**Database Schema:**
```sql
-- Store user-discovered calendars
CREATE TABLE custom_calendars (
  id UUID PRIMARY KEY,
  user_id TEXT,
  calendar_url TEXT,
  discovered_courses JSONB,
  last_analyzed TIMESTAMP,
  metadata JSONB
);
```

---

## Recommended Approach {#recommended-approach}

### Phase 1: MVP (2-3 days) ✅ **FEASIBLE**
1. Add `/api/discover-courses` endpoint
2. Reuse existing `calendar-parser.ts` logic
3. Add simple noise filtering (event count + blacklist)
4. Create basic UI for URL input
5. Display discovered courses

**Code estimate:** ~300 lines

### Phase 2: Enhanced Filtering (1-2 days)
1. Improve noise detection heuristics
2. Add pattern confidence scoring
3. Support multiple URL formats
4. Better error handling

### Phase 3: Persistence (1 day)
1. Save discovered calendars to database
2. Cache analysis results (expires after 1 week)
3. Allow users to name their custom calendars

### Phase 4: Advanced Features (2-3 days)
1. Auto-detect authentication type
2. Support multiple calendar sources
3. Merge courses from multiple calendars
4. Export discovered calendar configurations

---

## Example: Generalized Discovery

### Input
```
URL: https://calendar.example.edu/caldav/engineering/2024
```

### Discovery Process
```
Fetching 450 events...
Analyzing patterns...

Discovered Courses (18 found):
- CS101 (85 events, 3 groups) ✅
- MATH203 (67 events, 2 groups) ✅
- PHYS301 (52 events, 4 groups) ✅
- ENG400 (48 events, 1 group) ✅
...

Filtered Out (noise):
- EXAM (12 events) ❌
- ORIENTATION (3 events) ❌
- ADMIN (1 event) ❌
```

### User Selection
```
[✓] CS101 - Introduction to Programming (85 events)
    Groups available: 1, 2, 3
    Select group: [ 2 ▼ ]

[✓] MATH203 - Linear Algebra (67 events)
    Groups available: A, B
    Select group: [ A ▼ ]

[✓] PHYS301 - Quantum Mechanics (52 events)
    Groups available: 1, 2, 3, 4
    Select group: [ 3 ▼ ]
```

---

## Conclusion

### Is Auto-Detection Feasible? **YES! ✅**

**Key Insights:**
- ✅ **No LLM needed** - pattern matching + statistics work great
- ✅ **Reuses existing code** - 80% of the logic already exists
- ✅ **Fast & reliable** - deterministic analysis in 1-2 seconds
- ✅ **Generalizable** - works for any structured calendar
- ⚠️ **Needs configuration** - regex patterns per institution

**Difficulty Level:** Medium (not trivial, but very doable)

**Development Time:** 1-2 weeks for full implementation

**Value:** HIGH - makes the app usable for:
- Other universities
- Corporate calendars
- Personal calendars
- Any CalDAV/ICS source

### Next Steps
1. Prototype `/api/discover-courses` endpoint
2. Test with Sorbonne calendars (known working)
3. Test with other university calendars
4. Build UI for custom URL input
5. Add persistence & caching
6. Document supported calendar formats

---

**Last Updated:** October 2, 2024  
**Analysis Date:** October 1-2, 2024  
**Data Source:** Sorbonne CalDAV servers (2024-2025 academic year)
