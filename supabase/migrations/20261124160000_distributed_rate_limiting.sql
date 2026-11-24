create table if not exists private.rate_limit_buckets (
  key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0
);

create or replace function public.check_rate_limit(p_action text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer;
  v_window_seconds integer;
  v_key text;
  v_bucket private.rate_limit_buckets%rowtype;
begin
  if v_user_id is null then
    return false;
  end if;

  case p_action
    when 'livekit_token' then
      v_limit := 12;
      v_window_seconds := 60;
    when 'livekit_moderation' then
      v_limit := 30;
      v_window_seconds := 60;
    when 'document_mutation' then
      v_limit := 20;
      v_window_seconds := 60;
    when 'library_attach' then
      v_limit := 20;
      v_window_seconds := 60;
    else
      return false;
  end case;

  v_key := v_user_id::text || ':' || p_action;

  select *
    into v_bucket
    from private.rate_limit_buckets
   where key = v_key
   for update;

  if not found then
    insert into private.rate_limit_buckets(key, window_started_at, request_count)
    values (v_key, now(), 1);
    return true;
  end if;

  if v_bucket.window_started_at <= now() - make_interval(secs => v_window_seconds) then
    update private.rate_limit_buckets
       set window_started_at = now(),
           request_count = 1
     where key = v_key;
    return true;
  end if;

  if v_bucket.request_count >= v_limit then
    return false;
  end if;

  update private.rate_limit_buckets
     set request_count = request_count + 1
   where key = v_key;

  return true;
end;
$$;

revoke all on function public.check_rate_limit(text) from public;
grant execute on function public.check_rate_limit(text) to authenticated;

revoke all on private.rate_limit_buckets from public, anon, authenticated;
