# ClearMyDay - Project Overview & Technical Documentation

## 🎯 **Project Goal & Purpose**

**ClearMyDay** is a web application designed for **Sorbonne University students** to filter and customize their academic calendar subscriptions. The main goal is to allow students to:

1. **Filter** their academic calendar by selecting specific:
   - Master's programs (DAC, IMA, ANDROIDE)
   - Individual courses (MLBDA, MAPSI, DALAS, etc.)
   - Course groups (TD/TME groups)

2. **Generate** a personalized ICS calendar subscription URL
3. **Subscribe** to this filtered calendar in their preferred calendar app (Apple Calendar, Google Calendar, etc.)
4. **Preview** what their filtered calendar will look like before subscribing

## 🏗️ **System Architecture**

### **Core Workflow:**
```
User Selection → Filter Configuration → ICS Generation → Calendar Subscription
     ↓                    ↓                 ↓              ↓
  UI Filters      API Processing     Calendar File    Apple/Google Cal
```

### **Key Components:**

#### **Frontend (React/Next.js)**
- `SimplifiedCalendarSelector` - Main UI for course/master selection
- `SimpleCalendarPreview` - Calendar preview component (production)
- `WeeklyCalendarPreview` - Legacy complex preview (debug branch only)
- `FilteredEventsPreview` - Simple event list preview

#### **Backend APIs**
- `/api/generate-calendar` - **CORE API** - Generates filtered ICS calendar
- `/api/calendar/[token]` - **DELIVERY API** - Serves ICS files to calendar apps
- `/api/debug-calendar` - **DEBUG ONLY** - Complex debugging endpoint (legacy)

#### **Data Processing**
- `ics-generator.ts` - Creates ICS calendar files with RRULE support
- `sorbonne-masters.ts` - Course definitions and filtering logic
- `recurrence-handler.ts` - RRULE expansion (used in debug components)

## 📊 **Data Structure**

### **Course Data:**
```typescript
interface Course {
  id: string;           // e.g., "MU4IN801-MLBDA"
  name: string;         // e.g., "Machine Learning & Big Data Analytics"
  master: string[];     // e.g., ["DAC", "IMA"]
  events: Event[];      // Calendar events for this course
}
```

### **Filter Configuration:**
```typescript
interface FilterConfig {
  masters: ('DAC' | 'IMA' | 'ANDROIDE')[];
  courses: string[];
  groups: { td: string; tme: string };
  courseGroups: { [courseId: string]: string };
  dateRange: { start: Date; end: Date };
}
```

### **Event Types:**
- **Cours** (Blue) - Lectures
- **TD** (Green) - Directed Work sessions  
- **TME** (Purple) - Practical Work sessions
- **Exam** (Red) - Examinations

## 🔄 **Current Status & Branch Strategy**

### **Branch Structure:**
- **`debug`** - Preserves all debugging tools and complex components
- **`staging`** - Clean, production-ready code (current active branch)
- **`main/master`** - Final production deployment

### **Working Components (Keep):**
- ✅ `/api/generate-calendar` - Core functionality, reliable
- ✅ `/api/calendar/[token]` - ICS delivery, working
- ✅ `SimplifiedCalendarSelector` - User interface, functional
- ✅ `SimpleCalendarPreview` - New clean preview component
- ✅ `ics-generator.ts` - Calendar generation, reliable

### **Legacy/Problematic Components (Debug Branch Only):**
- ❌ `/api/debug-calendar` - Complex, buggy timezone handling
- ❌ `WeeklyCalendarPreview` - Over-engineered, RRULE issues
- ❌ Custom timezone logic - Error-prone DST calculations
- ❌ `EventAnalyzer` - Debugging tool only

## 🚨 **Known Issues & Solutions**

### **Fixed Issues:**
1. **RRULE Clustering Bug** - Recurring events showed same timestamp
   - **Solution:** Use `ical.js` library instead of custom RRULE expansion
   
2. **Timezone Handling** - Complex DST calculations caused errors
   - **Solution:** Simplified to use browser's native timezone handling
   
3. **Calendar Preview UX** - Poor user experience
   - **Solution:** New `SimpleCalendarPreview` with proper time ranges and colors

### **Current Architecture Decision:**
**Use the working `/api/generate-calendar` API as the single source of truth.** All preview components should fetch from this API and parse the resulting ICS content with `ical.js` rather than implementing custom parsing logic.

## 🛠️ **Technical Implementation Details**

### **ICS Calendar Generation:**
```typescript
// Core process in /api/generate-calendar
1. Receive filter configuration
2. Filter events based on masters/courses/groups
3. Generate ICS content with proper RRULE syntax
4. Store with unique token
5. Return subscription URL
```

### **Calendar Preview Process:**
```typescript
// New simplified approach in SimpleCalendarPreview
1. Call /api/generate-calendar with user filters
2. Fetch ICS content from returned subscription URL
3. Parse with ical.js library (handles RRULE automatically)
4. Display in react-big-calendar with proper styling
```

### **Event Filtering Logic:**
- **Master Filter:** Include only courses available to selected masters
- **Course Filter:** Include only explicitly selected courses
- **Group Filter:** Filter TD/TME events by group assignments
- **Date Range:** Include events within academic year range

## 📋 **Future Development Guidelines**

### **For New Features:**
1. **Always use** the working `/api/generate-calendar` API
2. **Avoid** custom ICS parsing - use `ical.js`
3. **Keep** components simple and focused
4. **Test** with real Sorbonne calendar data

### **For Refactoring:**
1. **Preserve** the working API endpoints
2. **Simplify** complex components by removing custom logic
3. **Use** proven libraries (ical.js, react-big-calendar)
4. **Maintain** the debug branch for troubleshooting

### **For Deployment:**
1. **Remove** debug components from production
2. **Optimize** bundle size
3. **Add** proper error boundaries
4. **Test** calendar subscription in multiple calendar apps

## 🎯 **End Goal - Production Requirements**

### **User Experience:**
- ✅ Simple, intuitive course selection interface
- ✅ Real-time calendar preview with proper colors and times
- ✅ One-click calendar subscription generation
- ✅ Works seamlessly with Apple Calendar, Google Calendar, etc.

### **Technical Requirements:**
- ✅ Fast, reliable ICS generation
- ✅ Proper RRULE handling for recurring events
- ✅ Clean, maintainable codebase
- ✅ Production-ready error handling
- ✅ Mobile-responsive design

### **Success Metrics:**
- Students can filter their calendar in under 30 seconds
- Generated calendars display correctly in all major calendar apps
- No clustering or timezone issues
- Clean, professional interface matching university standards

## 🔧 **Development Environment**

### **Tech Stack:**
- **Frontend:** React, Next.js, TypeScript, Tailwind CSS
- **Calendar:** react-big-calendar, ical.js, moment.js
- **Backend:** Next.js API routes
- **Data:** Static course definitions, ICS file generation

### **Key Dependencies:**
- `ical.js` - Reliable ICS parsing and RRULE handling
- `react-big-calendar` - Calendar display component
- `moment` - Date handling for calendar localizer

### **File Structure:**
```
src/
├── app/
│   ├── api/
│   │   ├── generate-calendar/     # Core API (keep)
│   │   ├── calendar/[token]/      # ICS delivery (keep)
│   │   └── debug-calendar/        # Debug only
├── components/
│   ├── SimplifiedCalendarSelector.tsx  # Main UI (keep)
│   ├── SimpleCalendarPreview.tsx       # New preview (keep)
│   └── WeeklyCalendarPreview.tsx       # Debug only
└── lib/
    ├── ics-generator.ts           # Core logic (keep)
    ├── sorbonne-masters.ts        # Course data (keep)
    └── recurrence-handler.ts      # Debug only
```

This documentation should provide a complete understanding of the project for any developer taking over or refactoring the codebase.
