-- Cache writes invoke this function after a miss. That makes cleanup automatic
-- without requiring pg_cron or a publicly reachable maintenance endpoint.
create or replace function public.cleanup_expired_cache_rows()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted_rows integer := 0;
  affected_rows integer;
begin
  delete from public.caldav_cache where expires_at < now();
  get diagnostics affected_rows = row_count;
  deleted_rows := deleted_rows + affected_rows;

  delete from public.ics_output_cache where expires_at < now();
  get diagnostics affected_rows = row_count;
  deleted_rows := deleted_rows + affected_rows;

  delete from public.analyze_events_cache where expires_at < now();
  get diagnostics affected_rows = row_count;
  deleted_rows := deleted_rows + affected_rows;

  return deleted_rows;
end;
$$;

revoke all on function public.cleanup_expired_cache_rows() from public, anon, authenticated;
grant execute on function public.cleanup_expired_cache_rows() to service_role;

comment on function public.cleanup_expired_cache_rows() is
  'Deletes expired internal cache rows; invoked by server-side cache-miss paths.';
