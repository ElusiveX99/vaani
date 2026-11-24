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
  v_bucket record;
begin
  if v_user_id is null then return false; end if;
  case p_action
    when 'livekit_token' then v_limit := 12;
    when 'livekit_moderation' then v_limit := 30;
    when 'document_mutation' then v_limit := 20;
    when 'library_attach' then v_limit := 20;
    else return false;
  end case;
  v_key := v_user_id::text || ':' || p_action;
  select key, window_started_at, request_count into v_bucket
    from private.rate_limit_buckets where key = v_key for update;
  if not found then
    insert into private.rate_limit_buckets(key, window_started_at, request_count) values (v_key, now(), 1);
    return true;
  end if;
  if v_bucket.window_started_at <= now() - make_interval(secs => v_window_seconds) then
    update private.rate_limit_buckets set window_started_at = now(), request_count = 1 where key = v_key;
    return true;
  end if;
  if v_bucket.request_count >= v_limit then return false; end if;
  update private.rate_limit_buckets set request_count = request_count + 1 where key = v_key;
  return true;
end;
$$;
