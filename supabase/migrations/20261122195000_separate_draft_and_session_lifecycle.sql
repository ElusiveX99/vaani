-- Keep draft records out of the scheduled/live lifecycle.
create or replace function public.start_session(p_session_id uuid)
returns void language plpgsql security definer set search_path=''
as $function$
begin
  if (select auth.uid()) is null then raise exception using errcode='42501',message='Authentication required.'; end if;
  if not private.is_session_organizer(p_session_id) then raise exception using errcode='42501',message='Only the organizer can start this gathering.'; end if;
  update public.sessions set status='live',started_at=pg_catalog.now(),ended_at=null,updated_at=pg_catalog.now()
  where id=p_session_id and status='scheduled' and is_draft=false;
  if not found then raise exception 'Only a published scheduled gathering can be started.'; end if;
end;
$function$;

create or replace function public.cancel_session(p_session_id uuid)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_parent uuid;
begin
  if (select auth.uid()) is null then raise exception using errcode='42501',message='Authentication required.'; end if;
  if not private.is_session_organizer(p_session_id) then raise exception using errcode='42501',message='Only the organizer can cancel this gathering.'; end if;
  select recurrence_parent_id into v_parent from public.sessions where id=p_session_id for update;
  if not found then raise exception 'Gathering not found.'; end if;
  update public.sessions set status='cancelled',updated_at=now()
  where id=p_session_id and status='scheduled' and is_draft=false;
  if not found then raise exception 'Only published scheduled gatherings can be cancelled.'; end if;
  if v_parent is null then
    update public.sessions set status='cancelled',updated_at=now()
    where recurrence_parent_id=p_session_id and status='scheduled' and is_draft=false and scheduled_start_at>now();
  end if;
end;
$function$;

create or replace function public.delete_session_draft(p_session_id uuid)
returns void language plpgsql security definer set search_path=''
as $function$
begin
  if (select auth.uid()) is null then raise exception using errcode='42501',message='Authentication required.'; end if;
  if not private.is_session_organizer(p_session_id) then raise exception using errcode='42501',message='Only the organizer can delete this draft.'; end if;
  delete from public.sessions where id=p_session_id and is_draft=true and status='scheduled';
  if not found then raise exception 'Only an unpublished draft can be deleted.'; end if;
end;
$function$;
revoke all on function public.delete_session_draft(uuid) from public,anon;
grant execute on function public.delete_session_draft(uuid) to authenticated;
