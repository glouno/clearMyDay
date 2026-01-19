
import { CalendarParser } from '../lib/calendar-parser';
import { CalendarEvent, FilterConfig } from '../lib/types';

// Mock Events (Based on raw CalDAV data found earlier)
const idleEvent: CalendarEvent = {
    uid: 'idle-123',
    summary: 'UM4IN815-IDLE-Cours',
    start: new Date('2026-01-20T08:30:00'),
    end: new Date('2026-01-20T10:30:00'),
    description: 'Enseignant responsable du TD: M. X\nSome description text', // Simulating the problematic description
    location: 'Salle 123'
};

const mlRattrapageEvent: CalendarEvent = {
    uid: 'ml-456',
    summary: 'UM4IN811-ML-Cours (rattrapage du 29/01)',
    start: new Date('2026-01-22T13:45:00'),
    end: new Date('2026-01-22T15:45:00'),
    description: 'Rattrapage du cours\nTD group assignment pending', // Simulating "TD" in description
    location: 'Amphi 25'
};

const iamsiEvent: CalendarEvent = {
    uid: 'iamsi-789',
    summary: 'UM4IN806-IAMSI-Cours',
    start: new Date('2026-01-20T10:45:00'),
    end: new Date('2026-01-20T12:45:00')
};

// Filter Configuration (Simulating user selection)
const filter: FilterConfig = {
    masters: ['DAC'],
    courses: ['IDLE', 'ML', 'IAMSI'], // User selected these courses
    groups: { td: '5', tme: 'B' },     // Default DAC groups
    dateRange: {
        start: new Date('2026-01-19T00:00:00'),
        end: new Date('2026-01-25T23:59:59')
    }
};

console.log('--- Verifying Fix ---');

const parser = new CalendarParser();

// Test filtering
const filteredEvents = parser.filterEvents([idleEvent, mlRattrapageEvent, iamsiEvent], filter);

console.log('Original Events:', 3);
console.log('Filtered Events:', filteredEvents.length);

filteredEvents.forEach(e => {
    console.log(`✅ Included: ${e.summary}`);
});

const missing = [idleEvent, mlRattrapageEvent, iamsiEvent].filter(
    e => !filteredEvents.some(included => included.uid === e.uid)
);

missing.forEach(e => {
    console.log(`❌ EXCLUDED: ${e.summary}`);
});

if (missing.length === 0) {
    console.log('\nSUCCESS: All events are correctly included!');
} else {
    // Digging deeper if excluded
    console.log('\n--- Debugging Exclusions ---');
    missing.forEach(e => {
        // Re-run checking logic manually
        // Since we can't easily access private methods from outside, we rely on the parser result.
        // But we know the fix was to use event.summary only.
        console.log(`Analyzing ${e.summary}:`);
        console.log(`  Description: ${JSON.stringify(e.description)}`);

        // Simulating the check that was failing
        const unnumberedTdPattern = /(?:^4I\d+-TD|MU4IN\d+-.*-TD|UM4IN\d+-.*-TD|\bTD)(?![0-9])/i;

        // Check ONLY summary (The FIX)
        const summaryHasTd = unnumberedTdPattern.test(e.summary);
        console.log(`  Summary matches 'unnumbered TD'? ${summaryHasTd}`);

        // Check combined (The BUG)
        const textHasTd = unnumberedTdPattern.test(`${e.summary} ${e.description || ''}`);
        console.log(`  Summary+Desc matches 'unnumbered TD'? ${textHasTd}`);

        if (textHasTd && !summaryHasTd) {
            console.log('  -> This confirms the Description caused the issue (and is now fixed if code uses summary!)');
        }
    });
}
