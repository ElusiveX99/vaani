-- Finalize gathering fields and enforce join policy in one serialized database path.
ALTER TABLE public.sessions DROP COLUMN IF EXISTS gathering_type;
ALTER TABLE public.sessions DROP COLUMN IF EXISTS language;

CREATE OR REPLACE FUNCTION public.request_session_join(p_session_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_waiting boolean;
  v_limit integer;
  v_count integer;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;

  SELECT waiting_room_enabled, participant_limit
    INTO v_waiting, v_limit
    FROM public.sessions
   WHERE id = p_session_id
     AND status IN ('scheduled','live')
     AND NOT is_draft
     AND access_type = 'community'
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gathering is unavailable or requires an invitation.'; END IF;

  IF EXISTS (SELECT 1 FROM public.session_members WHERE session_id=p_session_id AND user_id=v_user AND status='accepted') THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO v_count FROM public.session_members
   WHERE session_id=p_session_id AND status='accepted';
  IF v_limit IS NOT NULL AND v_count >= v_limit THEN RAISE EXCEPTION 'This gathering is full.'; END IF;

  IF NOT v_waiting THEN
    INSERT INTO public.session_members(session_id,user_id,role,status)
    VALUES(p_session_id,v_user,'participant','accepted')
    ON CONFLICT(session_id,user_id) DO UPDATE SET status='accepted'
    WHERE public.session_members.role='participant'
      AND public.session_members.status IN ('invited','declined','removed')
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'You cannot join this gathering.'; END IF;
    RETURN v_id;
  END IF;

  INSERT INTO public.session_join_requests(session_id,user_id,status)
  VALUES(p_session_id,v_user,'pending')
  ON CONFLICT(session_id,user_id) DO UPDATE
    SET status='pending', responded_at=NULL
    WHERE public.session_join_requests.status IN ('rejected','cancelled')
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.session_join_requests
     WHERE session_id=p_session_id AND user_id=v_user;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_community_session(p_session_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT public.request_session_join(p_session_id);
$$;

CREATE OR REPLACE FUNCTION public.approve_session_join_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_session uuid;
  v_user uuid;
  v_limit integer;
  v_count integer;
BEGIN
  SELECT session_id,user_id INTO v_session,v_user
    FROM public.session_join_requests
   WHERE id=p_request_id AND status='pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Join request is unavailable.'; END IF;
  IF NOT private.can_manage_session(v_session) THEN RAISE EXCEPTION 'You cannot manage this gathering.'; END IF;

  PERFORM 1 FROM public.sessions WHERE id=v_session AND status IN ('scheduled','live') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This gathering is no longer accepting members.'; END IF;

  SELECT participant_limit INTO v_limit FROM public.sessions WHERE id=v_session;
  SELECT count(*) INTO v_count FROM public.session_members
   WHERE session_id=v_session AND status='accepted';
  IF v_limit IS NOT NULL AND v_count >= v_limit THEN RAISE EXCEPTION 'The gathering is full.'; END IF;

  INSERT INTO public.session_members(session_id,user_id,role,status)
  VALUES(v_session,v_user,'participant','accepted')
  ON CONFLICT(session_id,user_id) DO UPDATE SET status='accepted'
  WHERE public.session_members.role='participant'
    AND public.session_members.status IN ('invited','declined','removed');

  UPDATE public.session_join_requests SET status='approved',responded_at=now() WHERE id=p_request_id;
  INSERT INTO public.session_notifications(user_id,session_id,type,title,body)
  VALUES(v_user,v_session,'join_request_approved','Join request approved','Your request to join this gathering was approved.');
END;
$$;

REVOKE ALL ON FUNCTION public.request_session_join(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_community_session(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_session_join_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_session_join(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_community_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_session_join_request(uuid) TO authenticated;
