drop trigger if exists session_invitations_notify on public.session_invitations;
drop trigger if exists session_member_invitation_response_notify on public.session_members;
drop trigger if exists session_access_limit_trigger on public.session_members;
drop function if exists public.notify_member_invitation_response();
drop function if exists public.respond_to_session_invitation(uuid,boolean);
drop function if exists public.invite_user_to_session(uuid,text);
drop function if exists public.invite_session_member(uuid,uuid);
drop function if exists public.revoke_session_invitation(uuid,uuid);
drop policy if exists "Users can view their invitations" on public.session_invitations;
drop table if exists public.session_invitations cascade;

create or replace function public.notify_gathering_changes()
returns trigger language plpgsql security definer set search_path to ''
as $function$
begin
 if tg_table_name='session_join_requests' then
  if new.status::text='pending' and (tg_op='INSERT' or old.status::text is distinct from new.status::text) then
   insert into public.session_notifications(user_id,session_id,type,title,body)
   select user_id,new.session_id,'join_request_received','New join request','A member has requested to join your gathering.'
   from public.session_members where session_id=new.session_id and role in ('organizer','in_charge','admin') and status='accepted';
  elsif tg_op='UPDATE' and old.status::text='pending' and new.status::text='cancelled' then
   insert into public.session_notifications(user_id,session_id,type,title,body)
   select user_id,new.session_id,'join_request_cancelled','Join request cancelled','A member cancelled their request to join your gathering.'
   from public.session_members where session_id=new.session_id and role in ('organizer','in_charge','admin') and status='accepted';
  end if;
 elsif tg_table_name='sessions' and tg_op='UPDATE' then
  if old.scheduled_start_at is distinct from new.scheduled_start_at then perform public.notify_session_members(new.id,'schedule_changed','Gathering rescheduled','The gathering schedule has changed.',new.created_by); end if;
  if old.status::text is distinct from new.status::text and new.status::text in ('live','ended','cancelled','scheduled') then
   perform public.notify_session_members(new.id,case when new.status::text='scheduled' and old.status::text='cancelled' then 'session_resumed' else 'status_changed' end,
   case when new.status::text='scheduled' and old.status::text='cancelled' then 'Gathering resumed' else 'Gathering status updated' end,
   case new.status::text when 'live' then 'The gathering has started.' when 'ended' then 'The gathering has ended.' when 'cancelled' then 'The gathering was cancelled.' else 'The organizer resumed this gathering.' end,new.created_by);
  end if;
 end if; return new;
end;
$function$;

delete from public.session_notifications where type in ('invitation_received','invitation_response');

drop policy if exists "Users can view relevant session memberships" on public.session_members;
alter table public.session_members drop constraint if exists organizer_must_be_accepted;
alter table public.session_members alter column status drop default;
update public.session_members set status='removed' where status::text in ('invited','declined');
alter table public.session_members alter column status type text using status::text;
drop type public.session_member_status;
alter table public.session_members alter column status set default 'accepted';
alter table public.session_members add constraint session_members_status_check check (status in ('accepted','removed'));
alter table public.session_members add constraint organizer_must_be_accepted check (role <> 'organizer' or status='accepted');
create policy "Users can view relevant session memberships" on public.session_members for select to authenticated
using (user_id=(select auth.uid()) or (status='accepted' and private.is_accepted_member(session_id)) or private.can_manage_session(session_id));
create trigger session_access_limit_trigger before insert or update of status on public.session_members for each row execute function private.enforce_session_access_limits();

create or replace function private.can_view_session(p_session_id uuid)
returns boolean language sql stable security definer set search_path to ''
as $function$
 select exists(select 1 from public.sessions s where s.id=p_session_id and (not s.is_draft or s.created_by=(select auth.uid()))
 and (s.access_type='community' or exists(select 1 from public.session_members m where m.session_id=s.id and m.user_id=(select auth.uid()) and m.status='accepted')));
$function$;

create or replace function public.request_session_join(p_session_id uuid)
returns uuid language plpgsql security definer set search_path to ''
as $function$
declare v_user uuid := (select auth.uid()); v_waiting boolean; v_limit integer; v_count integer; v_id uuid;
begin
 if v_user is null then raise exception 'Authentication required.'; end if;
 select waiting_room_enabled,participant_limit into v_waiting,v_limit from public.sessions where id=p_session_id and status in ('scheduled','live') and not is_draft and access_type='community' for update;
 if not found then raise exception 'Gathering is unavailable or requires an invitation.'; end if;
 if exists(select 1 from public.session_members where session_id=p_session_id and user_id=v_user and status='accepted') then return null; end if;
 select count(*) into v_count from public.session_members where session_id=p_session_id and status='accepted';
 if v_limit is not null and v_count>=v_limit then raise exception 'This gathering is full.'; end if;
 if not v_waiting then
  insert into public.session_members(session_id,user_id,role,status) values(p_session_id,v_user,'participant','accepted')
  on conflict(session_id,user_id) do update set status='accepted' where public.session_members.role='participant' and public.session_members.status='removed' returning id into v_id;
  if v_id is null then raise exception 'You cannot join this gathering.'; end if; return v_id;
 end if;
 insert into public.session_join_requests(session_id,user_id,status) values(p_session_id,v_user,'pending')
 on conflict(session_id,user_id) do update set status='pending',responded_at=null where public.session_join_requests.status in ('rejected','cancelled') returning id into v_id;
 if v_id is null then select id into v_id from public.session_join_requests where session_id=p_session_id and user_id=v_user; end if; return v_id;
end;
$function$;

create or replace function public.approve_session_join_request(p_request_id uuid)
returns void language plpgsql security definer set search_path to ''
as $function$
declare v_session uuid; v_user uuid; v_limit integer; v_count integer;
begin
 select session_id,user_id into v_session,v_user from public.session_join_requests where id=p_request_id and status='pending';
 if not found then raise exception 'Join request is unavailable.'; end if;
 if not private.can_manage_session(v_session) then raise exception 'You cannot manage this gathering.'; end if;
 perform 1 from public.sessions where id=v_session and status in ('scheduled','live') for update;
 if not found then raise exception 'This gathering is no longer accepting members.'; end if;
 select participant_limit into v_limit from public.sessions where id=v_session;
 select count(*) into v_count from public.session_members where session_id=v_session and status='accepted';
 if v_limit is not null and v_count>=v_limit then raise exception 'The gathering is full.'; end if;
 insert into public.session_members(session_id,user_id,role,status) values(v_session,v_user,'participant','accepted')
 on conflict(session_id,user_id) do update set status='accepted' where public.session_members.role='participant' and public.session_members.status='removed';
 if not found and not exists(select 1 from public.session_members where session_id=v_session and user_id=v_user and status='accepted') then raise exception 'This member cannot be added to the gathering.'; end if;
 update public.session_join_requests set status='approved',responded_at=now() where id=p_request_id;
 insert into public.session_notifications(user_id,session_id,type,title,body) values(v_user,v_session,'join_request_approved','Join request approved','Your request to join this gathering was approved.');
end;
$function$;

create or replace function public.redeem_session_invite_link(p_token text)
returns uuid language plpgsql security definer set search_path to ''
as $function$
declare v_user uuid := (select auth.uid()); v_link public.session_invite_links%rowtype; v_s public.sessions%rowtype; v_member uuid; v_request uuid; v_status text; v_count integer;
begin
 if v_user is null then raise exception using errcode='42501',message='Authentication required.'; end if;
 if p_token is null or p_token !~ '^[a-z0-9]{10}$' then raise exception 'Invalid token.'; end if;
 select * into v_link from public.session_invite_links where token_hash=encode(extensions.digest(trim(p_token),'sha256'),'hex') for update;
 if not found or v_link.revoked_at is not null or (v_link.expires_at is not null and v_link.expires_at<=now()) or (v_link.max_uses is not null and v_link.use_count>=v_link.max_uses) then raise exception 'Link invalid or expired.'; end if;
 select * into v_s from public.sessions where id=v_link.session_id for update;
 if not found or v_s.status not in ('scheduled','live') or v_s.is_draft then raise exception 'Gathering unavailable.'; end if;
 if v_s.access_type not in ('community','link') then raise exception 'Gathering does not accept links.'; end if;
 select status into v_status from public.session_members where session_id=v_link.session_id and user_id=v_user for update;
 if v_status='accepted' then return v_link.session_id; end if;
 if v_s.waiting_room_enabled then
  select id into v_request from public.session_join_requests where session_id=v_link.session_id and user_id=v_user and status='pending' for update;
  if v_request is not null then return v_link.session_id; end if;
  insert into public.session_join_requests(session_id,user_id,status) values(v_link.session_id,v_user,'pending')
  on conflict(session_id,user_id) do update set status='pending',responded_at=null,created_at=pg_catalog.now() where public.session_join_requests.status in ('rejected','cancelled') returning id into v_request;
  if v_request is null then raise exception 'A join request is already active.'; end if;
  update public.session_invite_links set use_count=use_count+1 where id=v_link.id; return v_link.session_id;
 end if;
 select count(*) into v_count from public.session_members where session_id=v_link.session_id and status='accepted';
 if v_s.participant_limit is not null and v_count>=v_s.participant_limit then raise exception 'Gathering full.'; end if;
 insert into public.session_members(session_id,user_id,role,status) values(v_link.session_id,v_user,'participant','accepted')
 on conflict(session_id,user_id) do update set role='participant',status='accepted' where public.session_members.role='participant' and public.session_members.status='removed' returning id into v_member;
 if v_member is null then raise exception 'You cannot join this gathering.'; end if;
 update public.session_invite_links set use_count=use_count+1 where id=v_link.id; return v_link.session_id;
end;
$function$;
