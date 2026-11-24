-- Simplify invitation links: permanent reusable codes for every accepted participant.
-- Keep revocation as an emergency control and retain legacy 32-character URLs already issued.
begin;

-- Stop generating new 32-character public slugs. Existing values remain usable by the
-- compatibility branch in /g/[slug]; new invitations use only 10-character codes.
alter table public.sessions
  alter column public_slug drop default,
  alter column public_slug drop not null;

-- Remove the participant-invite opt-in from the schema and every write path.
-- The recurrence trigger explicitly listed this column in its UPDATE OF clause.
drop trigger if exists sessions_expand_recurrence on public.sessions;
drop function if exists public.create_gathering(text,text,text,boolean,timestamptz,timestamptz,text,integer,text,integer,boolean,boolean,text,timestamptz);
drop function if exists public.update_session_details(uuid,text,text,text,timestamptz,text,integer,integer,boolean,boolean,text,text,timestamptz);
drop function if exists public.publish_session_draft_with_details(uuid,text,text,text,timestamptz,text,integer,integer,boolean,boolean,text,text,timestamptz);

create or replace function public.create_gathering(
  p_title text, p_description text, p_access_type text, p_is_draft boolean,
  p_published_at timestamptz, p_scheduled_start_at timestamptz, p_time_zone text,
  p_duration_minutes integer, p_instructions text, p_participant_limit integer,
  p_waiting_room_enabled boolean, p_recurrence_rule text, p_recurrence_until timestamptz
)
returns uuid language plpgsql security definer set search_path to ''
as $function$
declare v_user_id uuid := auth.uid(); v_session_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode='42501', message='Authentication is required.';
  end if;
  insert into public.sessions (
    title,description,access_type,is_draft,published_at,scheduled_start_at,time_zone,
    duration_minutes,instructions,participant_limit,waiting_room_enabled,
    recurrence_rule,recurrence_until,created_by
  )
  values (
    p_title,p_description,p_access_type,p_is_draft,p_published_at,p_scheduled_start_at,
    p_time_zone,p_duration_minutes,p_instructions,p_participant_limit,
    coalesce(p_waiting_room_enabled,false),p_recurrence_rule,p_recurrence_until,v_user_id
  )
  returning id into v_session_id;
  return v_session_id;
end;
$function$;
revoke all on function public.create_gathering(text,text,text,boolean,timestamptz,timestamptz,text,integer,text,integer,boolean,text,timestamptz) from public,anon;
grant execute on function public.create_gathering(text,text,text,boolean,timestamptz,timestamptz,text,integer,text,integer,boolean,text,timestamptz) to authenticated;

create or replace function public.update_session_details(
  p_session_id uuid,p_title text,p_description text,p_access_type text,
  p_scheduled_start_at timestamptz,p_time_zone text,p_duration_minutes integer,
  p_participant_limit integer,p_waiting_room_enabled boolean,p_instructions text,
  p_recurrence_rule text default null,p_recurrence_until timestamptz default null
)
returns void language plpgsql security definer set search_path to ''
as $function$
declare v_draft boolean;
begin
  if auth.uid() is null or not private.is_session_organizer(p_session_id) then
    raise exception using errcode='42501',message='Organizer access required.';
  end if;
  select is_draft into v_draft from public.sessions where id=p_session_id and status='scheduled' for update;
  if not found then raise exception 'Only scheduled drafts can be edited.'; end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 120 or p_access_type not in ('community','link') then raise exception 'Invalid gathering details.'; end if;
  if p_description is not null and char_length(p_description)>2000 then raise exception 'Description too long.'; end if;
  if p_instructions is not null and char_length(p_instructions)>2000 then raise exception 'Instructions too long.'; end if;
  if p_scheduled_start_at is not null and not v_draft and p_scheduled_start_at<=now() then raise exception 'Choose a future start time.'; end if;
  if p_time_zone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=trim(p_time_zone)) then raise exception 'Invalid time zone.'; end if;
  if p_duration_minutes is not null and p_duration_minutes not between 15 and 480 then raise exception 'Invalid duration.'; end if;
  if p_participant_limit is not null and p_participant_limit not between 2 and 500 then raise exception 'Invalid participant limit.'; end if;
  if p_recurrence_rule is not null and (p_recurrence_rule not in ('DAILY','WEEKLY','BIWEEKLY','EVERY_3_WEEKS','EVERY_4_WEEKS','MONTHLY') or p_scheduled_start_at is null or p_recurrence_until is null or p_recurrence_until<=p_scheduled_start_at or p_recurrence_until>p_scheduled_start_at+interval '366 days') then raise exception 'Invalid recurrence.'; end if;
  if p_recurrence_rule is null and p_recurrence_until is not null then raise exception 'Repeat end date requires a repeat schedule.'; end if;
  update public.sessions
  set title=btrim(p_title),description=nullif(btrim(coalesce(p_description,'')),''),
      access_type=p_access_type,scheduled_start_at=p_scheduled_start_at,
      time_zone=trim(p_time_zone),duration_minutes=p_duration_minutes,
      participant_limit=p_participant_limit,waiting_room_enabled=coalesce(p_waiting_room_enabled,false),
      instructions=nullif(btrim(coalesce(p_instructions,'')),''),
      recurrence_rule=p_recurrence_rule,recurrence_until=p_recurrence_until,updated_at=now()
  where id=p_session_id and status='scheduled' and is_draft=true;
  if not found then raise exception 'Draft could not be updated.'; end if;
end;
$function$;
revoke all on function public.update_session_details(uuid,text,text,text,timestamptz,text,integer,integer,boolean,text,text,timestamptz) from public,anon;
grant execute on function public.update_session_details(uuid,text,text,text,timestamptz,text,integer,integer,boolean,text,text,timestamptz) to authenticated;

create or replace function public.publish_session_draft_with_details(
  p_session_id uuid,p_title text,p_description text,p_access_type text,
  p_scheduled_start_at timestamptz,p_time_zone text,p_duration_minutes integer,
  p_participant_limit integer,p_waiting_room_enabled boolean,p_instructions text,
  p_recurrence_rule text default null,p_recurrence_until timestamptz default null
)
returns void language plpgsql security definer set search_path to ''
as $function$
declare v_now timestamptz := pg_catalog.now();
begin
  if auth.uid() is null or not private.is_session_organizer(p_session_id) then
    raise exception using errcode='42501',message='Organizer access required.';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 120 or p_access_type not in ('community','link') then
    raise exception using errcode='22023',message='Invalid gathering details.';
  end if;
  if p_description is not null and char_length(p_description)>2000 then raise exception using errcode='22023',message='Description too long.'; end if;
  if p_instructions is not null and char_length(p_instructions)>2000 then raise exception using errcode='22023',message='Instructions too long.'; end if;
  if p_scheduled_start_at is null or p_scheduled_start_at<=v_now then raise exception using errcode='22023',message='Choose a future start time.'; end if;
  if p_time_zone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=trim(p_time_zone)) then raise exception using errcode='22023',message='Invalid time zone.'; end if;
  if p_duration_minutes is not null and p_duration_minutes not between 15 and 480 then raise exception using errcode='22023',message='Invalid duration.'; end if;
  if p_participant_limit is not null and p_participant_limit not between 2 and 500 then raise exception using errcode='22023',message='Invalid participant limit.'; end if;
  if p_recurrence_rule is not null and (p_recurrence_rule not in ('DAILY','WEEKLY','BIWEEKLY','EVERY_3_WEEKS','EVERY_4_WEEKS','MONTHLY') or p_recurrence_until is null or p_recurrence_until<=p_scheduled_start_at or p_recurrence_until>p_scheduled_start_at+interval '366 days') then raise exception using errcode='22023',message='Invalid recurrence.'; end if;
  if p_recurrence_rule is null and p_recurrence_until is not null then raise exception using errcode='22023',message='Repeat end date requires a repeat schedule.'; end if;
  update public.sessions
  set title=btrim(p_title),description=nullif(btrim(coalesce(p_description,'')),''),
      access_type=p_access_type,scheduled_start_at=p_scheduled_start_at,
      time_zone=trim(p_time_zone),duration_minutes=p_duration_minutes,
      participant_limit=p_participant_limit,waiting_room_enabled=coalesce(p_waiting_room_enabled,false),
      instructions=nullif(btrim(coalesce(p_instructions,'')),''),
      recurrence_rule=p_recurrence_rule,recurrence_until=p_recurrence_until,
      is_draft=false,published_at=v_now,status='scheduled',updated_at=v_now
  where id=p_session_id and created_by=auth.uid() and is_draft=true and status='scheduled';
  if not found then raise exception using errcode='22023',message='Draft not found or cannot be published.'; end if;
end;
$function$;
revoke all on function public.publish_session_draft_with_details(uuid,text,text,text,timestamptz,text,integer,integer,boolean,text,text,timestamptz) from public,anon;
grant execute on function public.publish_session_draft_with_details(uuid,text,text,text,timestamptz,text,integer,integer,boolean,text,text,timestamptz) to authenticated;

create or replace function public.expand_session_recurrence()
returns trigger language plpgsql security definer set search_path to ''
as $function$
declare v_step interval; v_next timestamptz; v_index integer:=0; v_limit integer:=52;
begin
  if new.recurrence_parent_id is not null then return new; end if;
  if new.recurrence_rule is null or new.recurrence_until is null or new.scheduled_start_at is null or new.is_draft or new.status<>'scheduled' then
    update public.sessions set status='cancelled' where recurrence_parent_id=new.id and status='scheduled' and scheduled_start_at>now();
    return new;
  end if;
  v_step:=case new.recurrence_rule when 'DAILY' then interval '1 day' when 'WEEKLY' then interval '7 days' when 'BIWEEKLY' then interval '14 days' when 'EVERY_3_WEEKS' then interval '21 days' when 'EVERY_4_WEEKS' then interval '28 days' when 'MONTHLY' then interval '1 month' else null end;
  if v_step is null then raise exception 'Unsupported recurrence rule.'; end if;
  if new.recurrence_rule='DAILY' then v_limit:=366; end if;
  delete from public.sessions s where s.recurrence_parent_id=new.id and s.status='scheduled' and s.scheduled_start_at>now()
    and (s.scheduled_start_at>new.recurrence_until or not exists(select 1 from public.session_members m where m.session_id=s.id and m.role<>'organizer'));
  v_next:=new.scheduled_start_at+v_step;
  while v_next<=new.recurrence_until and v_index<v_limit loop
    insert into public.sessions(title,description,access_type,status,scheduled_start_at,created_by,is_draft,published_at,time_zone,duration_minutes,instructions,participant_limit,waiting_room_enabled,recurrence_parent_id)
    values(new.title,new.description,new.access_type,'scheduled',v_next,new.created_by,false,now(),new.time_zone,new.duration_minutes,new.instructions,new.participant_limit,new.waiting_room_enabled,new.id)
    on conflict (recurrence_parent_id,scheduled_start_at) where recurrence_parent_id is not null
    do update set title=excluded.title,description=excluded.description,access_type=excluded.access_type,
      status=case when public.sessions.status='cancelled' and public.sessions.scheduled_start_at>now() then 'scheduled'::public.session_status else public.sessions.status end,
      time_zone=excluded.time_zone,duration_minutes=excluded.duration_minutes,instructions=excluded.instructions,
      participant_limit=excluded.participant_limit,waiting_room_enabled=excluded.waiting_room_enabled
    where public.sessions.status in ('scheduled','cancelled');
    v_next:=v_next+v_step; v_index:=v_index+1;
  end loop;
  return new;
end;
$function$;

alter table public.sessions drop column if exists allow_participant_invites;

create trigger sessions_expand_recurrence
after insert or update of recurrence_rule, recurrence_until, scheduled_start_at, title, description, access_type, time_zone, duration_minutes, instructions, participant_limit, waiting_room_enabled, is_draft
on public.sessions for each row execute function public.expand_session_recurrence();

-- These settings are no longer part of a reusable invitation. Revocation remains.
alter table public.session_invite_links
  drop constraint if exists session_invite_links_label_check,
  drop constraint if exists session_invite_links_max_uses_check,
  drop column if exists label,
  drop column if exists max_uses,
  drop column if exists use_count,
  drop column if exists expires_at;

drop function if exists public.create_session_invite_link(uuid,text,text,timestamptz,integer);
create or replace function public.create_session_invite_link(p_session_id uuid,p_short_code text,p_token_hash text)
returns text language plpgsql security definer set search_path to ''
as $function$
declare v_user uuid := (select auth.uid()); v_s public.sessions%rowtype; v_code text;
begin
  if v_user is null then raise exception using errcode='42501',message='Authentication required.'; end if;
  select * into v_s from public.sessions where id=p_session_id and status::text in ('scheduled','live') and not is_draft for update;
  if not found then raise exception 'Gathering unavailable.'; end if;
  if v_s.access_type not in ('community','link') then raise exception using errcode='42501',message='Links unavailable.'; end if;
  if not private.can_manage_session(p_session_id) and not exists (
    select 1 from public.session_members m where m.session_id=p_session_id and m.user_id=v_user
      and m.role='participant' and m.status='accepted'
  ) then raise exception using errcode='42501',message='You cannot create links.'; end if;
  if p_short_code is null or p_short_code !~ '^[a-z0-9]{10}$' or p_token_hash is null
     or p_token_hash<>encode(extensions.digest(p_short_code,'sha256'),'hex') then
    raise exception 'Invalid invitation code.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_session_id::text||':'||v_user::text,0));
  select short_code into v_code from public.session_invite_links
    where session_id=p_session_id and created_by=v_user and revoked_at is null for update;
  if v_code is not null then return v_code; end if;
  insert into public.session_invite_links(session_id,token_hash,short_code,created_by)
    values(p_session_id,p_token_hash,p_short_code,v_user);
  return p_short_code;
end;
$function$;
revoke all on function public.create_session_invite_link(uuid,text,text) from public,anon;
grant execute on function public.create_session_invite_link(uuid,text,text) to authenticated;

create or replace function public.preview_session_invite_link(p_code text)
returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_link public.session_invite_links%rowtype; v_s public.sessions%rowtype; v_count integer; v_state text;
begin
  if p_code is null or p_code !~ '^[a-z0-9]{10}$' then return jsonb_build_object('state','invalid'); end if;
  select * into v_link from public.session_invite_links where token_hash=encode(extensions.digest(trim(p_code),'sha256'),'hex');
  if not found then return jsonb_build_object('state','invalid'); end if;
  if v_link.revoked_at is not null then return jsonb_build_object('state','revoked'); end if;
  select * into v_s from public.sessions where id=v_link.session_id;
  if not found or v_s.is_draft or v_s.status::text not in ('scheduled','live') then return jsonb_build_object('state','unavailable'); end if;
  select count(*)::integer into v_count from public.session_members where session_id=v_s.id and status='accepted' and role='participant';
  v_state:=case when v_s.participant_limit is not null and v_count>=v_s.participant_limit then 'full' else 'valid' end;
  return jsonb_build_object('state',v_state,'title',v_s.title,'description',v_s.description,
    'scheduled_start_at',v_s.scheduled_start_at,'time_zone',v_s.time_zone,'duration_minutes',v_s.duration_minutes,
    'status',v_s.status::text,'participants',v_count,'participant_limit',v_s.participant_limit,
    'waiting_room_enabled',v_s.waiting_room_enabled);
end;
$function$;
revoke all on function public.preview_session_invite_link(text) from public;
grant execute on function public.preview_session_invite_link(text) to anon,authenticated;

create or replace function public.redeem_session_invite_link(p_token text)
returns uuid language plpgsql security definer set search_path to ''
as $function$
declare v_user uuid := (select auth.uid()); v_link public.session_invite_links%rowtype;
  v_s public.sessions%rowtype; v_member uuid; v_request uuid; v_status text; v_count integer;
begin
  if v_user is null then raise exception using errcode='42501',message='Authentication required.'; end if;
  if p_token is null or p_token !~ '^[a-z0-9]{10}$' then raise exception 'Invalid token.'; end if;
  select * into v_link from public.session_invite_links
    where token_hash=encode(extensions.digest(trim(p_token),'sha256'),'hex') for update;
  if not found or v_link.revoked_at is not null then raise exception 'Invitation link is invalid or revoked.'; end if;
  select * into v_s from public.sessions where id=v_link.session_id for update;
  if not found or v_s.status not in ('scheduled','live') or v_s.is_draft then raise exception 'Gathering unavailable.'; end if;
  if v_s.access_type not in ('community','link') then raise exception 'Gathering does not accept links.'; end if;
  select status into v_status from public.session_members where session_id=v_link.session_id and user_id=v_user for update;
  if v_status='accepted' then return v_link.session_id; end if;
  select id into v_request from public.session_join_requests where session_id=v_link.session_id and user_id=v_user and status='pending' for update;
  if v_request is not null then return v_link.session_id; end if;
  select count(*) into v_count from public.session_members where session_id=v_link.session_id and status='accepted' and role='participant';
  if v_s.participant_limit is not null and v_count>=v_s.participant_limit then raise exception 'Gathering full.'; end if;
  if v_s.waiting_room_enabled then
    insert into public.session_join_requests(session_id,user_id,status) values(v_link.session_id,v_user,'pending')
    on conflict(session_id,user_id) do update set status='pending',responded_at=null,created_at=pg_catalog.now()
      where public.session_join_requests.status in ('rejected','cancelled')
    returning id into v_request;
    if v_request is null then raise exception 'A join request is already active.'; end if;
    return v_link.session_id;
  end if;
  insert into public.session_members(session_id,user_id,role,status) values(v_link.session_id,v_user,'participant','accepted')
  on conflict(session_id,user_id) do update set role='participant',status='accepted'
    where public.session_members.role='participant' and public.session_members.status='removed'
  returning id into v_member;
  if v_member is null then raise exception 'You cannot join this gathering.'; end if;
  return v_link.session_id;
end;
$function$;
revoke all on function public.redeem_session_invite_link(text) from public,anon;
grant execute on function public.redeem_session_invite_link(text) to authenticated;

-- Remove the duplicate equivalent SELECT policy.
drop policy if exists "Session managers and link creators can view invite links" on public.session_invite_links;

commit;
