-- Sitewide audit: profile privacy, pending link join access, participant limits and indexes.
drop policy if exists "Authenticated users can view profiles" on public.profiles;
drop policy if exists "Members can view their own and shared gathering profiles" on public.profiles;
create policy "Members can view their own and shared gathering profiles" on public.profiles
for select to authenticated using (
 id=(select auth.uid())
 or exists(select 1 from public.session_members viewer join public.session_members target on target.session_id=viewer.session_id
   where viewer.user_id=(select auth.uid()) and viewer.status='accepted' and target.user_id=profiles.id and target.status='accepted')
 or exists(select 1 from public.session_join_requests request join public.session_members manager on manager.session_id=request.session_id
   where request.user_id=profiles.id and request.status='pending' and manager.user_id=(select auth.uid()) and manager.status='accepted' and manager.role in ('organizer','in_charge','admin'))
);
create index if not exists session_members_user_status_session_idx on public.session_members(user_id,status,session_id);
create index if not exists session_join_requests_user_status_session_idx on public.session_join_requests(user_id,status,session_id);
create index if not exists session_notifications_session_created_idx on public.session_notifications(session_id,created_at desc);
create index if not exists session_invite_links_creator_idx on public.session_invite_links(created_by,session_id);

create or replace function private.can_view_session(p_session_id uuid)
returns boolean language sql stable security definer set search_path to ''
as $function$
 select exists(select 1 from public.sessions s where s.id=p_session_id and (
   (not s.is_draft and (s.access_type='community'
    or exists(select 1 from public.session_members m where m.session_id=s.id and m.user_id=(select auth.uid()) and m.status='accepted')
    or exists(select 1 from public.session_join_requests jr where jr.session_id=s.id and jr.user_id=(select auth.uid()) and jr.status='pending')))
   or (s.is_draft and s.created_by=(select auth.uid()))
 ));
$function$;

create or replace function public.request_session_join(p_session_id uuid)
returns uuid language plpgsql security definer set search_path to ''
as $function$
declare v_user uuid:=(select auth.uid()); v_waiting boolean; v_limit integer; v_count integer; v_id uuid;
begin
 if v_user is null then raise exception using errcode='42501',message='Authentication required.'; end if;
 select waiting_room_enabled,participant_limit into v_waiting,v_limit from public.sessions
 where id=p_session_id and status in ('scheduled','live') and not is_draft and access_type='community' for update;
 if not found then raise exception 'Gathering is unavailable or requires an invitation.'; end if;
 if exists(select 1 from public.session_members where session_id=p_session_id and user_id=v_user and status='accepted') then return null; end if;
 select count(*) into v_count from public.session_members where session_id=p_session_id and status='accepted' and role='participant';
 if v_limit is not null and v_count>=v_limit then raise exception 'This gathering is full.'; end if;
 if not v_waiting then
  insert into public.session_members(session_id,user_id,role,status) values(p_session_id,v_user,'participant','accepted')
  on conflict(session_id,user_id) do update set status='accepted'
  where public.session_members.role='participant' and public.session_members.status='removed' returning id into v_id;
  if v_id is null then raise exception 'You cannot join this gathering.'; end if; return v_id;
 end if;
 insert into public.session_join_requests(session_id,user_id,status) values(p_session_id,v_user,'pending')
 on conflict(session_id,user_id) do update set status='pending',responded_at=null
 where public.session_join_requests.status in ('rejected','cancelled') returning id into v_id;
 if v_id is null then select id into v_id from public.session_join_requests where session_id=p_session_id and user_id=v_user; end if;
 return v_id;
end;$function$;

create or replace function public.approve_session_join_request(p_request_id uuid)
returns void language plpgsql security definer set search_path to ''
as $function$
declare v_session uuid; v_user uuid; v_limit integer; v_count integer;
begin
 select session_id,user_id into v_session,v_user from public.session_join_requests where id=p_request_id and status='pending';
 if not found then raise exception 'Join request is unavailable.'; end if;
 if not private.can_manage_session(v_session) then raise exception using errcode='42501',message='You cannot manage this gathering.'; end if;
 perform 1 from public.sessions where id=v_session and status in ('scheduled','live') for update;
 if not found then raise exception 'This gathering is no longer accepting members.'; end if;
 select participant_limit into v_limit from public.sessions where id=v_session;
 select count(*) into v_count from public.session_members where session_id=v_session and status='accepted' and role='participant';
 if v_limit is not null and v_count>=v_limit then raise exception 'The gathering is full.'; end if;
 insert into public.session_members(session_id,user_id,role,status) values(v_session,v_user,'participant','accepted')
 on conflict(session_id,user_id) do update set status='accepted'
 where public.session_members.role='participant' and public.session_members.status='removed';
 if not found and not exists(select 1 from public.session_members where session_id=v_session and user_id=v_user and status='accepted') then raise exception 'This member cannot be added to the gathering.'; end if;
 update public.session_join_requests set status='approved',responded_at=now() where id=p_request_id;
 insert into public.session_notifications(user_id,session_id,type,title,body) values(v_user,v_session,'join_request_approved','Join request approved','Your request to join this gathering was approved.');
end;$function$;

create or replace function public.redeem_session_invite_link(p_token text)
returns uuid language plpgsql security definer set search_path to ''
as $function$
declare v_user uuid:=(select auth.uid()); v_link public.session_invite_links%rowtype; v_s public.sessions%rowtype; v_member uuid; v_request uuid; v_status text; v_count integer;
begin
 if v_user is null then raise exception using errcode='42501',message='Authentication required.'; end if;
 if p_token is null or p_token !~ '^[a-z0-9]{10}$' then raise exception 'Invalid token.'; end if;
 select * into v_link from public.session_invite_links where token_hash=encode(extensions.digest(trim(p_token),'sha256'),'hex') for update;
 if not found or v_link.revoked_at is not null or (v_link.expires_at is not null and v_link.expires_at<=now())
   or (v_link.max_uses is not null and v_link.use_count>=v_link.max_uses) then raise exception 'Link invalid or expired.'; end if;
 select * into v_s from public.sessions where id=v_link.session_id for update;
 if not found or v_s.status not in ('scheduled','live') or v_s.is_draft then raise exception 'Gathering unavailable.'; end if;
 if v_s.access_type not in ('community','link') then raise exception 'Gathering does not accept links.'; end if;
 select status into v_status from public.session_members where session_id=v_link.session_id and user_id=v_user for update;
 if v_status='accepted' then return v_link.session_id; end if;
 if v_s.waiting_room_enabled then
  select id into v_request from public.session_join_requests where session_id=v_link.session_id and user_id=v_user and status='pending' for update;
  if v_request is not null then return v_link.session_id; end if;
  insert into public.session_join_requests(session_id,user_id,status) values(v_link.session_id,v_user,'pending')
  on conflict(session_id,user_id) do update set status='pending',responded_at=null,created_at=pg_catalog.now()
  where public.session_join_requests.status in ('rejected','cancelled') returning id into v_request;
  if v_request is null then raise exception 'A join request is already active.'; end if;
  update public.session_invite_links set use_count=use_count+1 where id=v_link.id; return v_link.session_id;
 end if;
 select count(*) into v_count from public.session_members where session_id=v_link.session_id and status='accepted' and role='participant';
 if v_s.participant_limit is not null and v_count>=v_s.participant_limit then raise exception 'Gathering full.'; end if;
 insert into public.session_members(session_id,user_id,role,status) values(v_link.session_id,v_user,'participant','accepted')
 on conflict(session_id,user_id) do update set role='participant',status='accepted'
 where public.session_members.role='participant' and public.session_members.status='removed' returning id into v_member;
 if v_member is null then raise exception 'You cannot join this gathering.'; end if;
 update public.session_invite_links set use_count=use_count+1 where id=v_link.id; return v_link.session_id;
end;$function$;

create or replace function public.preview_session_invite_link(p_code text)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_link public.session_invite_links%rowtype; v_s public.sessions%rowtype; v_count integer;
begin
 if p_code is null or p_code !~ '^[a-z0-9]{10}$' then return jsonb_build_object('state','invalid'); end if;
 select * into v_link from public.session_invite_links where token_hash=encode(extensions.digest(trim(p_code),'sha256'),'hex');
 if not found then return jsonb_build_object('state','invalid'); end if;
 if v_link.revoked_at is not null then return jsonb_build_object('state','revoked'); end if;
 if v_link.expires_at is not null and v_link.expires_at<=now() then return jsonb_build_object('state','expired'); end if;
 if v_link.max_uses is not null and v_link.use_count>=v_link.max_uses then return jsonb_build_object('state','limit_reached'); end if;
 select * into v_s from public.sessions where id=v_link.session_id;
 if not found or v_s.is_draft or v_s.status not in ('scheduled','live') then return jsonb_build_object('state','unavailable'); end if;
 select count(*) into v_count from public.session_members where session_id=v_s.id and status='accepted' and role='participant';
 if v_s.participant_limit is not null and v_count>=v_s.participant_limit then return jsonb_build_object('state','full'); end if;
 return jsonb_build_object('state','valid','title',v_s.title,'description',v_s.description,'scheduled_start_at',v_s.scheduled_start_at,'time_zone',v_s.time_zone,'duration_minutes',v_s.duration_minutes,'status',v_s.status,'participants',v_count,'participant_limit',v_s.participant_limit,'waiting_room_enabled',v_s.waiting_room_enabled);
end;$function$;
revoke execute on function public.preview_session_invite_link(text) from anon;
revoke execute on function private.enforce_session_access_limits() from public,anon,authenticated;
