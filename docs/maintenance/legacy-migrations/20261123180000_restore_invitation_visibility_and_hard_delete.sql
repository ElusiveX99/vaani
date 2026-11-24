begin;

-- Permanent deletion replaces the previous soft-revocation state.
delete from public.session_invite_links where revoked_at is not null;

drop index if exists public.session_invite_links_one_active_per_creator;
create unique index session_invite_links_one_per_creator
  on public.session_invite_links (session_id, created_by);

-- Restore the only SELECT policy: creators see their own links, while
-- session managers can see every participant's links.
alter table public.session_invite_links enable row level security;
grant select on table public.session_invite_links to authenticated;
drop policy if exists "Session managers and link creators can view invite links"
  on public.session_invite_links;
create policy "Session managers and link creators can view invite links"
  on public.session_invite_links
  for select
  to authenticated
  using (
    created_by = (select auth.uid())
    or private.can_manage_session(session_id)
  );

create or replace function public.create_session_invite_link(
  p_session_id uuid,
  p_short_code text,
  p_token_hash text
)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_s public.sessions%rowtype;
  v_code text;
begin
  if v_user is null then
    raise exception using errcode='42501', message='Authentication required.';
  end if;

  select * into v_s
  from public.sessions
  where id=p_session_id
    and status::text in ('scheduled','live')
    and not is_draft
  for update;

  if not found then raise exception 'Gathering unavailable.'; end if;
  if v_s.access_type not in ('community','link') then
    raise exception using errcode='42501', message='Links unavailable.';
  end if;

  if not private.can_manage_session(p_session_id) and not exists (
    select 1 from public.session_members m
    where m.session_id=p_session_id
      and m.user_id=v_user
      and m.role='participant'
      and m.status='accepted'
  ) then
    raise exception using errcode='42501', message='You cannot create links.';
  end if;

  if p_short_code is null
    or p_short_code !~ '^[a-z0-9]{10}$'
    or p_token_hash is null
    or p_token_hash <> encode(extensions.digest(p_short_code,'sha256'),'hex')
  then
    raise exception 'Invalid invitation code.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_session_id::text||':'||v_user::text,0)
  );

  select short_code into v_code
  from public.session_invite_links
  where session_id=p_session_id and created_by=v_user
  for update;

  if v_code is not null then return v_code; end if;

  insert into public.session_invite_links(session_id,token_hash,short_code,created_by)
  values(p_session_id,p_token_hash,p_short_code,v_user);

  return p_short_code;
end;
$function$;

revoke all on function public.create_session_invite_link(uuid,text,text) from public,anon;
grant execute on function public.create_session_invite_link(uuid,text,text) to authenticated;

create or replace function public.preview_session_invite_link(p_code text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_link public.session_invite_links%rowtype;
  v_s public.sessions%rowtype;
  v_count integer;
  v_state text;
begin
  if p_code is null or p_code !~ '^[a-z0-9]{10}$' then
    return jsonb_build_object('state','invalid');
  end if;

  select * into v_link
  from public.session_invite_links
  where token_hash=encode(extensions.digest(trim(p_code),'sha256'),'hex');

  if not found then return jsonb_build_object('state','invalid'); end if;

  select * into v_s from public.sessions where id=v_link.session_id;
  if not found or v_s.is_draft or v_s.status::text not in ('scheduled','live') then
    return jsonb_build_object('state','unavailable');
  end if;

  select count(*)::integer into v_count
  from public.session_members
  where session_id=v_s.id and status='accepted' and role='participant';

  v_state := case
    when v_s.participant_limit is not null and v_count>=v_s.participant_limit then 'full'
    else 'valid'
  end;

  return jsonb_build_object(
    'state',v_state,
    'title',v_s.title,
    'description',v_s.description,
    'scheduled_start_at',v_s.scheduled_start_at,
    'time_zone',v_s.time_zone,
    'duration_minutes',v_s.duration_minutes,
    'status',v_s.status::text,
    'participants',v_count,
    'participant_limit',v_s.participant_limit,
    'waiting_room_enabled',v_s.waiting_room_enabled
  );
end;
$function$;

revoke all on function public.preview_session_invite_link(text) from public;
grant execute on function public.preview_session_invite_link(text) to anon,authenticated;

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
    raise exception using errcode='42501', message='Authentication required.';
  end if;
  if p_token is null or p_token !~ '^[a-z0-9]{10}$' then
    raise exception 'Invitation link is invalid or unavailable.';
  end if;

  select * into v_link
  from public.session_invite_links
  where token_hash=encode(extensions.digest(trim(p_token),'sha256'),'hex')
  for update;

  if not found then raise exception 'Invitation link is invalid or unavailable.'; end if;

  select * into v_s from public.sessions where id=v_link.session_id for update;
  if not found or v_s.status not in ('scheduled','live') or v_s.is_draft then
    raise exception 'Gathering unavailable.';
  end if;
  if v_s.access_type not in ('community','link') then
    raise exception 'Gathering does not accept links.';
  end if;

  select status into v_status
  from public.session_members
  where session_id=v_link.session_id and user_id=v_user
  for update;
  if v_status='accepted' then return v_link.session_id; end if;

  select id into v_request
  from public.session_join_requests
  where session_id=v_link.session_id and user_id=v_user and status='pending'
  for update;
  if v_request is not null then return v_link.session_id; end if;

  select count(*) into v_count
  from public.session_members
  where session_id=v_link.session_id and status='accepted' and role='participant';
  if v_s.participant_limit is not null and v_count>=v_s.participant_limit then
    raise exception 'Gathering full.';
  end if;

  if v_s.waiting_room_enabled then
    insert into public.session_join_requests(session_id,user_id,status)
    values(v_link.session_id,v_user,'pending')
    on conflict(session_id,user_id) do update
      set status='pending',responded_at=null,created_at=pg_catalog.now()
      where public.session_join_requests.status in ('rejected','cancelled')
    returning id into v_request;
    if v_request is null then raise exception 'A join request is already active.'; end if;
    return v_link.session_id;
  end if;

  insert into public.session_members(session_id,user_id,role,status)
  values(v_link.session_id,v_user,'participant','accepted')
  on conflict(session_id,user_id) do update
    set role='participant',status='accepted'
    where public.session_members.role='participant'
      and public.session_members.status='removed'
  returning id into v_member;
  if v_member is null then raise exception 'You cannot join this gathering.'; end if;

  return v_link.session_id;
end;
$function$;

revoke all on function public.redeem_session_invite_link(text) from public,anon;
grant execute on function public.redeem_session_invite_link(text) to authenticated;

drop function if exists public.revoke_session_invite_link(uuid);
create function public.delete_session_invite_link(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_link public.session_invite_links%rowtype;
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception using errcode='42501', message='Authentication required.';
  end if;

  select * into v_link
  from public.session_invite_links
  where id=p_link_id
  for update;

  if not found
    or (
      v_user is distinct from v_link.created_by
      and not private.can_manage_session(v_link.session_id)
    )
  then
    raise exception using errcode='42501', message='You cannot delete this invitation link.';
  end if;

  delete from public.session_invite_links where id=p_link_id;
end;
$function$;

revoke all on function public.delete_session_invite_link(uuid) from public,anon;
grant execute on function public.delete_session_invite_link(uuid) to authenticated;

-- Backward-compatible RPC for the currently deployed UI during rollout.
-- Its behavior is permanent deletion, not soft revocation.
create or replace function public.revoke_session_invite_link(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  perform public.delete_session_invite_link(p_link_id);
end;
$function$;

revoke all on function public.revoke_session_invite_link(uuid) from public,anon;
grant execute on function public.revoke_session_invite_link(uuid) to authenticated;

-- Keep the nullable legacy column temporarily so the currently deployed page
-- can continue reading it during rollout. Deleted links are never retained.

commit;
