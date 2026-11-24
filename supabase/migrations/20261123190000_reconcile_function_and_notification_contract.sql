-- Reconcile functions whose production definitions diverged from the recorded migration chain.
-- Definitions are copied from the production catalog at recovery time.
SET check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.enforce_session_access_limits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_limit integer; v_count integer;
begin
  if new.status='accepted' then
    select participant_limit into v_limit from public.sessions where id=new.session_id;
    if v_limit is not null and new.role='participant' then
      select count(*) into v_count from public.session_members where session_id=new.session_id and status='accepted' and role='participant';
      if v_count >= v_limit and not exists(select 1 from public.session_members where id=new.id and status='accepted') then
        raise exception 'This gathering is full.';
      end if;
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_session(p_session_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

CREATE OR REPLACE FUNCTION public.create_session_invite_link(p_session_id uuid, p_short_code text, p_token_hash text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := (select auth.uid());
  v_s public.sessions%rowtype;
  v_code text;
begin
  if v_user is null then raise exception using errcode='42501', message='Authentication required.'; end if;
  select * into v_s from public.sessions
  where id=p_session_id and status::text in ('scheduled','live') and not is_draft for update;
  if not found then raise exception 'Gathering unavailable.'; end if;
  if v_s.access_type not in ('community','link') then raise exception using errcode='42501', message='Links unavailable.'; end if;
  if not private.can_manage_session(p_session_id) and not exists (
    select 1 from public.session_members m
    where m.session_id=p_session_id and m.user_id=v_user and m.role='participant' and m.status='accepted'
  ) then raise exception using errcode='42501', message='You cannot create links.'; end if;
  if p_short_code is null or p_short_code !~ '^[a-z0-9]{10}$'
    or p_token_hash is null
    or p_token_hash <> encode(extensions.digest(p_short_code,'sha256'),'hex')
  then raise exception 'Invalid invitation code.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_session_id::text||':'||v_user::text,0));
  select short_code into v_code from public.session_invite_links
  where session_id=p_session_id and created_by=v_user for update;
  if v_code is not null then return v_code; end if;
  insert into public.session_invite_links(session_id,token_hash,short_code,created_by)
  values(p_session_id,p_token_hash,p_short_code,v_user);
  return p_short_code;
end;
$function$;

CREATE OR REPLACE FUNCTION public.delete_ended_session(p_session_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Authentication required.'; end if;
  if not private.is_session_organizer(p_session_id) then raise exception using errcode='42501',message='Only the organizer can permanently delete this gathering.'; end if;
  delete from public.sessions where id=p_session_id and status='ended' and is_draft=false;
  if not found then raise exception 'Only ended gatherings can be permanently deleted.'; end if;
end;$function$;

CREATE OR REPLACE FUNCTION public.delete_session_draft(p_session_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (select auth.uid()) is null then raise exception using errcode='42501',message='Authentication required.'; end if;
  if not private.is_session_organizer(p_session_id) then raise exception using errcode='42501',message='Only the organizer can delete this draft.'; end if;
  delete from public.sessions where id=p_session_id and is_draft=true and status='scheduled';
  if not found then raise exception 'Only an unpublished draft can be deleted.'; end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.delete_session_invite_link(p_link_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_link public.session_invite_links%rowtype;
  v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception using errcode='42501', message='Authentication required.'; end if;
  select * into v_link from public.session_invite_links where id=p_link_id for update;
  if not found or (v_user is distinct from v_link.created_by and not private.can_manage_session(v_link.session_id))
  then raise exception using errcode='42501', message='You cannot delete this invitation link.'; end if;
  delete from public.session_invite_links where id=p_link_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.mark_session_notification_read(p_notification_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  update public.session_notifications
  set read_at=now()
  where id=p_notification_id and user_id=(select auth.uid());
$function$;

CREATE OR REPLACE FUNCTION public.notify_session_members(p_session_id uuid, p_type text, p_title text, p_body text, p_exclude_user uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  insert into public.session_notifications(user_id,session_id,type,title,body)
  select user_id,p_session_id,p_type,p_title,p_body
  from public.session_members
  where session_id=p_session_id
    and status='accepted'
    and (p_exclude_user is null or user_id <> p_exclude_user);
$function$;

CREATE OR REPLACE FUNCTION public.preview_session_invite_link(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_link public.session_invite_links%rowtype;
  v_s public.sessions%rowtype;
  v_count integer;
  v_state text;
begin
  if p_code is null or p_code !~ '^[a-z0-9]{10}$' then return jsonb_build_object('state','invalid'); end if;
  select * into v_link from public.session_invite_links
  where token_hash=encode(extensions.digest(trim(p_code),'sha256'),'hex');
  if not found then return jsonb_build_object('state','invalid'); end if;
  select * into v_s from public.sessions where id=v_link.session_id;
  if not found or v_s.is_draft or v_s.status::text not in ('scheduled','live') then return jsonb_build_object('state','unavailable'); end if;
  select count(*)::integer into v_count from public.session_members
  where session_id=v_s.id and status='accepted' and role='participant';
  v_state := case when v_s.participant_limit is not null and v_count>=v_s.participant_limit then 'full' else 'valid' end;
  return jsonb_build_object('state',v_state,'title',v_s.title,'description',v_s.description,'scheduled_start_at',v_s.scheduled_start_at,'time_zone',v_s.time_zone,'duration_minutes',v_s.duration_minutes,'status',v_s.status::text,'participants',v_count,'participant_limit',v_s.participant_limit,'waiting_room_enabled',v_s.waiting_room_enabled);
end;
$function$;

CREATE OR REPLACE FUNCTION public.reject_session_join_request(p_request_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_session uuid; v_user uuid;
begin
  select session_id,user_id into v_session,v_user from public.session_join_requests where id=p_request_id and status='pending';
  if not found then raise exception 'Join request is unavailable.'; end if;
  if not private.can_manage_session(v_session) then raise exception 'You cannot manage this gathering.'; end if;
  update public.session_join_requests set status='rejected',responded_at=now() where id=p_request_id;
  insert into public.session_notifications(user_id,session_id,type,title,body)
  values(v_user,v_session,'join_request_rejected','Join request declined','Your request to join this gathering was declined.');
end;
$function$;

CREATE OR REPLACE FUNCTION public.request_gathering_join_by_slug(p_slug text)
 RETURNS TABLE(session_id uuid, outcome text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := (select auth.uid());
  v_session public.sessions%rowtype;
  v_count integer;
  v_member uuid;
  v_request uuid;
  v_existing_status text;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select * into v_session
  from public.sessions
  where public_slug = p_slug
    and not is_draft
    and status in ('scheduled', 'live')
    and access_type in ('community', 'link')
  for update;

  if not found then
    raise exception 'This gathering is unavailable.';
  end if;

  if v_session.access_type = 'community' then
    perform public.request_session_join(v_session.id);

    if exists (
      select 1 from public.session_members
      where session_id = v_session.id and user_id = v_user and status = 'accepted'
    ) then
      return query select v_session.id, 'joined'::text;
    else
      return query select v_session.id, 'request_pending'::text;
    end if;
    return;
  end if;

  select status into v_existing_status
  from public.session_members
  where session_id = v_session.id and user_id = v_user
  for update;

  if v_existing_status = 'accepted' then
    return query select v_session.id, 'already_member'::text;
    return;
  end if;

  -- Capacity applies before immediate admission and waiting-room queuing.
  select count(*) into v_count
  from public.session_members
  where session_id = v_session.id
    and status = 'accepted'
    and role = 'participant';

  if v_session.participant_limit is not null and v_count >= v_session.participant_limit then
    raise exception 'This gathering is full.';
  end if;

  if v_session.waiting_room_enabled then
    select id into v_request
    from public.session_join_requests
    where session_id = v_session.id and user_id = v_user and status = 'pending'
    for update;

    if v_request is not null then
      return query select v_session.id, 'request_pending'::text;
      return;
    end if;

    insert into public.session_join_requests(session_id, user_id, status)
    values (v_session.id, v_user, 'pending')
    on conflict (session_id, user_id) do update
      set status = 'pending', responded_at = null, created_at = pg_catalog.now()
      where public.session_join_requests.status in ('rejected', 'cancelled')
    returning id into v_request;

    if v_request is null then
      raise exception 'A join request is already active.';
    end if;

    return query select v_session.id, 'request_pending'::text;
    return;
  end if;

  insert into public.session_members(session_id, user_id, role, status)
  values (v_session.id, v_user, 'participant', 'accepted')
  on conflict (session_id, user_id) do update
    set role = 'participant', status = 'accepted'
    where public.session_members.role = 'participant'
      and public.session_members.status = 'removed'
  returning id into v_member;

  if v_member is null then
    raise exception 'You cannot join this gathering.';
  end if;

  return query select v_session.id, 'joined'::text;
end;
$function$;

CREATE OR REPLACE FUNCTION public.start_session(p_session_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (select auth.uid()) is null then raise exception using errcode='42501',message='Authentication required.'; end if;
  if not private.is_session_organizer(p_session_id) then raise exception using errcode='42501',message='Only the organizer can start this gathering.'; end if;
  update public.sessions set status='live',started_at=pg_catalog.now(),ended_at=null,updated_at=pg_catalog.now()
  where id=p_session_id and status='scheduled' and is_draft=false;
  if not found then raise exception 'Only a published scheduled gathering can be started.'; end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_session_access_from_link(p_session_id uuid, p_user_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  update public.session_members
  set status='accepted'
  where session_id=p_session_id and user_id=p_user_id and role='participant';
$function$;

CREATE OR REPLACE FUNCTION public.update_session_draft(p_session_id uuid, p_title text, p_description text, p_scheduled_start_at timestamp with time zone, p_time_zone text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

SET check_function_bodies = on;

-- Preserve the production privilege boundary for internal helper functions.
REVOKE ALL ON FUNCTION private.enforce_session_access_limits() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.notify_session_members(uuid,text,text,text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.update_session_access_from_link(uuid,uuid) FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION public.cancel_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_session_invite_link(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_ended_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_session_draft(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_session_invite_link(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_session_notification_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_session_invite_link(text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reject_session_join_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_gathering_join_by_slug(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_session_draft(uuid,text,text,timestamptz,text) TO authenticated;

-- Align the notification constraint with all notification types written by
-- current trigger and reminder functions. The old constraint rejected valid writes.
ALTER TABLE public.session_notifications
  DROP CONSTRAINT IF EXISTS session_notifications_type_check;
ALTER TABLE public.session_notifications
  ADD CONSTRAINT session_notifications_type_check CHECK (type IN (
    'invitation','invitation_accepted','invitation_declined','invitation_received',
    'invitation_response','schedule_changed','cancelled','join_request',
    'join_request_approved','join_request_rejected','join_request_received',
    'join_request_cancelled','reminder','session_reminder','organizer_changed',
    'session_resumed','status_changed'
  ));

-- Remove the superseded invite-link SELECT policy.
DROP POLICY IF EXISTS "Session managers and creators can view invite links"
  ON public.session_invite_links;
