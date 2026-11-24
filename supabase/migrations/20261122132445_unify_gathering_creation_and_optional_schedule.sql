
create or replace function public.create_gathering(
  p_title text,
  p_description text,
  p_access_type public.session_access_type,
  p_is_draft boolean,
  p_published_at timestamptz,
  p_scheduled_start_at timestamptz,
  p_time_zone text,
  p_duration_minutes integer,
  p_instructions text,
  p_participant_limit integer,
  p_waiting_room_enabled boolean,
  p_allow_participant_invites boolean,
  p_recurrence_rule text,
  p_recurrence_until timestamptz
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_now timestamptz := pg_catalog.now();
begin
  if v_user_id is null then
    raise exception using errcode='42501', message='Authentication is required.';
  end if;

  if p_title is null or char_length(btrim(p_title)) not between 1 and 120 then
    raise exception using errcode='22023', message='A title between 1 and 120 characters is required.';
  end if;
  if p_description is not null and char_length(p_description)>2000 then
    raise exception using errcode='22023', message='Description is too long.';
  end if;
  if p_instructions is not null and char_length(p_instructions)>2000 then
    raise exception using errcode='22023', message='Instructions are too long.';
  end if;
  if p_time_zone is null or char_length(p_time_zone) not between 1 and 80
     or not exists(select 1 from pg_catalog.pg_timezone_names z where z.name=p_time_zone) then
    raise exception using errcode='22023', message='Invalid time zone.';
  end if;
  if p_duration_minutes is not null and p_duration_minutes not between 15 and 480 then
    raise exception using errcode='22023', message='Duration must be between 15 and 480 minutes.';
  end if;
  if p_participant_limit is not null and p_participant_limit not between 2 and 500 then
    raise exception using errcode='22023', message='Participant limit must be between 2 and 500.';
  end if;
  if p_scheduled_start_at is not null and not p_is_draft and p_scheduled_start_at<=v_now then
    raise exception using errcode='22023', message='Choose a future start time.';
  end if;
  if p_recurrence_rule is not null then
    if p_recurrence_rule not in ('DAILY','WEEKLY','BIWEEKLY','EVERY_3_WEEKS','EVERY_4_WEEKS','MONTHLY')
       or p_scheduled_start_at is null or p_recurrence_until is null
       or p_recurrence_until<=p_scheduled_start_at
       or p_recurrence_until>p_scheduled_start_at+interval '366 days' then
      raise exception using errcode='22023', message='A recurring gathering needs a start time and a valid end date within one year.';
    end if;
  elsif p_recurrence_until is not null then
    raise exception using errcode='22023', message='A repeat end date requires a repeat schedule.';
  end if;

  insert into public.sessions(
    title,description,access_type,is_draft,published_at,scheduled_start_at,time_zone,
    duration_minutes,instructions,participant_limit,waiting_room_enabled,
    allow_participant_invites,recurrence_rule,recurrence_until,created_by
  )
  values(
    btrim(p_title),nullif(btrim(p_description),''),p_access_type,coalesce(p_is_draft,false),
    case when coalesce(p_is_draft,false) then null else coalesce(p_published_at,v_now) end,
    p_scheduled_start_at,p_time_zone,p_duration_minutes,nullif(btrim(p_instructions),''),
    p_participant_limit,coalesce(p_waiting_room_enabled,false),
    coalesce(p_allow_participant_invites,false),p_recurrence_rule,p_recurrence_until,v_user_id
  )
  returning id into v_session_id;

  -- The on_session_created trigger creates organizer membership and reader state.
  -- Do not insert a second organizer membership here.
  return v_session_id;
end;
$function$;

create or replace function public.publish_session_draft(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_session public.sessions%rowtype;
  v_now timestamptz := pg_catalog.now();
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required.';
  end if;
  if not private.is_session_organizer(p_session_id) then
    raise exception using errcode='42501', message='Only the organizer can publish this gathering.';
  end if;

  select * into v_session
  from public.sessions
  where id=p_session_id and is_draft=true and status='scheduled' and created_by=auth.uid()
  for update;

  if not found then
    raise exception using errcode='22023', message='Draft not found or cannot be published.';
  end if;
  if v_session.scheduled_start_at is not null and v_session.scheduled_start_at<=v_now then
    raise exception using errcode='22023', message='Choose a future start time or clear the date.';
  end if;
  if v_session.recurrence_rule is not null and (
    v_session.scheduled_start_at is null or v_session.recurrence_until is null
    or v_session.recurrence_until<=v_session.scheduled_start_at
    or v_session.recurrence_until>v_session.scheduled_start_at+interval '366 days'
  ) then
    raise exception using errcode='22023', message='A recurring gathering needs a valid future start time and repeat end date.';
  end if;

  update public.sessions
  set is_draft=false,published_at=v_now,status='scheduled',updated_at=v_now
  where id=p_session_id;
end;
$function$;

revoke all on function public.create_gathering(text,text,public.session_access_type,boolean,timestamptz,timestamptz,text,integer,text,integer,boolean,boolean,text,timestamptz) from public,anon;
grant execute on function public.create_gathering(text,text,public.session_access_type,boolean,timestamptz,timestamptz,text,integer,text,integer,boolean,boolean,text,timestamptz) to authenticated;
revoke all on function public.publish_session_draft(uuid) from public,anon;
grant execute on function public.publish_session_draft(uuid) to authenticated;
