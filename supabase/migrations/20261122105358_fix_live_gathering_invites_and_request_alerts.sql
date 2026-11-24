CREATE OR REPLACE FUNCTION public.create_session_invite_link(p_session_id uuid,p_token_hash text,p_label text DEFAULT NULL,p_expires_at timestamptz DEFAULT NULL,p_max_uses integer DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_user uuid:=(SELECT auth.uid()); v_id uuid; v_allowed boolean:=false;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sessions WHERE id=p_session_id AND status IN ('scheduled','live') AND NOT is_draft) THEN RAISE EXCEPTION 'This gathering is not accepting invitation links.'; END IF;
 IF private.can_manage_session(p_session_id) THEN
  v_allowed:=true;
 ELSE
  SELECT EXISTS(SELECT 1 FROM public.sessions s JOIN public.session_members m ON m.session_id=s.id
   WHERE s.id=p_session_id AND s.allow_participant_invites AND m.user_id=v_user AND m.role='participant' AND m.status='accepted') INTO v_allowed;
 END IF;
 IF NOT v_allowed THEN RAISE EXCEPTION 'You cannot create invitation links for this gathering.'; END IF;
 IF p_token_hash IS NULL OR char_length(p_token_hash)<>64 THEN RAISE EXCEPTION 'Invalid invitation token.'; END IF;
 IF p_expires_at IS NOT NULL AND p_expires_at<=now() THEN RAISE EXCEPTION 'Invitation expiry must be in the future.'; END IF;
 IF p_max_uses IS NOT NULL AND p_max_uses NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Invalid invitation use limit.'; END IF;
 INSERT INTO public.session_invite_links(session_id,token_hash,label,expires_at,max_uses,created_by)
 VALUES(p_session_id,p_token_hash,nullif(trim(p_label),''),p_expires_at,p_max_uses,v_user) RETURNING id INTO v_id;
 RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.invite_user_to_session(p_session_id uuid,p_email text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_actor uuid := (SELECT auth.uid()); v_target uuid; v_id uuid;
BEGIN
 IF v_actor IS NULL OR NOT private.can_manage_session(p_session_id) THEN RAISE EXCEPTION 'You cannot manage this gathering.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sessions WHERE id=p_session_id AND status IN ('scheduled','live') AND NOT is_draft) THEN RAISE EXCEPTION 'This gathering is not accepting invitations.'; END IF;
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
 ELSIF TG_TABLE_NAME='session_join_requests' AND OLD.status='pending' AND NEW.status='cancelled' THEN
  INSERT INTO public.session_notifications(user_id,session_id,type,title,body)
  SELECT user_id,NEW.session_id,'join_request_cancelled','Join request cancelled','A member cancelled their request to join your gathering.'
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
REVOKE ALL ON FUNCTION public.create_session_invite_link(uuid,text,text,timestamptz,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_session_invite_link(uuid,text,text,timestamptz,integer) TO authenticated;
REVOKE ALL ON FUNCTION public.invite_user_to_session(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invite_user_to_session(uuid,text) TO authenticated;
