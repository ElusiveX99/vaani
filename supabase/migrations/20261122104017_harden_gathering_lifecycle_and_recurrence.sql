CREATE UNIQUE INDEX IF NOT EXISTS sessions_recurrence_occurrence_unique ON public.sessions (recurrence_parent_id, scheduled_start_at) WHERE recurrence_parent_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.invite_user_to_session(p_session_id uuid,p_email text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_actor uuid := (SELECT auth.uid()); v_target uuid; v_id uuid;
BEGIN
 IF v_actor IS NULL OR NOT private.can_manage_session(p_session_id) THEN RAISE EXCEPTION 'You cannot manage this gathering.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sessions WHERE id=p_session_id AND status='scheduled' AND NOT is_draft) THEN RAISE EXCEPTION 'This gathering is not accepting invitations.'; END IF;
 SELECT id INTO v_target FROM auth.users WHERE lower(email)=lower(trim(p_email)) LIMIT 1;
 IF v_target IS NULL THEN RAISE EXCEPTION 'No Vaani account was found for that email address.'; END IF;
 INSERT INTO public.session_members(session_id,user_id,role,status) VALUES(p_session_id,v_target,'participant','invited')
 ON CONFLICT(session_id,user_id) DO UPDATE SET role='participant',status='invited'
 WHERE public.session_members.role='participant' AND public.session_members.status IN ('declined','removed')
 RETURNING id INTO v_id;
 IF v_id IS NULL THEN RAISE EXCEPTION 'This member is already part of the gathering.'; END IF;
 INSERT INTO public.session_invitations(session_id,user_id,email,invited_by,status)
 VALUES(p_session_id,v_target,lower(trim(p_email)),v_actor,'pending')
 ON CONFLICT (session_id,user_id) WHERE user_id IS NOT NULL
 DO UPDATE SET email=excluded.email,invited_by=excluded.invited_by,status='pending',responded_at=NULL,created_at=now();
 RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_session_invite_link(p_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_user_id uuid := (SELECT auth.uid()); v_link public.session_invite_links%rowtype; v_session public.sessions%rowtype; v_membership_id uuid; v_existing_status public.session_member_status; v_count integer;
BEGIN
 IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
 SELECT * INTO v_link FROM public.session_invite_links WHERE token_hash=encode(extensions.digest(trim(p_token),'sha256'),'hex') FOR UPDATE;
 IF NOT FOUND OR v_link.revoked_at IS NOT NULL OR (v_link.expires_at IS NOT NULL AND v_link.expires_at<=now()) OR (v_link.max_uses IS NOT NULL AND v_link.use_count>=v_link.max_uses) THEN RAISE EXCEPTION 'Invitation link is invalid or has expired.'; END IF;
 SELECT * INTO v_session FROM public.sessions WHERE id=v_link.session_id FOR UPDATE;
 IF NOT FOUND OR v_session.status NOT IN ('scheduled','live') OR v_session.is_draft THEN RAISE EXCEPTION 'This gathering is not accepting invitations.'; END IF;
 SELECT status INTO v_existing_status FROM public.session_members WHERE session_id=v_link.session_id AND user_id=v_user_id;
 IF v_existing_status='accepted' THEN RETURN v_link.session_id; END IF;
 SELECT count(*) INTO v_count FROM public.session_members WHERE session_id=v_link.session_id AND status='accepted';
 IF v_session.participant_limit IS NOT NULL AND v_count>=v_session.participant_limit THEN RAISE EXCEPTION 'This gathering is full.'; END IF;
 INSERT INTO public.session_members(session_id,user_id,role,status) VALUES(v_link.session_id,v_user_id,'participant','accepted')
 ON CONFLICT(session_id,user_id) DO UPDATE SET role='participant',status='accepted'
 WHERE public.session_members.role='participant' AND public.session_members.status IN ('invited','declined','removed')
 RETURNING id INTO v_membership_id;
 IF v_membership_id IS NULL THEN RAISE EXCEPTION 'You cannot join this gathering.'; END IF;
 UPDATE public.session_invite_links SET use_count=use_count+1 WHERE id=v_link.id;
 RETURN v_link.session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_session_invitation(p_session_id uuid,p_accept boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_user uuid := (SELECT auth.uid()); v_limit integer; v_count integer;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
 PERFORM 1 FROM public.sessions WHERE id=p_session_id AND status IN ('scheduled','live') AND NOT is_draft FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Gathering is unavailable.'; END IF;
 IF p_accept THEN
  SELECT participant_limit INTO v_limit FROM public.sessions WHERE id=p_session_id;
  SELECT count(*) INTO v_count FROM public.session_members WHERE session_id=p_session_id AND status='accepted';
  IF v_limit IS NOT NULL AND v_count>=v_limit THEN RAISE EXCEPTION 'This gathering is full.'; END IF;
 END IF;
 UPDATE public.session_members SET status=CASE WHEN p_accept THEN 'accepted'::public.session_member_status ELSE 'declined'::public.session_member_status END
 WHERE session_id=p_session_id AND user_id=v_user AND role='participant' AND status='invited';
 IF NOT FOUND THEN RAISE EXCEPTION 'No pending invitation was found.'; END IF;
 UPDATE public.session_invitations SET status=CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,responded_at=now()
 WHERE session_id=p_session_id AND user_id=v_user AND status='pending';
 RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_session_details(p_session_id uuid,p_title text,p_description text,p_access_type public.session_access_type,p_scheduled_start_at timestamptz,p_time_zone text,p_duration_minutes integer,p_participant_limit integer,p_waiting_room_enabled boolean,p_allow_participant_invites boolean,p_instructions text,p_recurrence_rule text DEFAULT NULL,p_recurrence_until timestamptz DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT private.is_session_organizer(p_session_id) THEN RAISE EXCEPTION 'Only the organizer can edit this gathering.'; END IF;
 IF p_title IS NULL OR length(trim(p_title)) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Invalid title.'; END IF;
 IF p_description IS NOT NULL AND length(p_description)>2000 THEN RAISE EXCEPTION 'Invalid description.'; END IF;
 IF p_scheduled_start_at IS NULL OR p_scheduled_start_at<=now() THEN RAISE EXCEPTION 'Choose a future start time.'; END IF;
 IF p_time_zone IS NULL OR length(trim(p_time_zone)) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION 'Invalid time zone.'; END IF;
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
  DELETE FROM public.sessions s WHERE s.recurrence_parent_id=NEW.id AND s.status='scheduled'
   AND NOT EXISTS(SELECT 1 FROM public.session_members m WHERE m.session_id=s.id AND m.status='accepted');
  RETURN NEW;
 END IF;
 v_step:=CASE NEW.recurrence_rule WHEN 'WEEKLY' THEN interval '7 days' WHEN 'BIWEEKLY' THEN interval '14 days' WHEN 'MONTHLY' THEN interval '1 month' ELSE NULL END;
 IF v_step IS NULL THEN RAISE EXCEPTION 'Unsupported recurrence rule.'; END IF;
 v_next:=NEW.scheduled_start_at+v_step;
 WHILE v_next<=NEW.recurrence_until AND v_index<52 LOOP
  INSERT INTO public.sessions(title,description,access_type,status,scheduled_start_at,created_by,is_draft,published_at,time_zone,duration_minutes,instructions,participant_limit,waiting_room_enabled,allow_participant_invites,recurrence_parent_id)
  VALUES(NEW.title,NEW.description,NEW.access_type,'scheduled',v_next,NEW.created_by,false,now(),NEW.time_zone,NEW.duration_minutes,NEW.instructions,NEW.participant_limit,NEW.waiting_room_enabled,NEW.allow_participant_invites,NEW.id)
  ON CONFLICT (recurrence_parent_id,scheduled_start_at) WHERE recurrence_parent_id IS NOT NULL
  DO UPDATE SET title=excluded.title,description=excluded.description,access_type=excluded.access_type,time_zone=excluded.time_zone,duration_minutes=excluded.duration_minutes,instructions=excluded.instructions,participant_limit=excluded.participant_limit,waiting_room_enabled=excluded.waiting_room_enabled,allow_participant_invites=excluded.allow_participant_invites
  WHERE public.sessions.status='scheduled'
   AND NOT EXISTS(SELECT 1 FROM public.session_members m WHERE m.session_id=public.sessions.id AND m.status='accepted');
  v_next:=v_next+v_step; v_index:=v_index+1;
 END LOOP;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sessions_expand_recurrence ON public.sessions;
CREATE TRIGGER sessions_expand_recurrence AFTER INSERT OR UPDATE OF recurrence_rule,recurrence_until,scheduled_start_at,title,description,access_type,time_zone,duration_minutes,instructions,participant_limit,waiting_room_enabled,allow_participant_invites,is_draft ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.expand_session_recurrence();

CREATE OR REPLACE FUNCTION public.notify_gathering_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
 IF TG_TABLE_NAME='session_invitations' AND NEW.status='pending' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) AND NEW.user_id IS NOT NULL THEN
  INSERT INTO public.session_notifications(user_id,session_id,type,title,body) VALUES(NEW.user_id,NEW.session_id,'invitation_received','Gathering invitation','You have been invited to a gathering on Vaani.');
 ELSIF TG_TABLE_NAME='session_join_requests' AND NEW.status='pending' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
  INSERT INTO public.session_notifications(user_id,session_id,type,title,body)
  SELECT user_id,NEW.session_id,'join_request_received','New join request','A member has requested to join your gathering.'
  FROM public.session_members WHERE session_id=NEW.session_id AND role IN ('organizer','in_charge','admin') AND status='accepted';
 ELSIF TG_TABLE_NAME='sessions' AND TG_OP='UPDATE' THEN
  IF OLD.scheduled_start_at IS DISTINCT FROM NEW.scheduled_start_at THEN
   PERFORM public.notify_session_members(NEW.id,'schedule_changed','Gathering rescheduled','The gathering schedule has changed.',NEW.created_by);
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('live','ended','cancelled') THEN
   PERFORM public.notify_session_members(NEW.id,'status_changed','Gathering status updated',CASE NEW.status WHEN 'live' THEN 'The gathering has started.' WHEN 'ended' THEN 'The gathering has ended.' ELSE 'The gathering was cancelled.' END,NEW.created_by);
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS session_invitations_notify ON public.session_invitations;
CREATE TRIGGER session_invitations_notify AFTER INSERT OR UPDATE OF status ON public.session_invitations FOR EACH ROW EXECUTE FUNCTION public.notify_gathering_changes();
DROP TRIGGER IF EXISTS session_join_requests_notify ON public.session_join_requests;
CREATE TRIGGER session_join_requests_notify AFTER INSERT OR UPDATE OF status ON public.session_join_requests FOR EACH ROW EXECUTE FUNCTION public.notify_gathering_changes();
DROP TRIGGER IF EXISTS sessions_notify_gathering_changes ON public.sessions;
CREATE TRIGGER sessions_notify_gathering_changes AFTER UPDATE OF scheduled_start_at,status ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.notify_gathering_changes();

REVOKE ALL ON FUNCTION public.invite_user_to_session(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_session_invite_link(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.respond_to_session_invitation(uuid,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_session_details(uuid,text,text,public.session_access_type,timestamptz,text,integer,integer,boolean,boolean,text,text,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invite_user_to_session(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_session_invite_link(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_session_invitation(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_session_details(uuid,text,text,public.session_access_type,timestamptz,text,integer,integer,boolean,boolean,text,text,timestamptz) TO authenticated;
