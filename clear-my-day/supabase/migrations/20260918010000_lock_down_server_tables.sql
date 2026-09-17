-- These tables are internal implementation details. The Next.js server uses
-- SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS; browser roles get no access.
drop policy if exists "Allow all operations on calendar_tokens" on public.calendar_tokens;
drop policy if exists "Allow all operations on caldav_cache" on public.caldav_cache;
drop policy if exists "Allow all operations on ics_output_cache" on public.ics_output_cache;
drop policy if exists "Allow all operations on analyze_events_cache" on public.analyze_events_cache;

alter table public.calendar_tokens enable row level security;
alter table public.caldav_cache enable row level security;
alter table public.ics_output_cache enable row level security;
alter table public.analyze_events_cache enable row level security;

revoke all on table public.calendar_tokens from anon, authenticated;
revoke all on table public.caldav_cache from anon, authenticated;
revoke all on table public.ics_output_cache from anon, authenticated;
revoke all on table public.analyze_events_cache from anon, authenticated;
