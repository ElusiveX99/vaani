-- Remove the postponed Vaani Library feature from the live schema.
drop trigger if exists library_documents_updated_at on public.library_documents;
drop function if exists public.add_library_document_to_session(uuid,uuid);
drop function if exists public.library_documents_updated_at();
alter table public.session_documents drop constraint if exists session_documents_library_document_id_fkey;
drop index if exists public.session_documents_library_document_id_idx;
alter table public.session_documents drop column if exists library_document_id;
drop policy if exists "Members can view published library documents" on public.library_documents;
drop table if exists public.library_documents;

-- Remove the obsolete rate-limit action while retaining the existing
-- distributed limiter for the document mutation path.
create or replace function public.check_rate_limit(p_action text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_limit integer;
  v_window_seconds integer;
  v_key text;
  v_now timestamptz;
  v_allowed boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then return false; end if;

  case p_action
    when 'livekit_token' then v_limit := 30; v_window_seconds := 60;
    when 'livekit_moderation' then v_limit := 30; v_window_seconds := 60;
    when 'document_mutation' then v_limit := 20; v_window_seconds := 60;
    else return false;
  end case;

  v_key := v_user_id::text || ':' || p_action;
  v_now := pg_catalog.now();

  insert into private.rate_limit_buckets(user_id, action, window_started_at, request_count)
  values (v_user_id, p_action, v_now, 1)
  on conflict (user_id, action) do update
    set window_started_at = case
      when private.rate_limit_buckets.window_started_at <= v_now - pg_catalog.make_interval(secs => v_window_seconds)
        then v_now else private.rate_limit_buckets.window_started_at end,
        request_count = case
      when private.rate_limit_buckets.window_started_at <= v_now - pg_catalog.make_interval(secs => v_window_seconds)
        then 1 else private.rate_limit_buckets.request_count + 1 end
    where private.rate_limit_buckets.window_started_at <= v_now - pg_catalog.make_interval(secs => v_window_seconds)
       or private.rate_limit_buckets.request_count < v_limit
  returning true into v_allowed;

  return coalesce(v_allowed, false);
end;
$$;