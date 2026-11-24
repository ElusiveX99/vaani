CREATE OR REPLACE FUNCTION public.create_session_invite_link(p_session_id uuid,p_token_hash text,p_label text DEFAULT NULL,p_expires_at timestamptz DEFAULT NULL,p_max_uses integer DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_user uuid:=(SELECT auth.uid()); v_id uuid; v_allowed boolean:=false;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
 IF private.can_manage_session(p_session_id) THEN
  v_allowed:=true;
 ELSE
  SELECT EXISTS(
   SELECT 1 FROM public.sessions s JOIN public.session_members m ON m.session_id=s.id
   WHERE s.id=p_session_id AND s.status IN ('scheduled','live') AND NOT s.is_draft
    AND s.allow_participant_invites AND m.user_id=v_user AND m.role='participant' AND m.status='accepted'
  ) INTO v_allowed;
 END IF;
 IF NOT v_allowed THEN RAISE EXCEPTION 'You cannot create invitation links for this gathering.'; END IF;
 IF p_token_hash IS NULL OR char_length(p_token_hash)<>64 THEN RAISE EXCEPTION 'Invalid invitation token.'; END IF;
 IF p_expires_at IS NOT NULL AND p_expires_at<=now() THEN RAISE EXCEPTION 'Invitation expiry must be in the future.'; END IF;
 IF p_max_uses IS NOT NULL AND p_max_uses NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Invalid invitation use limit.'; END IF;
 INSERT INTO public.session_invite_links(session_id,token_hash,label,expires_at,max_uses,created_by)
 VALUES(p_session_id,p_token_hash,nullif(trim(p_label),''),p_expires_at,p_max_uses,v_user)
 RETURNING id INTO v_id;
 RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_session_invite_link(uuid,text,text,timestamptz,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_session_invite_link(uuid,text,text,timestamptz,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.expand_session_recurrence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_step interval; v_next timestamptz; v_index integer:=0;
BEGIN
 IF NEW.recurrence_parent_id IS NOT NULL THEN RETURN NEW; END IF;
 IF NEW.recurrence_rule IS NULL OR NEW.recurrence_until IS NULL OR NEW.scheduled_start_at IS NULL OR NEW.is_draft OR NEW.status<>'scheduled' THEN
  DELETE FROM public.sessions s WHERE s.recurrence_parent_id=NEW.id AND s.status='scheduled'
   AND NOT EXISTS(SELECT 1 FROM public.session_members m WHERE m.session_id=s.id);
  RETURN NEW;
 END IF;
 v_step:=CASE NEW.recurrence_rule WHEN 'WEEKLY' THEN interval '7 days' WHEN 'BIWEEKLY' THEN interval '14 days' WHEN 'MONTHLY' THEN interval '1 month' ELSE NULL END;
 IF v_step IS NULL THEN RAISE EXCEPTION 'Unsupported recurrence rule.'; END IF;
 DELETE FROM public.sessions s WHERE s.recurrence_parent_id=NEW.id AND s.status='scheduled'
  AND (s.scheduled_start_at>NEW.recurrence_until OR s.scheduled_start_at<=NEW.scheduled_start_at)
  AND NOT EXISTS(SELECT 1 FROM public.session_members m WHERE m.session_id=s.id);
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
