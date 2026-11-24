-- Stop generating unused 32-character public slugs for new gatherings.
-- Existing values remain valid so previously shared /g/<32-character-slug> URLs continue to work.
alter table public.sessions
  alter column public_slug drop default,
  alter column public_slug drop not null;

-- Remove a duplicate SELECT policy left by the earlier permission reconciliation.
drop policy if exists "Session managers and creators can view invite links"
on public.session_invite_links;

-- Preserve participant limits for invitation-based joins, including waiting-room requests.
-- The previous implementation checked capacity only for immediate admission, allowing
-- requests to enter the waiting room after the gathering had already reached its limit.

create or replace function public.redeem_session_invite_link(p_token text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_link public.session_invite_links%rowtype;
  v_s public.sessions%rowtype;
  v_member uuid;
  v_request uuid;
  v_status text;
  v_count integer;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if p_token is null or p_token !~ '^[a-z0-9]{10}$' then
    raise exception 'Invalid token.';
  end if;

  select * into v_link
  from public.session_invite_links
  where token_hash = encode(extensions.digest(trim(p_token), 'sha256'), 'hex')
  for update;

  if not found
    or v_link.revoked_at is not null
    or (v_link.expires_at is not null and v_link.expires_at <= pg_catalog.now())
    or (v_link.max_uses is not null and v_link.use_count >= v_link.max_uses)
  then
    raise exception 'Link invalid or expired.';
  end if;

  select * into v_s
  from public.sessions
  where id = v_link.session_id
  for update;

  if not found or v_s.status not in ('scheduled', 'live') or v_s.is_draft then
    raise exception 'Gathering unavailable.';
  end if;

  if v_s.access_type not in ('community', 'link') then
    raise exception 'Gathering does not accept links.';
  end if;

  select status into v_status
  from public.session_members
  where session_id = v_link.session_id and user_id = v_user
  for update;

  if v_status = 'accepted' then
    return v_link.session_id;
  end if;

  -- Capacity applies before either immediate admission or waiting-room queuing.
  select count(*) into v_count
  from public.session_members
  where session_id = v_link.session_id
    and status = 'accepted'
    and role = 'participant';

  if v_s.participant_limit is not null and v_count >= v_s.participant_limit then
    raise exception 'Gathering full.';
  end if;

  if v_s.waiting_room_enabled then
    select id into v_request
    from public.session_join_requests
    where session_id = v_link.session_id
      and user_id = v_user
      and status = 'pending'
    for update;

    if v_request is not null then
      return v_link.session_id;
    end if;

    insert into public.session_join_requests(session_id, user_id, status)
    values (v_link.session_id, v_user, 'pending')
    on conflict (session_id, user_id) do update
      set status = 'pending',
          responded_at = null,
          created_at = pg_catalog.now()
      where public.session_join_requests.status in ('rejected', 'cancelled')
    returning id into v_request;

    if v_request is null then
      raise exception 'A join request is already active.';
    end if;

    update public.session_invite_links
    set use_count = use_count + 1
    where id = v_link.id;

    return v_link.session_id;
  end if;

  insert into public.session_members(session_id, user_id, role, status)
  values (v_link.session_id, v_user, 'participant', 'accepted')
  on conflict (session_id, user_id) do update
    set role = 'participant',
        status = 'accepted'
    where public.session_members.role = 'participant'
      and public.session_members.status = 'removed'
  returning id into v_member;

  if v_member is null then
    raise exception 'You cannot join this gathering.';
  end if;

  update public.session_invite_links
  set use_count = use_count + 1
  where id = v_link.id;

  return v_link.session_id;
end;
$function$;


-- Keep the legacy 32-character gathering URL's link-access path consistent too.
-- Community gatherings delegate to request_session_join(), which already checks
-- capacity before creating a waiting-room request.
create or replace function public.request_gathering_join_by_slug(p_slug text)
returns table (session_id uuid, outcome text)
language plpgsql
security definer
set search_path to ''
as $function$
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

  -- Capacity applies before immediate admission and waiting-room queuing.
  select count(*) into v_count
  from public.session_members
  where session_id = v_session.id
    and status = 'accepted'
    and role = 'participant';

  if v_session.participant_limit is not null and v_count >= v_session.participant_limit then
    raise exception 'This gathering is full.';
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
$function$;
