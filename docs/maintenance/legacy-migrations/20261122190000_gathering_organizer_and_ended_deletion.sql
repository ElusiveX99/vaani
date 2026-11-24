-- Ensure every gathering creator is represented as its accepted organizer.
create or replace function public.create_gathering(
  p_title text,p_description text,p_access_type public.session_access_type,
  p_is_draft boolean,p_published_at timestamptz,p_scheduled_start_at timestamptz,
  p_time_zone text,p_duration_minutes integer,p_instructions text,
  p_participant_limit integer,p_waiting_room_enabled boolean,
  p_allow_participant_invites boolean,p_recurrence_rule text,p_recurrence_until timestamptz
)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_user_id uuid := auth.uid(); v_session_id uuid;
begin
  if v_user_id is null then raise exception using errcode='42501',message='Authentication is required.'; end if;
  insert into public.sessions(title,description,access_type,is_draft,published_at,scheduled_start_at,time_zone,duration_minutes,instructions,participant_limit,waiting_room_enabled,allow_participant_invites,recurrence_rule,recurrence_until,created_by)
  values(p_title,p_description,p_access_type,p_is_draft,p_published_at,p_scheduled_start_at,p_time_zone,p_duration_minutes,p_instructions,p_participant_limit,coalesce(p_waiting_room_enabled,false),coalesce(p_allow_participant_invites,false),p_recurrence_rule,p_recurrence_until,v_user_id)
  returning id into v_session_id;
  insert into public.session_members(session_id,user_id,role,status)
  values(v_session_id,v_user_id,'organizer','accepted');
  return v_session_id;
end;$function$;

update public.session_members m
set role='organizer',status='accepted',updated_at=now()
from public.sessions s
where m.session_id=s.id and m.user_id=s.created_by
  and not exists(select 1 from public.session_members other where other.session_id=s.id and other.role='organizer');

insert into public.session_members(session_id,user_id,role,status)
select s.id,s.created_by,'organizer','accepted'
from public.sessions s
where not exists(select 1 from public.session_members m where m.session_id=s.id and m.user_id=s.created_by)
  and not exists(select 1 from public.session_members o where o.session_id=s.id and o.role='organizer')
on conflict(session_id,user_id) do nothing;

create or replace function public.delete_ended_session(p_session_id uuid)
returns void language plpgsql security definer set search_path=''
as $function$
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Authentication required.'; end if;
  if not private.is_session_organizer(p_session_id) then raise exception using errcode='42501',message='Only the organizer can permanently delete this gathering.'; end if;
  delete from public.sessions where id=p_session_id and status='ended' and is_draft=false;
  if not found then raise exception 'Only ended gatherings can be permanently deleted.'; end if;
end;$function$;

revoke all on function public.delete_ended_session(uuid) from public,anon;
grant execute on function public.delete_ended_session(uuid) to authenticated;
