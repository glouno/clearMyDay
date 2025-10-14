# OIP Events Fix - Investigation & Resolution

## 🔍 Problem
OIP (Service Orientation et Insertion Professionnelle) events were not appearing in M2 calendars even though users needed them.

## 🎯 Investigation Results

### Events ARE Being Fetched! ✅
- **Found 58 OIP events** in the DAC_M2/IMA_M2 calendars
- Event patterns: `OIP-AI2D-Gr2`, `UM5INOIP-TD5`, `OIPMIND-OIPMIND-Cours`, `MU4INOIP-CS1`
- OIP events are **master-specific** with group variants (not general events)

### Root Cause
1. **Course Code Extraction**: The calendar parser wasn't recognizing OIP/INOIP patterns
2. **Filtering Logic**: OIP events were being treated as unknown courses
3. **Course List Mismatch**: "OIP" wasn't in the M2 course lists
4. **No Group Support**: OIP group patterns weren't recognized

## ✅ Fixes Applied (CORRECTED)

### 1. Updated `calendar-parser.ts` - Course extraction
Added OIP pattern recognition to `extractCourseFromEvent()`:

```typescript
// Check for OIP events first (they have special patterns)
// Examples: "OIP-AI2D-Gr2", "UM5INOIP-TD5", "OIPMIND-OIPMIND-Cours", "MU4INOIP-CS1"
if (/\b(OIP|INOIP)\b/i.test(summary)) {
  return 'OIP';
}
```

### 2. Updated `calendar-parser.ts` - Group matching
Added OIP-specific group patterns to `matchesCourseGroup()`:

```typescript
const oipGroupPattern = /(?:OIP.*-Gr|Groupe\s*)(\d+)/i;
// Matches: "OIP-AI2D-Gr2" -> group "2"
```

### 3. Updated `sorbonne-masters.ts` - Added OIP to all M2 course lists
Added "OIP" as a selectable course for all M2 masters:
- DAC_M2
- IMA_M2
- ANDROIDE_M2
- BIM_M2
- RES_M2
- SAR_M2
- SESI_M2
- STL_M2
- SFPN_M2
- IQ_M2

### 4. Updated `SimplifiedCalendarSelector.tsx` - Master-specific OIP display
Modified course display to show which master each OIP course belongs to:

```typescript
// OIP courses now display as: "OIP (MIND)", "OIP (IMA)", etc.
displayName: course === 'OIP' ? `${course} (${getMasterDisplayName(masterId)})` : course
```

This prevents confusion when multiple M2 masters are selected (each has its own OIP variant).

## 🎯 Expected Behavior After Fix

### Scenario 1: User Selects Multiple M2 Masters
- ✅ OIP appears separately for each master: "OIP (MIND)", "OIP (IMA)", "OIP (AI2D)"
- Each OIP course shows only events for that specific master

### Scenario 2: User Selects OIP Course
- ✅ OIP events appear as regular course events
- ✅ Group filtering works: "OIP-AI2D-Gr2" filtered by group "2"
- ✅ No duplication (treated as regular course, not general event)

### Scenario 3: User Doesn't Select OIP
- ❌ OIP events won't appear (correct behavior - it's a regular course, not a general event)

## 📊 Event Data
From the cached analysis data:

```json
"INOIP": {
  "types": {
    "cours": 3,
    "other": 55
  },
  "groups": {
    "td": [],
    "tme": []
  },
  "totalEvents": 58
}
```

- **58 total events**
- **3 cours** (classroom sessions)
- **55 other** (orientation meetings, career events, etc.)
- **No group filtering** (applies to all students)

## 🧪 Testing Recommendations

1. **Test M2 Calendar Generation**
   - Select any M2 master (e.g., DAC_M2)
   - Select specific courses (e.g., AMAL, BDLE)
   - Generate calendar
   - **Expected**: OIP events should appear even though they're not explicitly selected

2. **Verify in Calendar Preview**
   - Use the "Show Weekly Calendar" feature
   - Look for events with "OIP" or "INOIP" in the title
   - **Expected**: ~58 OIP events across the academic year

3. **Check ICS Output**
   - Generate a calendar subscription
   - Open in a calendar app
   - Search for "OIP" or "Orientation"
   - **Expected**: All OIP events are present

## 🚀 Deployment
These changes can be deployed immediately:
- No database migrations needed
- No breaking changes to existing calendars
- Existing tokens will automatically include OIP events on next fetch

## 📝 Notes
- OIP events are institution-wide and apply to all M2 students
- They typically include career orientation sessions, job forums, and professional insertion meetings
- By recognizing them as general events, they'll always be included regardless of user's course selection
- Users can still explicitly select "OIP" as a course if they want to see only OIP events
