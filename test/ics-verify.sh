#!/usr/bin/env bash
set -euo pipefail

# Minimal ICS verification without Node
# - Fetch Sorbonne CalDAV (REPORT) into test/latest_M1_DAC.ics
# - Verify holiday week (2025-10-27..31) has no DTSTART
# - Verify EXDATEs exist for holiday week in source ICS
# - Verify ClearMyDay feed contains RRULE/EXDATE (no "annulée" exceptions)

SRC_OUT="test/latest_M1_DAC.ics"
CMD_OUT="test/clearmyday_current.ics"
CAL_URL="https://cal.ufr-info-p6.jussieu.fr/caldav.php/DAC/M1_DAC"
AUTH="student.master:guest"

fetch_source() {
  echo "Fetching Sorbonne CalDAV (REPORT) into $SRC_OUT..."
  curl -fsS --max-time 25 --connect-timeout 8 \
    -u "$AUTH" -X REPORT "$CAL_URL" \
    -H "Content-Type: application/xml; charset=utf-8" \
    -H "Depth: 1" \
    --data '<?xml version="1.0" encoding="utf-8"?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop><C:calendar-data /></D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="20250801T000000Z" end="20260301T000000Z"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>' \
    > "$SRC_OUT"
  echo "Saved $(wc -c < "$SRC_OUT") bytes"
}

fetch_cmd() {
  local url="$1" # ClearMyDay ICS URL
  echo "Fetching ClearMyDay feed into $CMD_OUT..."
  curl -fsS --max-time 25 --connect-timeout 8 "$url" > "$CMD_OUT"
  echo "Saved $(wc -c < "$CMD_OUT") bytes"
}

check_holiday() {
  local file="$1"
  echo "Checking no DTSTART during holiday week in $file..."
  if grep -E "DTSTART[^:]*:(20251027|20251028|20251029|20251030|20251031)" -n "$file" >/dev/null; then
    echo "FAIL: Found DTSTART during holiday week:" >&2
    grep -E "DTSTART[^:]*:(20251027|20251028|20251029|20251030|20251031)" -n "$file" | head -20
    return 1
  else
    echo "OK: No DTSTART during holiday week"
  fi
}

check_exdates() {
  local file="$1"
  echo "Checking EXDATE coverage for holiday week in $file..."
  local count
  count=$(grep -E "EXDATE[^:]*:(20251027|20251028|20251029|20251030)" "$file" | wc -l | tr -d ' ')
  echo "Found $count EXDATE lines for holiday week"
  if [ "$count" -eq 0 ]; then
    echo "WARN: No EXDATE found for holiday week in $file" >&2
    return 1
  fi
}

check_cancellations() {
  local src="$1"    # source ICS (REPORT xml containing ICS blocks)
  local cmd="$2"    # ClearMyDay ICS
  echo "Checking cancelled exceptions (Oct 23) handling..."

  # Count cancelled exceptions in source on Oct 23
  local src_cnt
  src_cnt=$(awk 'BEGIN{RS="END:VEVENT";FS="\n"} {blk=$0; if (blk ~ /RECURRENCE-ID[^\n]*:.*20251023/ && tolower(blk) ~ /annul/) c++} END{print c+0}' "$src")
  echo "Source cancelled exceptions on 2025-10-23: $src_cnt"

  # ClearMyDay should NOT contain any "annulée" instances
  local cmd_annul
  cmd_annul=$(grep -i "annul" -n "$cmd" | wc -l | tr -d ' ' || true)
  if [ "$cmd_annul" -gt 0 ]; then
    echo "FAIL: ClearMyDay feed still contains cancelled instances (annulée)" >&2
    grep -i "annul" -n "$cmd" | head -10
    return 1
  else
    echo "OK: No cancelled instances present in ClearMyDay feed"
  fi

  # ClearMyDay should contain EXDATE lines for that date (20251023)
  local cmd_exd
  cmd_exd=$(grep -E "EXDATE[^:]*:.*20251023" "$cmd" | wc -l | tr -d ' ' || true)
  echo "ClearMyDay EXDATE lines for 2025-10-23: $cmd_exd"
  if [ "$src_cnt" -gt 0 ] && [ "$cmd_exd" -eq 0 ]; then
    echo "WARN: Expected EXDATEs for cancelled 2025-10-23 occurrences not found in ClearMyDay feed" >&2
    return 1
  fi
}

usage() {
  cat <<USAGE
Usage: $0 <command> [args]
Commands:
  fetch_source                  Fetch Sorbonne ICS via CalDAV REPORT into $SRC_OUT
  fetch_cmd <url>               Fetch ClearMyDay ICS into $CMD_OUT
  check_holiday <file>          Assert no DTSTART during 2025-10-27..31
  check_exdates <file>          Count EXDATE lines for 2025-10-27..30
  check_cancellations <src> <cmd>  Validate cancelled exceptions (Oct 23)
  audit_all <cmd_url>           Fetch both, run all checks
USAGE
}

audit_all() {
  local cmd_url="$1"
  fetch_source
  fetch_cmd "$cmd_url"
  check_holiday "$SRC_OUT"
  check_exdates "$SRC_OUT"
  check_holiday "$CMD_OUT"
  check_cancellations "$SRC_OUT" "$CMD_OUT"
}

case "${1:-}" in
  fetch_source) fetch_source ;;
  fetch_cmd) shift; fetch_cmd "${1:-}" ;;
  check_holiday) shift; check_holiday "${1:-}" ;;
  check_exdates) shift; check_exdates "${1:-}" ;;
  check_cancellations) shift; check_cancellations "${1:-}" "${2:-}" ;;
  audit_all) shift; audit_all "${1:-}" ;;
  *) usage; exit 1 ;;
esac
