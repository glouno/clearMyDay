import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ical = require('../clear-my-day/node_modules/node-ical');

// Read the fresh ICS file
const icsData = readFileSync(join(__dirname, 'fresh_fetch.ics'), 'utf8');

console.log('Parsing ICS with node-ical...\n');

const parsed = ical.parseICS(icsData);

// Find the DALAS event
for (const key in parsed) {
  const event = parsed[key];
  if (event.type === 'VEVENT' && event.uid === 'C590FE73-DA0C-49B5-89DC-3D70B78FD724') {
    console.log('Found DALAS event!');
    console.log(`UID: ${event.uid}`);
    console.log(`Summary: ${event.summary}`);
    console.log(`RRULE: ${event.rrule}`);
    console.log(`\nexdate property:`);
    console.log(`  Type: ${typeof event.exdate}`);
    console.log(`  isArray: ${Array.isArray(event.exdate)}`);
    console.log(`  Value:`, event.exdate);
    
    if (Array.isArray(event.exdate)) {
      console.log(`\n  Length: ${event.exdate.length}`);
      console.log(`  Entries:`, event.exdate);
    } else if (typeof event.exdate === 'object') {
      console.log(`\n  Keys:`, Object.keys(event.exdate));
      console.log(`  Values:`, Object.values(event.exdate));
    }
    
    break;
  }
}

console.log('\nDone!');
