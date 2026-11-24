CREATE OR REPLACE FUNCTION public.update_session_details(p_session_id uuid,p_title text,p_description text,p_access_type public.session_access_type,p_scheduled_start_at timestamptz,p_time_zone text,p_duration_minutes integer,p_participant_limit integer,p_waiting_room_enabled boolean,p_allow_participant_invites boolean,p_instructions text,p_recurrence_rule text DEFAULT NULL,p_recurrence_until timestamptz DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT private.is_session_organizer(p_session_id) THEN RAISE EXCEPTION 'Only the organizer can edit this gathering.'; END IF;
 IF p_title IS NULL OR length(trim(p_title)) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Invalid title.'; END IF;
 IF p_description IS NOT NULL AND length(p_description)>2000 THEN RAISE EXCEPTION 'Invalid description.'; END IF;
 IF p_scheduled_start_at IS NULL OR p_scheduled_start_at<=now() THEN RAISE EXCEPTION 'Choose a future start time.'; END IF;
 IF p_time_zone IS NULL OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=trim(p_time_zone)) THEN RAISE EXCEPTION 'Invalid time zone.'; END IF;
 IF p_duration_minutes IS NOT NULL AND p_duration_minutes NOT BETWEEN 15 AND 480 THEN RAISE EXCEPTION 'Invalid duration.'; END IF;
 IF p_participant_limit IS NOT NULL AND p_participant_limit NOT BETWEEN 2 AND 500 THEN RAISE EXCEPTION 'Invalid participant limit.'; END IF;
 IF p_recurrence_rule IS NOT NULL AND p_recurrence_rule NOT IN ('WEEKLY','BIWEEKLY','MONTHLY') THEN RAISE EXCEPTION 'Invalid recurrence rule.'; END IF;
 IF p_recurrence_rule IS NOT NULL AND (p_recurrence_until IS NULL OR p_recurrence_until<=p_scheduled_start_at OR p_recurrence_until>p_scheduled_start_at+interval '1 year') THEN RAISE EXCEPTION 'Recurrence must end within one year.'; END IF;
 UPDATE public.sessions SET title=trim(p_title),description=nullif(trim(coalesce(p_description,'')),''),
  access_type=p_access_type,scheduled_start_at=p_scheduled_start_at,time_zone=trim(p_time_zone),
  duration_minutes=p_duration_minutes,participant_limit=p_participant_limit,
  waiting_room_enabled=p_waiting_room_enabled,allow_participant_invites=p_allow_participant_invites,
  instructions=nullif(trim(coalesce(p_instructions,'')),''),recurrence_rule=p_recurrence_rule,
  recurrence_until=p_recurrence_until,updated_at=now()
 WHERE id=p_session_id AND status='scheduled';
 IF NOT FOUND THEN RAISE EXCEPTION 'Only scheduled gatherings and drafts can be edited.'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.expand_session_recurrence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_step interval; v_next timestamptz; v_index integer:=0;
BEGIN
 IF NEW.recurrence_parent_id IS NOT NULL THEN RETURN NEW; END IF;
 IF NEW.recurrence_rule IS NULL OR NEW.recurrence_until IS NULL OR NEW.scheduled_start_at IS NULL OR NEW.is_draft OR NEW.status<>'scheduled' THEN
  UPDATE public.sessions SET status='cancelled'
   WHERE recurrence_parent_id=NEW.id AND status='scheduled' AND scheduled_start_at>now();
  RETURN NEW;
 END IF;
 v_step:=CASE NEW.recurrence_rule WHEN 'WEEKLY' THEN interval '7 days' WHEN 'BIWEEKLY' THEN interval '14 days' WHEN 'MONTHLY' THEN interval '1 month' ELSE NULL END;
 IF v_step IS NULL THEN RAISE EXCEPTION 'Unsupported recurrence rule.'; END IF;
 DELETE FROM public.sessions s WHERE s.recurrence_parent_id=NEW.id AND s.status='scheduled'
  AND s.scheduled_start_at>now()
  AND (s.scheduled_start_at>NEW.recurrence_until OR NOT EXISTS(SELECT 1 FROM public.session_members m WHERE m.session_id=s.id AND m.role<>'organizer'));
 v_next:=NEW.scheduled_start_at+v_step;
 WHILE v_next<=NEW.recurrence_until AND v_index<52 LOOP
  INSERT INTO public.sessions(title,description,access_type,status,scheduled_start_at,created_by,is_draft,published_at,time_zone,duration_minutes,instructions,participant_limit,waiting_room_enabled,allow_participant_invites,recurrence_parent_id)
  VALUES(NEW.title,NEW.description,NEW.access_type,'scheduled',v_next,NEW.created_by,false,now(),NEW.time_zone,NEW.duration_minutes,NEW.instructions,NEW.participant_limit,NEW.waiting_room_enabled,NEW.allow_participant_invites,NEW.id)
  ON CONFLICT (recurrence_parent_id,scheduled_start_at) WHERE recurrence_parent_id IS NOT NULL
  DO UPDATE SET title=excluded.title,description=excluded.description,access_type=excluded.access_type,time_zone=excluded.time_zone,duration_minutes=excluded.duration_minutes,instructions=excluded.instructions,participant_limit=excluded.participant_limit,waiting_room_enabled=excluded.waiting_room_enabled,allow_participant_invites=excluded.allow_participant_invites
  WHERE public.sessions.status='scheduled';
  v_next:=v_next+v_step; v_index:=v_index+1;
 END LOOP;
 RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_session(p_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_parent uuid; v_start timestamptz;
BEGIN
 IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
 IF NOT private.is_session_organizer(p_session_id) THEN RAISE EXCEPTION 'Only the organizer can cancel this gathering.'; END IF;
 SELECT recurrence_parent_id,scheduled_start_at INTO v_parent,v_start FROM public.sessions WHERE id=p_session_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Gathering not found.'; END IF;
 UPDATE public.sessions SET status='cancelled',updated_at=now()
  WHERE id=p_session_id AND status='scheduled';
 IF NOT FOUND THEN RAISE EXCEPTION 'Only scheduled gatherings can be cancelled.'; END IF;
 IF v_parent IS NULL THEN
  UPDATE public.sessions SET status='cancelled',updated_at=now()
   WHERE recurrence_parent_id=p_session_id AND status='scheduled' AND scheduled_start_at>now();
 END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.update_session_details(uuid,text,text,public.session_access_type,timestamptz,text,integer,integer,boolean,boolean,text,text,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_session_details(uuid,text,text,public.session_access_type,timestamptz,text,integer,integer,boolean,boolean,text,text,timestamptz) TO authenticated;
REVOKE ALL ON FUNCTION public.cancel_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_session(uuid) TO authenticated;
