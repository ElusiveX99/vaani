alter table public.session_invite_links add column if not exists short_code text;
create unique index if not exists session_invite_links_short_code_key on public.session_invite_links(short_code) where short_code is not null;
create unique index if not exists session_invite_links_one_active_per_creator on public.session_invite_links(session_id,created_by) where revoked_at is null;

drop policy if exists "Session managers can view invite links" on public.session_invite_links;
create policy "Session managers and creators can view invite links" on public.session_invite_links
for select to authenticated
using (private.can_manage_session(session_id) or (select auth.uid())=created_by);

drop function if exists public.create_session_invite_link(uuid,text,text,timestamptz,integer);
create function public.create_session_invite_link(
 p_session_id uuid,p_short_code text,p_token_hash text,p_expires_at timestamptz default null,p_max_uses integer default null
) returns text language plpgsql security definer set search_path to '' as $$
declare v_user uuid := (select auth.uid()); v_s public.sessions%rowtype; v_allowed boolean:=false; v_code text;
begin
 if v_user is null then raise exception using errcode='42501',message='Authentication required.'; end if;
 select * into v_s from public.sessions where id=p_session_id and status in ('scheduled','live') and not is_draft for update;
 if not found then raise exception 'Gathering unavailable.'; end if;
 if v_s.access_type not in ('community','link') then raise exception using errcode='42501',message='Links unavailable.'; end if;
 if private.can_manage_session(p_session_id) then v_allowed:=true;
 else select exists(select 1 from public.session_members m where m.session_id=p_session_id and m.user_id=v_user and m.role='participant' and m.status='accepted') and v_s.allow_participant_invites into v_allowed;
 end if;
 if not v_allowed then raise exception using errcode='42501',message='You cannot create links.'; end if;
 if p_short_code !~ '^[a-z0-9]{10}$' or p_token_hash is null or char_length(p_token_hash)<>64 or (p_expires_at is not null and p_expires_at<=now()) or (p_max_uses is not null and p_max_uses not between 1 and 500) then raise exception 'Invalid link settings.'; end if;
 select short_code into v_code from public.session_invite_links
 where session_id=p_session_id and created_by=v_user and revoked_at is null
 for update;
 if v_code is not null then
   if exists(select 1 from public.session_invite_links where session_id=p_session_id and created_by=v_user and revoked_at is null and (expires_at is null or expires_at>now()) and (max_uses is null or use_count<max_uses)) then
     return v_code;
   end if;
   update public.session_invite_links set revoked_at=now() where session_id=p_session_id and created_by=v_user and revoked_at is null;
 end if;
 insert into public.session_invite_links(session_id,token_hash,short_code,expires_at,max_uses,created_by)
 values(p_session_id,p_token_hash,p_short_code,p_expires_at,p_max_uses,v_user);
 return p_short_code;
end $$;

create or replace function public.redeem_session_invite_link(p_token text) returns uuid
language plpgsql security definer set search_path to '' as $$
declare v_user uuid:=(select auth.uid()); v_link public.session_invite_links%rowtype; v_s public.sessions%rowtype; v_member uuid; v_status text; v_count integer;
begin
 if v_user is null then raise exception using errcode='42501',message='Authentication required.'; end if;
 if p_token is null or p_token !~ '^[a-z0-9]{10}$' then raise exception 'Invalid token.'; end if;
 select * into v_link from public.session_invite_links where token_hash=encode(extensions.digest(trim(p_token),'sha256'),'hex') for update;
 if not found or v_link.revoked_at is not null or (v_link.expires_at is not null and v_link.expires_at<=now()) or (v_link.max_uses is not null and v_link.use_count>=v_link.max_uses) then raise exception 'Link invalid or expired.'; end if;
 select * into v_s from public.sessions where id=v_link.session_id for update;
 if not found or v_s.status not in ('scheduled','live') or v_s.is_draft then raise exception 'Gathering unavailable.'; end if;
 if v_s.access_type not in ('community','link') then raise exception 'Gathering does not accept links.'; end if;
 select status::text into v_status from public.session_members where session_id=v_link.session_id and user_id=v_user for update;
 if v_status='accepted' then return v_link.session_id; end if;
 select count(*) into v_count from public.session_members where session_id=v_link.session_id and status='accepted';
 if v_s.participant_limit is not null and v_count>=v_s.participant_limit then raise exception 'Gathering full.'; end if;
 insert into public.session_members(session_id,user_id,role,status) values(v_link.session_id,v_user,'participant','accepted')
 on conflict(session_id,user_id) do update set role='participant',status='accepted'
 where public.session_members.role='participant' and public.session_members.status in ('invited','declined','removed')
 returning id into v_member;
 if v_member is null then raise exception 'You cannot join this gathering.'; end if;
 update public.session_invite_links set use_count=use_count+1 where id=v_link.id;
 return v_link.session_id;
end $$;

create or replace function public.preview_session_invite_link(p_code text) returns jsonb
language plpgsql security definer set search_path to '' as $$
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
 select count(*) into v_count from public.session_members where session_id=v_s.id and status='accepted';
 if v_s.participant_limit is not null and v_count>=v_s.participant_limit then return jsonb_build_object('state','full'); end if;
 return jsonb_build_object('state','valid','title',v_s.title,'description',v_s.description,'scheduled_start_at',v_s.scheduled_start_at,'time_zone',v_s.time_zone,'duration_minutes',v_s.duration_minutes,'status',v_s.status,'participants',v_count,'participant_limit',v_s.participant_limit);
end $$;

create or replace function public.revoke_session_invite_link(p_link_id uuid) returns void
language plpgsql security definer set search_path to '' as $$
declare v_link public.session_invite_links%rowtype;
begin
 select * into v_link from public.session_invite_links where id=p_link_id for update;
 if not found or ((select auth.uid()) is distinct from v_link.created_by and not private.can_manage_session(v_link.session_id)) then raise exception 'You cannot revoke this invitation link.'; end if;
 update public.session_invite_links set revoked_at=now() where id=p_link_id and revoked_at is null;
end $$;

create or replace function public.update_published_session_details(
 p_session_id uuid,p_title text,p_description text,p_scheduled_start_at timestamptz,p_time_zone text,p_duration_minutes integer,p_instructions text
) returns void language plpgsql security definer set search_path to '' as $$
begin
 if (select auth.uid()) is null or not private.is_session_organizer(p_session_id) then raise exception using errcode='42501',message='Organizer access required.'; end if;
 perform 1 from public.sessions where id=p_session_id and status='scheduled' and is_draft=false for update;
 if not found then raise exception 'Only published gatherings that have not started can be edited.'; end if;
 if p_title is null or char_length(btrim(p_title)) not between 1 and 120 then raise exception 'Invalid title.'; end if;
 if p_description is not null and char_length(p_description)>2000 then raise exception 'Description too long.'; end if;
 if p_instructions is not null and char_length(p_instructions)>2000 then raise exception 'Instructions too long.'; end if;
 if p_scheduled_start_at is not null and p_scheduled_start_at<=now() then raise exception 'Choose a future start time.'; end if;
 if p_time_zone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=trim(p_time_zone)) then raise exception 'Invalid time zone.'; end if;
 if p_duration_minutes is not null and p_duration_minutes not between 15 and 480 then raise exception 'Invalid duration.'; end if;
 update public.sessions set title=btrim(p_title),description=nullif(btrim(coalesce(p_description,'')),''),scheduled_start_at=p_scheduled_start_at,time_zone=trim(p_time_zone),duration_minutes=p_duration_minutes,instructions=nullif(btrim(coalesce(p_instructions,'')),''),updated_at=now()
 where id=p_session_id and status='scheduled' and is_draft=false;
end $$;

revoke all on function public.create_session_invite_link(uuid,text,text,timestamptz,integer) from public;
revoke all on function public.redeem_session_invite_link(text) from public;
revoke all on function public.preview_session_invite_link(text) from public;
revoke all on function public.revoke_session_invite_link(uuid) from public;
revoke all on function public.update_published_session_details(uuid,text,text,timestamptz,text,integer,text) from public;
grant execute on function public.create_session_invite_link(uuid,text,text,timestamptz,integer) to authenticated;
grant execute on function public.redeem_session_invite_link(text) to authenticated;
grant execute on function public.preview_session_invite_link(text) to anon,authenticated;
grant execute on function public.revoke_session_invite_link(uuid) to authenticated;
grant execute on function public.update_published_session_details(uuid,text,text,timestamptz,text,integer,text) to authenticated;
