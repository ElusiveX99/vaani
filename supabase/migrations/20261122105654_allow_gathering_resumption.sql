CREATE OR REPLACE FUNCTION public.resume_session(p_session_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_rule text;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT private.is_session_organizer(p_session_id) THEN RAISE EXCEPTION 'Only the organizer can resume this gathering.'; END IF;
 UPDATE public.sessions SET status='scheduled',recurrence_rule=recurrence_rule,updated_at=now()
 WHERE id=p_session_id AND status='cancelled' AND NOT is_draft AND scheduled_start_at>now();
 IF NOT FOUND THEN RAISE EXCEPTION 'Only a cancelled gathering with a future start time can be resumed.'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.resume_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resume_session(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.expand_session_recurrence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_step interval; v_next timestamptz; v_index integer:=0; v_limit integer:=52;
BEGIN
 IF NEW.recurrence_parent_id IS NOT NULL THEN RETURN NEW; END IF;
 IF NEW.recurrence_rule IS NULL OR NEW.recurrence_until IS NULL OR NEW.scheduled_start_at IS NULL OR NEW.is_draft OR NEW.status<>'scheduled' THEN
  UPDATE public.sessions SET status='cancelled' WHERE recurrence_parent_id=NEW.id AND status='scheduled' AND scheduled_start_at>now();
  RETURN NEW;
 END IF;
 v_step:=CASE NEW.recurrence_rule WHEN 'DAILY' THEN interval '1 day' WHEN 'WEEKLY' THEN interval '7 days' WHEN 'BIWEEKLY' THEN interval '14 days' WHEN 'EVERY_3_WEEKS' THEN interval '21 days' WHEN 'EVERY_4_WEEKS' THEN interval '28 days' WHEN 'MONTHLY' THEN interval '1 month' ELSE NULL END;
 IF v_step IS NULL THEN RAISE EXCEPTION 'Unsupported recurrence rule.'; END IF;
 IF NEW.recurrence_rule='DAILY' THEN v_limit:=366; END IF;
 DELETE FROM public.sessions s WHERE s.recurrence_parent_id=NEW.id AND s.status='scheduled' AND s.scheduled_start_at>now()
  AND (s.scheduled_start_at>NEW.recurrence_until OR NOT EXISTS(SELECT 1 FROM public.session_members m WHERE m.session_id=s.id AND m.role<>'organizer'));
 v_next:=NEW.scheduled_start_at+v_step;
 WHILE v_next<=NEW.recurrence_until AND v_index<v_limit LOOP
  INSERT INTO public.sessions(title,description,access_type,status,scheduled_start_at,created_by,is_draft,published_at,time_zone,duration_minutes,instructions,participant_limit,waiting_room_enabled,allow_participant_invites,recurrence_parent_id)
  VALUES(NEW.title,NEW.description,NEW.access_type,'scheduled',v_next,NEW.created_by,false,now(),NEW.time_zone,NEW.duration_minutes,NEW.instructions,NEW.participant_limit,NEW.waiting_room_enabled,NEW.allow_participant_invites,NEW.id)
  ON CONFLICT (recurrence_parent_id,scheduled_start_at) WHERE recurrence_parent_id IS NOT NULL
  DO UPDATE SET title=excluded.title,description=excluded.description,access_type=excluded.access_type,status=CASE WHEN public.sessions.status='cancelled' AND public.sessions.scheduled_start_at>now() THEN 'scheduled'::public.session_status ELSE public.sessions.status END,time_zone=excluded.time_zone,duration_minutes=excluded.duration_minutes,instructions=excluded.instructions,participant_limit=excluded.participant_limit,waiting_room_enabled=excluded.waiting_room_enabled,allow_participant_invites=excluded.allow_participant_invites
  WHERE public.sessions.status IN ('scheduled','cancelled');
  v_next:=v_next+v_step; v_index:=v_index+1;
 END LOOP;
 RETURN NEW;
END;
$$;
