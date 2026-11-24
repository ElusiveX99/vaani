-- Publish a draft from the values currently present in its edit form.
-- The publish operation is atomic: it validates and writes the submitted
-- values and changes the draft to a scheduled gathering in one transaction.
create or replace function public.publish_session_draft_with_details(
  p_session_id uuid,
  p_title text,
  p_description text,
  p_access_type text,
  p_scheduled_start_at timestamptz,
  p_time_zone text,
  p_duration_minutes integer,
  p_participant_limit integer,
  p_waiting_room_enabled boolean,
  p_allow_participant_invites boolean,
  p_instructions text,
  p_recurrence_rule text default null,
  p_recurrence_until timestamptz default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_now timestamptz := pg_catalog.now();
begin
  if auth.uid() is null or not private.is_session_organizer(p_session_id) then
    raise exception using errcode='42501', message='Organizer access required.';
  end if;

  if p_title is null or char_length(btrim(p_title)) not between 1 and 120
     or p_access_type not in ('community','link') then
    raise exception using errcode='22023', message='Invalid gathering details.';
  end if;

  if p_description is not null and char_length(p_description) > 2000 then
    raise exception using errcode='22023', message='Description too long.';
  end if;

  if p_instructions is not null and char_length(p_instructions) > 2000 then
    raise exception using errcode='22023', message='Instructions too long.';
  end if;

  if p_scheduled_start_at is null or p_scheduled_start_at <= v_now then
    raise exception using errcode='22023', message='Choose a future start time.';
  end if;

  if p_time_zone is null or not exists (
    select 1 from pg_catalog.pg_timezone_names where name = trim(p_time_zone)
  ) then
    raise exception using errcode='22023', message='Invalid time zone.';
  end if;

  if p_duration_minutes is not null and p_duration_minutes not between 15 and 480 then
    raise exception using errcode='22023', message='Invalid duration.';
  end if;

  if p_participant_limit is not null and p_participant_limit not between 2 and 500 then
    raise exception using errcode='22023', message='Invalid participant limit.';
  end if;

  if p_recurrence_rule is not null and (
    p_recurrence_rule not in ('DAILY','WEEKLY','BIWEEKLY','EVERY_3_WEEKS','EVERY_4_WEEKS','MONTHLY')
    or p_recurrence_until is null
    or p_recurrence_until <= p_scheduled_start_at
    or p_recurrence_until > p_scheduled_start_at + interval '366 days'
  ) then
    raise exception using errcode='22023', message='Invalid recurrence.';
  end if;

  if p_recurrence_rule is null and p_recurrence_until is not null then
    raise exception using errcode='22023', message='Repeat end date requires a repeat schedule.';
  end if;

  update public.sessions
  set title=btrim(p_title),
      description=nullif(btrim(coalesce(p_description,'')),''),
      access_type=p_access_type,
      scheduled_start_at=p_scheduled_start_at,
      time_zone=trim(p_time_zone),
      duration_minutes=p_duration_minutes,
      participant_limit=p_participant_limit,
      waiting_room_enabled=coalesce(p_waiting_room_enabled,false),
      allow_participant_invites=coalesce(p_allow_participant_invites,false),
      instructions=nullif(btrim(coalesce(p_instructions,'')),''),
      recurrence_rule=p_recurrence_rule,
      recurrence_until=p_recurrence_until,
      is_draft=false,
      published_at=v_now,
      status='scheduled',
      updated_at=v_now
  where id=p_session_id
    and created_by=auth.uid()
    and is_draft=true
    and status='scheduled';

  if not found then
    raise exception using errcode='22023', message='Draft not found or cannot be published.';
  end if;
end;
$function$;

revoke execute on function public.publish_session_draft_with_details(uuid,text,text,text,timestamptz,text,integer,integer,boolean,boolean,text,text,timestamptz) from public;
grant execute on function public.publish_session_draft_with_details(uuid,text,text,text,timestamptz,text,integer,integer,boolean,boolean,text,text,timestamptz) to authenticated;
