-- Stable short public addresses for gatherings.
-- The slug is a locator for community gatherings and a bearer invitation for link-only gatherings.
alter table public.sessions add column public_slug text;

update public.sessions
set public_slug = encode(extensions.gen_random_bytes(9), 'hex')
where public_slug is null;

alter table public.sessions
  alter column public_slug set default encode(extensions.gen_random_bytes(9), 'hex'),
  alter column public_slug set not null;

create unique index sessions_public_slug_uidx on public.sessions(public_slug);

create or replace function public.preview_gathering_by_slug(p_slug text)
returns table (
  session_id uuid,
  title text,
  description text,
  access_type text,
  status text,
  scheduled_start_at timestamptz,
  time_zone text,
  duration_minutes integer,
  participant_count bigint,
  participant_limit integer,
  waiting_room_enabled boolean
)
language sql
stable
security definer
set search_path to ''
as $$
  select
    s.id,
    s.title,
    s.description,
    s.access_type,
    s.status::text,
    s.scheduled_start_at,
    s.time_zone,
    s.duration_minutes,
    (select count(*) from public.session_members m
      where m.session_id = s.id and m.status = 'accepted') as participant_count,
    s.participant_limit,
    s.waiting_room_enabled
  from public.sessions s
  where s.public_slug = p_slug
    and not s.is_draft
    and s.status in ('scheduled', 'live')
  limit 1;
$$;

create or replace function public.request_gathering_join_by_slug(p_slug text)
returns table (session_id uuid, outcome text)
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_session public.sessions%rowtype;
  v_count integer;
  v_member uuid;
  v_request uuid;
  v_existing_status text;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select * into v_session
  from public.sessions
  where public_slug = p_slug
    and not is_draft
    and status in ('scheduled', 'live')
    and access_type in ('community', 'link')
  for update;

  if not found then
    raise exception 'This gathering is unavailable.';
  end if;

  if v_session.access_type = 'community' then
    perform public.request_session_join(v_session.id);

    if exists (
      select 1 from public.session_members
      where session_id = v_session.id and user_id = v_user and status = 'accepted'
    ) then
      return query select v_session.id, 'joined'::text;
    else
      return query select v_session.id, 'request_pending'::text;
    end if;
    return;
  end if;

  select status into v_existing_status
  from public.session_members
  where session_id = v_session.id and user_id = v_user
  for update;

  if v_existing_status = 'accepted' then
    return query select v_session.id, 'already_member'::text;
    return;
  end if;

  if v_session.waiting_room_enabled then
    select id into v_request
    from public.session_join_requests
    where session_id = v_session.id and user_id = v_user and status = 'pending'
    for update;

    if v_request is not null then
      return query select v_session.id, 'request_pending'::text;
      return;
    end if;

    insert into public.session_join_requests(session_id, user_id, status)
    values (v_session.id, v_user, 'pending')
    on conflict (session_id, user_id) do update
      set status = 'pending', responded_at = null, created_at = pg_catalog.now()
      where public.session_join_requests.status in ('rejected', 'cancelled')
    returning id into v_request;

    if v_request is null then
      raise exception 'A join request is already active.';
    end if;

    return query select v_session.id, 'request_pending'::text;
    return;
  end if;

  select count(*) into v_count
  from public.session_members
  where session_id = v_session.id
    and status = 'accepted'
    and role = 'participant';

  if v_session.participant_limit is not null and v_count >= v_session.participant_limit then
    raise exception 'This gathering is full.';
  end if;

  insert into public.session_members(session_id, user_id, role, status)
  values (v_session.id, v_user, 'participant', 'accepted')
  on conflict (session_id, user_id) do update
    set role = 'participant', status = 'accepted'
    where public.session_members.role = 'participant'
      and public.session_members.status = 'removed'
  returning id into v_member;

  if v_member is null then
    raise exception 'You cannot join this gathering.';
  end if;

  return query select v_session.id, 'joined'::text;
end;
$$;

revoke all on function public.preview_gathering_by_slug(text) from public;
revoke all on function public.request_gathering_join_by_slug(text) from public;
grant execute on function public.preview_gathering_by_slug(text) to anon, authenticated;
grant execute on function public.request_gathering_join_by_slug(text) to authenticated;
