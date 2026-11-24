
-- Restore the Supabase schema behavior that existed at Vaani commit
-- 51cf4dedc836cf8be30fd19cc7c495f58388c92f.
-- This is a forward rollback migration: preserve the migration audit ledger
-- and preserve all gathering/member/invitation data.

-- Undo the profile-visibility policy introduced by the post-target sitewide audit.
drop policy if exists "Members can view their own and shared gathering profiles" on public.profiles;
drop policy if exists "Authenticated users can view profiles" on public.profiles;
create policy "Authenticated users can view profiles"
  on public.profiles for select to authenticated using (true);

-- Remove only the four indexes introduced by the post-target sitewide audit.
drop index if exists public.session_members_user_status_session_idx;
drop index if exists public.session_join_requests_user_status_session_idx;
drop index if exists public.session_notifications_session_created_idx;
drop index if exists public.session_invite_links_creator_idx;

-- Restore the pre-audit access helper.
create or replace function private.can_view_session(p_session_id uuid)
returns boolean language sql stable security definer set search_path to ''
as $function$
 select exists(
   select 1 from public.sessions s
   where s.id=p_session_id
     and (not s.is_draft or s.created_by=(select auth.uid()))
     and (
       s.access_type='community'
       or exists(
         select 1 from public.session_members m
         where m.session_id=s.id
           and m.user_id=(select auth.uid())
           and m.status='accepted'
       )
     )
 );
$function$;

-- Restore the join and approval functions as they stood immediately before
-- the sitewide audit migration.
create or replace function public.request_session_join(p_session_id uuid)
returns uuid language plpgsql security definer set search_path to ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_waiting boolean;
  v_limit integer;
  v_count integer;
  v_id uuid;
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  select waiting_room_enabled,participant_limit into v_waiting,v_limit
  from public.sessions
  where id=p_session_id and status in ('scheduled','live') and not is_draft
    and access_type='community'
  for update;
  if not found then raise exception 'Gathering is unavailable or requires an invitation.'; end if;
  if exists(select 1 from public.session_members where session_id=p_session_id and user_id=v_user and status='accepted') then return null; end if;
  select count(*) into v_count from public.session_members where session_id=p_session_id and status='accepted';
  if v_limit is not null and v_count>=v_limit then raise exception 'This gathering is full.'; end if;
  if not v_waiting then
    insert into public.session_members(session_id,user_id,role,status)
    values(p_session_id,v_user,'participant','accepted')
    on conflict(session_id,user_id) do update set status='accepted'
    where public.session_members.role='participant' and public.session_members.status='removed'
    returning id into v_id;
    if v_id is null then raise exception 'You cannot join this gathering.'; end if;
    return v_id;
  end if;
  insert into public.session_join_requests(session_id,user_id,status)
  values(p_session_id,v_user,'pending')
  on conflict(session_id,user_id) do update set status='pending',responded_at=null
  where public.session_join_requests.status in ('rejected','cancelled')
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.session_join_requests
    where session_id=p_session_id and user_id=v_user;
  end if;
  return v_id;
end;
$function$;

create or replace function public.approve_session_join_request(p_request_id uuid)
returns void language plpgsql security definer set search_path to ''
as $function$
declare
  v_session uuid;
  v_user uuid;
  v_limit integer;
  v_count integer;
begin
  select session_id,user_id into v_session,v_user
  from public.session_join_requests where id=p_request_id and status='pending';
  if not found then raise exception 'Join request is unavailable.'; end if;
  if not private.can_manage_session(v_session) then raise exception 'You cannot manage this gathering.'; end if;
  perform 1 from public.sessions where id=v_session and status in ('scheduled','live') for update;
  if not found then raise exception 'This gathering is no longer accepting members.'; end if;
  select participant_limit into v_limit from public.sessions where id=v_session;
  select count(*) into v_count from public.session_members where session_id=v_session and status='accepted';
  if v_limit is not null and v_count>=v_limit then raise exception 'The gathering is full.'; end if;
  insert into public.session_members(session_id,user_id,role,status)
  values(v_session,v_user,'participant','accepted')
  on conflict(session_id,user_id) do update set status='accepted'
  where public.session_members.role='participant' and public.session_members.status='removed';
  if not found and not exists(
    select 1 from public.session_members
    where session_id=v_session and user_id=v_user and status='accepted'
  ) then raise exception 'This member cannot be added to the gathering.'; end if;
  update public.session_join_requests set status='approved',responded_at=now() where id=p_request_id;
  insert into public.session_notifications(user_id,session_id,type,title,body)
  values(v_user,v_session,'join_request_approved','Join request approved','Your request to join this gathering was approved.');
end;
$function$;

-- Restore the pre-preview invitation-link creation function from migration
-- 20261122150551_persistent_short_invite_codes_and_published_edits.
create or replace function public.create_session_invite_link(
 p_session_id uuid,
 p_short_code text,
 p_token_hash text,
 p_expires_at timestamptz default null,
 p_max_uses integer default null
) returns text language plpgsql security definer set search_path to '' as $function$
declare
 v_user uuid := (select auth.uid());
 v_s public.sessions%rowtype;
 v_allowed boolean:=false;
 v_code text;
begin
 if v_user is null then raise exception using errcode='42501',message='Authentication required.'; end if;
 select * into v_s from public.sessions
 where id=p_session_id and status in ('scheduled','live') and not is_draft for update;
 if not found then raise exception 'Gathering unavailable.'; end if;
 if v_s.access_type not in ('community','link') then raise exception using errcode='42501',message='Links unavailable.'; end if;
 if private.can_manage_session(p_session_id) then v_allowed:=true;
 else
   select exists(
     select 1 from public.session_members m
     where m.session_id=p_session_id and m.user_id=v_user
       and m.role='participant' and m.status='accepted'
   ) and v_s.allow_participant_invites into v_allowed;
 end if;
 if not v_allowed then raise exception using errcode='42501',message='You cannot create links.'; end if;
 if p_short_code !~ '^[a-z0-9]{10}$' or p_token_hash is null
    or char_length(p_token_hash)<>64
    or (p_expires_at is not null and p_expires_at<=now())
    or (p_max_uses is not null and p_max_uses not between 1 and 500) then
   raise exception 'Invalid link settings.';
 end if;
 select short_code into v_code from public.session_invite_links
 where session_id=p_session_id and created_by=v_user and revoked_at is null
 for update;
 if v_code is not null then
   if exists(
     select 1 from public.session_invite_links
     where session_id=p_session_id and created_by=v_user and revoked_at is null
       and (expires_at is null or expires_at>now())
       and (max_uses is null or use_count<max_uses)
   ) then return v_code; end if;
   update public.session_invite_links set revoked_at=now()
   where session_id=p_session_id and created_by=v_user and revoked_at is null;
 end if;
 insert into public.session_invite_links(session_id,token_hash,short_code,expires_at,max_uses,created_by)
 values(p_session_id,p_token_hash,p_short_code,p_expires_at,p_max_uses,v_user);
 return p_short_code;
end;
$function$;

-- Restore the waiting-room-aware redeem function from the pre-target
-- 20261122170420_remove_legacy_account_invitations migration state.
create or replace function public.redeem_session_invite_link(p_token text)
returns uuid language plpgsql security definer set search_path to ''
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
 if v_user is null then raise exception using errcode='42501',message='Authentication required.'; end if;
 if p_token is null or p_token !~ '^[a-z0-9]{10}$' then raise exception 'Invalid token.'; end if;
 select * into v_link from public.session_invite_links
 where token_hash=encode(extensions.digest(trim(p_token),'sha256'),'hex') for update;
 if not found or v_link.revoked_at is not null
   or (v_link.expires_at is not null and v_link.expires_at<=now())
   or (v_link.max_uses is not null and v_link.use_count>=v_link.max_uses) then
   raise exception 'Link invalid or expired.';
 end if;
 select * into v_s from public.sessions where id=v_link.session_id for update;
 if not found or v_s.status not in ('scheduled','live') or v_s.is_draft then raise exception 'Gathering unavailable.'; end if;
 if v_s.access_type not in ('community','link') then raise exception 'Gathering does not accept links.'; end if;
 select status into v_status from public.session_members
 where session_id=v_link.session_id and user_id=v_user for update;
 if v_status='accepted' then return v_link.session_id; end if;
 if v_s.waiting_room_enabled then
   select id into v_request from public.session_join_requests
   where session_id=v_link.session_id and user_id=v_user and status='pending' for update;
   if v_request is not null then return v_link.session_id; end if;
   insert into public.session_join_requests(session_id,user_id,status)
   values(v_link.session_id,v_user,'pending')
   on conflict(session_id,user_id) do update set status='pending',responded_at=null,created_at=pg_catalog.now()
   where public.session_join_requests.status in ('rejected','cancelled')
   returning id into v_request;
   if v_request is null then raise exception 'A join request is already active.'; end if;
   update public.session_invite_links set use_count=use_count+1 where id=v_link.id;
   return v_link.session_id;
 end if;
 select count(*) into v_count from public.session_members
 where session_id=v_link.session_id and status='accepted';
 if v_s.participant_limit is not null and v_count>=v_s.participant_limit then raise exception 'Gathering full.'; end if;
 insert into public.session_members(session_id,user_id,role,status)
 values(v_link.session_id,v_user,'participant','accepted')
 on conflict(session_id,user_id) do update set role='participant',status='accepted'
 where public.session_members.role='participant' and public.session_members.status='removed'
 returning id into v_member;
 if v_member is null then raise exception 'You cannot join this gathering.'; end if;
 update public.session_invite_links set use_count=use_count+1 where id=v_link.id;
 return v_link.session_id;
end;
$function$;

-- Restore the target migration's function grants.
revoke all on function public.create_session_invite_link(uuid,text,text,timestamptz,integer) from public;
grant execute on function public.create_session_invite_link(uuid,text,text,timestamptz,integer) to authenticated;
revoke all on function public.redeem_session_invite_link(text) from public;
grant execute on function public.redeem_session_invite_link(text) to authenticated;
revoke all on function public.revoke_session_invite_link(uuid) from public;
grant execute on function public.revoke_session_invite_link(uuid) to authenticated;

-- The post-target helper RPCs are not part of the target schema.
drop function if exists public.preview_session_invite_link(text);
drop function if exists public.get_session_member_profiles(uuid);
