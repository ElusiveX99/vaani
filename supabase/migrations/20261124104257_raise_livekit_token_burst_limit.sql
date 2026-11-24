create or replace function public.check_rate_limit(p_action text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer;
  v_window_seconds integer := 60;
  v_key text;
  v_allowed boolean := false;
begin
  if v_user_id is null then return false; end if;
  case p_action
    when 'livekit_token' then v_limit := 30;
    when 'livekit_moderation' then v_limit := 30;
    when 'document_mutation' then v_limit := 20;
    when 'library_attach' then v_limit := 20;
    else return false;
  end case;
  v_key := v_user_id::text || ':' || p_action;
  insert into private.rate_limit_buckets as bucket (key, window_started_at, request_count)
  values (v_key, pg_catalog.now(), 1)
  on conflict (key) do update
    set window_started_at = case
          when bucket.window_started_at <= pg_catalog.now() - pg_catalog.make_interval(secs => v_window_seconds)
          then pg_catalog.now() else bucket.window_started_at end,
        request_count = case
          when bucket.window_started_at <= pg_catalog.now() - pg_catalog.make_interval(secs => v_window_seconds)
          then 1 else bucket.request_count + 1 end
    where bucket.window_started_at <= pg_catalog.now() - pg_catalog.make_interval(secs => v_window_seconds)
       or bucket.request_count < v_limit
  returning true into v_allowed;
  return coalesce(v_allowed, false);
end;
$$;
revoke all on function public.check_rate_limit(text) from public;
grant execute on function public.check_rate_limit(text) to authenticated;
