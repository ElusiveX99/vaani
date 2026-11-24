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
as $function$
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
$function$;
