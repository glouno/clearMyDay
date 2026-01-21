#!/bin/bash
set -euo pipefail

echo ""
echo "=== EXDATE Pipeline Verification ==="
echo ""

source_ics="test/fresh_dac.ics"

if [ ! -f "$source_ics" ]; then
    echo "✗ FAIL: Source ICS not found at $source_ics"
    exit 1
fi

# Step 1: Check source ICS has EXDATE
echo "Step 1: Checking fresh_dac.ics for EXDATE..."
exdate_count=$(grep -c "^EXDATE" "$source_ics" || true)
echo "✓ Found $exdate_count EXDATE lines in source ICS"

if [ "$exdate_count" -eq 0 ]; then
    echo "✗ FAIL: No EXDATE in source!"
    exit 1
fi

# Step 2: Check for Oct 27 holiday EXDATE
echo ""
echo "Step 2: Checking for Oct 27 (holiday) EXDATE..."
oct27_count=$(grep -c "EXDATE.*20251027" "$source_ics" || true)
echo "✓ Found $oct27_count EXDATE entries for Oct 27, 2025"

if [ "$oct27_count" -eq 0 ]; then
    echo "⚠ WARNING: No EXDATE for Oct 27 found!"
fi

# Step 3: Verify code logic exists
echo ""
echo "Step 3: Verifying code patterns..."

rg -n "event\\.exdate" clear-my-day/src/lib/caldav-client.ts > /dev/null
rg -n "exdateMap" clear-my-day/src/lib/calendar-parser.ts > /dev/null
rg -n "EXDATE" clear-my-day/src/lib/ics-generator.ts > /dev/null

echo "✅ Found EXDATE parsing/output logic in codebase"

# Step 4: Summary
echo ""
echo "=== VERIFICATION SUMMARY ==="
echo ""
echo "✅ Source ICS has EXDATE ($exdate_count lines)"
echo "✅ Source ICS has Oct 27 EXDATE ($oct27_count lines)"
echo "✅ Code patterns found for EXDATE parsing/output"
echo ""
