
DROP TRIGGER IF EXISTS sessions_expand_recurrence ON public.sessions;
DROP FUNCTION public.create_gathering(text,text,public.session_access_type,boolean,timestamptz,timestamptz,text,integer,text,integer,boolean,boolean,text,timestamptz);
DROP FUNCTION public.update_session_details(uuid,text,text,public.session_access_type,timestamptz,text,integer,integer,boolean,boolean,text,text,timestamptz);
ALTER TABLE public.sessions ALTER COLUMN access_type DROP DEFAULT;
ALTER TABLE public.sessions ALTER COLUMN access_type TYPE text USING access_type::text;
ALTER TABLE public.sessions ALTER COLUMN access_type SET DEFAULT 'community';
ALTER TABLE public.sessions ADD CONSTRAINT sessions_access_type_check CHECK (access_type IN ('community','link'));
DROP TYPE public.session_access_type;

CREATE FUNCTION public.create_gathering(p_title text,p_description text,p_access_type text,p_is_draft boolean,p_published_at timestamptz,p_scheduled_start_at timestamptz,p_time_zone text,p_duration_minutes integer,p_instructions text,p_participant_limit integer,p_waiting_room_enabled boolean,p_allow_participant_invites boolean,p_recurrence_rule text,p_recurrence_until timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE v_user_id uuid:=auth.uid(); v_id uuid; v_now timestamptz:=now();
BEGIN
 IF v_user_id IS NULL THEN RAISE EXCEPTION USING errcode='42501',message='Authentication required.'; END IF;
 IF p_title IS NULL OR char_length(btrim(p_title)) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Invalid title.'; END IF;
 IF p_access_type NOT IN ('community','link') THEN RAISE EXCEPTION 'Invalid access mode.'; END IF;
 IF p_description IS NOT NULL AND char_length(p_description)>2000 THEN RAISE EXCEPTION 'Description too long.'; END IF;
 IF p_instructions IS NOT NULL AND char_length(p_instructions)>2000 THEN RAISE EXCEPTION 'Instructions too long.'; END IF;
 IF p_time_zone IS NULL OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=p_time_zone) THEN RAISE EXCEPTION 'Invalid time zone.'; END IF;
 IF p_duration_minutes IS NOT NULL AND p_duration_minutes NOT BETWEEN 15 AND 480 THEN RAISE EXCEPTION 'Invalid duration.'; END IF;
 IF p_participant_limit IS NOT NULL AND p_participant_limit NOT BETWEEN 2 AND 500 THEN RAISE EXCEPTION 'Invalid participant limit.'; END IF;
 IF p_scheduled_start_at IS NOT NULL AND NOT coalesce(p_is_draft,false) AND p_scheduled_start_at<=v_now THEN RAISE EXCEPTION 'Choose a future start time.'; END IF;
 IF p_recurrence_rule IS NOT NULL AND (p_recurrence_rule NOT IN ('DAILY','WEEKLY','BIWEEKLY','EVERY_3_WEEKS','EVERY_4_WEEKS','MONTHLY') OR p_scheduled_start_at IS NULL OR p_recurrence_until IS NULL OR p_recurrence_until<=p_scheduled_start_at OR p_recurrence_until>p_scheduled_start_at+interval '366 days') THEN RAISE EXCEPTION 'Invalid recurrence.'; END IF;
 IF p_recurrence_rule IS NULL AND p_recurrence_until IS NOT NULL THEN RAISE EXCEPTION 'Repeat end date requires a repeat schedule.'; END IF;
 INSERT INTO public.sessions(title,description,access_type,is_draft,published_at,scheduled_start_at,time_zone,duration_minutes,instructions,participant_limit,waiting_room_enabled,allow_participant_invites,recurrence_rule,recurrence_until,created_by)
 VALUES(btrim(p_title),nullif(btrim(p_description),''),p_access_type,coalesce(p_is_draft,false),CASE WHEN coalesce(p_is_draft,false) THEN NULL ELSE coalesce(p_published_at,v_now) END,p_scheduled_start_at,p_time_zone,p_duration_minutes,nullif(btrim(p_instructions),''),p_participant_limit,coalesce(p_waiting_room_enabled,false),coalesce(p_allow_participant_invites,false),p_recurrence_rule,p_recurrence_until,v_user_id) RETURNING id INTO v_id;
 RETURN v_id;
END;$f$;
REVOKE ALL ON FUNCTION public.create_gathering(text,text,text,boolean,timestamptz,timestamptz,text,integer,text,integer,boolean,boolean,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_gathering(text,text,text,boolean,timestamptz,timestamptz,text,integer,text,integer,boolean,boolean,text,timestamptz) TO authenticated;

CREATE FUNCTION public.update_session_details(p_session_id uuid,p_title text,p_description text,p_access_type text,p_scheduled_start_at timestamptz,p_time_zone text,p_duration_minutes integer,p_participant_limit integer,p_waiting_room_enabled boolean,p_allow_participant_invites boolean,p_instructions text,p_recurrence_rule text DEFAULT NULL,p_recurrence_until timestamptz DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE v_draft boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_session_organizer(p_session_id) THEN RAISE EXCEPTION USING errcode='42501',message='Organizer access required.'; END IF;
 SELECT is_draft INTO v_draft FROM public.sessions WHERE id=p_session_id AND status='scheduled' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Only scheduled drafts can be edited.'; END IF;
 IF p_title IS NULL OR char_length(btrim(p_title)) NOT BETWEEN 1 AND 120 OR p_access_type NOT IN ('community','link') THEN RAISE EXCEPTION 'Invalid gathering details.'; END IF;
 IF p_description IS NOT NULL AND char_length(p_description)>2000 THEN RAISE EXCEPTION 'Description too long.'; END IF;
 IF p_instructions IS NOT NULL AND char_length(p_instructions)>2000 THEN RAISE EXCEPTION 'Instructions too long.'; END IF;
 IF p_scheduled_start_at IS NOT NULL AND NOT v_draft AND p_scheduled_start_at<=now() THEN RAISE EXCEPTION 'Choose a future start time.'; END IF;
 IF p_time_zone IS NULL OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=trim(p_time_zone)) THEN RAISE EXCEPTION 'Invalid time zone.'; END IF;
 IF p_duration_minutes IS NOT NULL AND p_duration_minutes NOT BETWEEN 15 AND 480 THEN RAISE EXCEPTION 'Invalid duration.'; END IF;
 IF p_participant_limit IS NOT NULL AND p_participant_limit NOT BETWEEN 2 AND 500 THEN RAISE EXCEPTION 'Invalid participant limit.'; END IF;
 IF p_recurrence_rule IS NOT NULL AND (p_recurrence_rule NOT IN ('DAILY','WEEKLY','BIWEEKLY','EVERY_3_WEEKS','EVERY_4_WEEKS','MONTHLY') OR p_scheduled_start_at IS NULL OR p_recurrence_until IS NULL OR p_recurrence_until<=p_scheduled_start_at OR p_recurrence_until>p_scheduled_start_at+interval '366 days') THEN RAISE EXCEPTION 'Invalid recurrence.'; END IF;
 IF p_recurrence_rule IS NULL AND p_recurrence_until IS NOT NULL THEN RAISE EXCEPTION 'Repeat end date requires a repeat schedule.'; END IF;
 UPDATE public.sessions SET title=btrim(p_title),description=nullif(btrim(coalesce(p_description,'')),''),access_type=p_access_type,scheduled_start_at=p_scheduled_start_at,time_zone=trim(p_time_zone),duration_minutes=p_duration_minutes,participant_limit=p_participant_limit,waiting_room_enabled=coalesce(p_waiting_room_enabled,false),allow_participant_invites=coalesce(p_allow_participant_invites,false),instructions=nullif(btrim(coalesce(p_instructions,'')),''),recurrence_rule=p_recurrence_rule,recurrence_until=p_recurrence_until,updated_at=now() WHERE id=p_session_id AND status='scheduled' AND is_draft=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'Draft could not be updated.'; END IF;
END;$f$;
REVOKE ALL ON FUNCTION public.update_session_details(uuid,text,text,text,timestamptz,text,integer,integer,boolean,boolean,text,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_session_details(uuid,text,text,text,timestamptz,text,integer,integer,boolean,boolean,text,text,timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_session_invite_link(p_session_id uuid,p_token_hash text,p_label text DEFAULT NULL,p_expires_at timestamptz DEFAULT NULL,p_max_uses integer DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE v_user uuid:=(SELECT auth.uid()); v_s public.sessions%rowtype; v_allowed boolean:=false; v_id uuid;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION USING errcode='42501',message='Authentication required.'; END IF;
 SELECT * INTO v_s FROM public.sessions WHERE id=p_session_id AND status IN ('scheduled','live') AND NOT is_draft FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Gathering unavailable.'; END IF;
 IF v_s.access_type NOT IN ('community','link') THEN RAISE EXCEPTION USING errcode='42501',message='Links unavailable.'; END IF;
 IF private.can_manage_session(p_session_id) THEN v_allowed:=true;
 ELSE SELECT EXISTS(SELECT 1 FROM public.session_members m WHERE m.session_id=p_session_id AND m.user_id=v_user AND m.role='participant' AND m.status='accepted') AND v_s.allow_participant_invites INTO v_allowed; END IF;
 IF NOT v_allowed THEN RAISE EXCEPTION USING errcode='42501',message='You cannot create links.'; END IF;
 IF p_token_hash IS NULL OR char_length(p_token_hash)<>64 OR (p_expires_at IS NOT NULL AND p_expires_at<=now()) OR (p_max_uses IS NOT NULL AND p_max_uses NOT BETWEEN 1 AND 500) THEN RAISE EXCEPTION 'Invalid link settings.'; END IF;
 INSERT INTO public.session_invite_links(session_id,token_hash,label,expires_at,max_uses,created_by) VALUES(p_session_id,p_token_hash,nullif(trim(p_label),''),p_expires_at,p_max_uses,v_user) RETURNING id INTO v_id;
 RETURN v_id;
END;$f$;
REVOKE ALL ON FUNCTION public.create_session_invite_link(uuid,text,text,timestamptz,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_session_invite_link(uuid,text,text,timestamptz,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.redeem_session_invite_link(p_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE v_user uuid:=(SELECT auth.uid()); v_link public.session_invite_links%rowtype; v_s public.sessions%rowtype; v_member uuid; v_status text; v_count integer;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION USING errcode='42501',message='Authentication required.'; END IF;
 IF p_token IS NULL OR char_length(p_token)<20 OR char_length(p_token)>128 THEN RAISE EXCEPTION 'Invalid token.'; END IF;
 SELECT * INTO v_link FROM public.session_invite_links WHERE token_hash=encode(extensions.digest(trim(p_token),'sha256'),'hex') FOR UPDATE;
 IF NOT FOUND OR v_link.revoked_at IS NOT NULL OR (v_link.expires_at IS NOT NULL AND v_link.expires_at<=now()) OR (v_link.max_uses IS NOT NULL AND v_link.use_count>=v_link.max_uses) THEN RAISE EXCEPTION 'Link invalid or expired.'; END IF;
 SELECT * INTO v_s FROM public.sessions WHERE id=v_link.session_id FOR UPDATE;
 IF NOT FOUND OR v_s.status NOT IN ('scheduled','live') OR v_s.is_draft THEN RAISE EXCEPTION 'Gathering unavailable.'; END IF;
 IF v_s.access_type NOT IN ('community','link') THEN RAISE EXCEPTION 'Gathering does not accept links.'; END IF;
 SELECT status::text INTO v_status FROM public.session_members WHERE session_id=v_link.session_id AND user_id=v_user FOR UPDATE;
 IF v_status='accepted' THEN RETURN v_link.session_id; END IF;
 SELECT count(*) INTO v_count FROM public.session_members WHERE session_id=v_link.session_id AND status='accepted';
 IF v_s.participant_limit IS NOT NULL AND v_count>=v_s.participant_limit THEN RAISE EXCEPTION 'Gathering full.'; END IF;
 INSERT INTO public.session_members(session_id,user_id,role,status) VALUES(v_link.session_id,v_user,'participant','accepted') ON CONFLICT(session_id,user_id) DO UPDATE SET role='participant',status='accepted' WHERE public.session_members.role='participant' AND public.session_members.status IN ('invited','declined','removed') RETURNING id INTO v_member;
 IF v_member IS NULL THEN RAISE EXCEPTION 'You cannot join this gathering.'; END IF;
 UPDATE public.session_invite_links SET use_count=use_count+1 WHERE id=v_link.id;
 RETURN v_link.session_id;
END;$f$;
REVOKE ALL ON FUNCTION public.redeem_session_invite_link(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.redeem_session_invite_link(text) TO authenticated;

CREATE TRIGGER sessions_expand_recurrence AFTER INSERT OR UPDATE OF recurrence_rule,recurrence_until,scheduled_start_at,title,description,access_type,time_zone,duration_minutes,instructions,participant_limit,waiting_room_enabled,allow_participant_invites,is_draft ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.expand_session_recurrence();
