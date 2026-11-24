create or replace function public.update_session_draft(
  p_session_id uuid,
  p_title text,
  p_description text,
  p_scheduled_start_at timestamptz,
  p_time_zone text
)
returns void
language plpgsql
security definer
set search_path=''
as $function$
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required.';
  end if;
  if not private.is_session_organizer(p_session_id) then
    raise exception using errcode='42501', message='Only the organizer can edit this draft.';
  end if;
  update public.sessions
  set title=btrim(p_title),
      description=nullif(btrim(p_description),''),
      scheduled_start_at=p_scheduled_start_at,
      time_zone=p_time_zone,
      updated_at=now()
  where id=p_session_id and is_draft=true and status='scheduled'
    and created_by=auth.uid()
    and char_length(btrim(p_title)) between 1 and 120
    and (p_description is null or char_length(p_description)<=2000)
    and p_time_zone is not null and char_length(p_time_zone) between 1 and 80;
  if not found then
    raise exception 'Draft not found or draft details are invalid.';
  end if;
end;
$function$;

revoke all on function public.update_session_draft(uuid,text,text,timestamptz,text) from public,anon;
grant execute on function public.update_session_draft(uuid,text,text,timestamptz,text) to authenticated;
