#!/bin/bash

# Fetch CalDAV data from Sorbonne for Sept-Dec 2025
echo "Fetching CalDAV data from Sorbonne..."

curl -s -u "student.master:guest" \
  "https://cal.ufr-info-p6.jussieu.fr/caldav.php/DAC/M1_DAC" \
  -X REPORT \
  -H "Content-Type: application/xml; charset=utf-8" \
  -H "Depth: 1" \
  --data '<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <C:calendar-data />
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="20250901T000000Z" end="20251231T235959Z"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>' > test/sorbonne_caldav_sept_dec_2025.ics

echo "Data saved to test/sorbonne_caldav_sept_dec_2025.ics"
echo "File size: $(wc -c < test/sorbonne_caldav_sept_dec_2025.ics) bytes"
echo "Number of events: $(grep -c 'BEGIN:VEVENT' test/sorbonne_caldav_sept_dec_2025.ics)"
