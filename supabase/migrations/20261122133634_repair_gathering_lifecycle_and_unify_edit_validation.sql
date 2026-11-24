
create or replace function public.notify_gathering_changes()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if tg_table_name='session_invitations' then
    if new.status::text='pending'
       and (tg_op='INSERT' or old.status::text is distinct from new.status::text)
       and new.user_id is not null then
      insert into public.session_notifications(user_id,session_id,type,title,body)
      values(new.user_id,new.session_id,'invitation_received','Gathering invitation',
        'You have been invited to a gathering on Vaani.');
    end if;
  elsif tg_table_name='session_join_requests' then
    if new.status::text='pending'
       and (tg_op='INSERT' or old.status::text is distinct from new.status::text) then
      insert into public.session_notifications(user_id,session_id,type,title,body)
      select user_id,new.session_id,'join_request_received','New join request',
        'A member has requested to join your gathering.'
      from public.session_members
      where session_id=new.session_id and role in ('organizer','in_charge','admin')
        and status='accepted';
    elsif tg_op='UPDATE' and old.status::text='pending' and new.status::text='cancelled' then
      insert into public.session_notifications(user_id,session_id,type,title,body)
      select user_id,new.session_id,'join_request_cancelled','Join request cancelled',
        'A member cancelled their request to join your gathering.'
      from public.session_members
      where session_id=new.session_id and role in ('organizer','in_charge','admin')
        and status='accepted';
    end if;
  elsif tg_table_name='sessions' and tg_op='UPDATE' then
    if old.scheduled_start_at is distinct from new.scheduled_start_at then
      perform public.notify_session_members(new.id,'schedule_changed',
        'Gathering rescheduled','The gathering schedule has changed.',new.created_by);
    end if;
    if old.status::text is distinct from new.status::text
       and new.status::text in ('live','ended','cancelled','scheduled') then
      perform public.notify_session_members(new.id,
        case when new.status::text='scheduled' and old.status::text='cancelled'
          then 'session_resumed' else 'status_changed' end,
        case when new.status::text='scheduled' and old.status::text='cancelled'
          then 'Gathering resumed' else 'Gathering status updated' end,
        case new.status::text
          when 'live' then 'The gathering has started.'
          when 'ended' then 'The gathering has ended.'
          when 'cancelled' then 'The gathering was cancelled.'
          else 'The organizer resumed this gathering.'
        end,
        new.created_by);
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.update_session_details(
  p_session_id uuid,
  p_title text,
  p_description text,
  p_access_type public.session_access_type,
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
set search_path=''
as $function$
declare
  v_draft boolean;
begin
  if auth.uid() is null or not private.is_session_organizer(p_session_id) then
    raise exception using errcode='42501', message='Only the organizer can edit this gathering.';
  end if;
  select is_draft into v_draft from public.sessions
    where id=p_session_id and status='scheduled' for update;
  if not found then
    raise exception 'Only scheduled gatherings and drafts can be edited.';
  end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 120 then
    raise exception using errcode='22023', message='Invalid title.';
  end if;
  if p_description is not null and char_length(p_description)>2000 then
    raise exception using errcode='22023', message='Invalid description.';
  end if;
  if p_instructions is not null and char_length(p_instructions)>2000 then
    raise exception using errcode='22023', message='Invalid instructions.';
  end if;
  if p_scheduled_start_at is not null and not v_draft and p_scheduled_start_at<=now() then
    raise exception using errcode='22023', message='Choose a future start time.';
  end if;
  if p_time_zone is null or not exists(
    select 1 from pg_catalog.pg_timezone_names where name=trim(p_time_zone)
  ) then
    raise exception using errcode='22023', message='Invalid time zone.';
  end if;
  if p_duration_minutes is not null and p_duration_minutes not between 15 and 480 then
    raise exception using errcode='22023', message='Invalid duration.';
  end if;
  if p_participant_limit is not null and p_participant_limit not between 2 and 500 then
    raise exception using errcode='22023', message='Invalid participant limit.';
  end if;
  if p_recurrence_rule is not null then
    if p_recurrence_rule not in ('DAILY','WEEKLY','BIWEEKLY','EVERY_3_WEEKS','EVERY_4_WEEKS','MONTHLY')
      or p_scheduled_start_at is null or p_recurrence_until is null
      or p_recurrence_until<=p_scheduled_start_at
      or p_recurrence_until>p_scheduled_start_at+interval '366 days' then
      raise exception using errcode='22023', message='Invalid repeat schedule.';
    end if;
  elsif p_recurrence_until is not null then
    raise exception using errcode='22023', message='A repeat end date requires a repeat schedule.';
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
      updated_at=now()
  where id=p_session_id and status='scheduled';
  if not found then raise exception 'Gathering could not be updated.'; end if;
end;
$function$;

revoke all on function public.update_session_details(uuid,text,text,public.session_access_type,timestamptz,text,integer,integer,boolean,boolean,text,text,timestamptz) from public,anon;
grant execute on function public.update_session_details(uuid,text,text,public.session_access_type,timestamptz,text,integer,integer,boolean,boolean,text,text,timestamptz) to authenticated;
