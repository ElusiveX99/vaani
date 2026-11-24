-- Restore gathering schema objects that existed in production but were omitted
-- from the recorded migration ledger. This must run after the gathering foundation
-- and before lifecycle functions that reference these tables and recurrence columns.

CREATE TABLE IF NOT EXISTS public.session_invite_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  label text,
  max_uses integer,
  use_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT session_invite_links_max_uses_check
    CHECK (max_uses IS NULL OR max_uses BETWEEN 1 AND 500),
  CONSTRAINT session_invite_links_label_check
    CHECK (label IS NULL OR char_length(label) <= 80)
);

CREATE TABLE IF NOT EXISTS public.session_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT session_invitations_status_check
    CHECK (status IN ('pending','accepted','declined','revoked')),
  CONSTRAINT session_invitations_email_check
    CHECK (char_length(trim(email)) BETWEEN 3 AND 320)
);

CREATE TABLE IF NOT EXISTS public.session_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT session_join_requests_status_check
    CHECK (status IN ('pending','approved','rejected','cancelled')),
  CONSTRAINT session_join_requests_session_id_user_id_key
    UNIQUE (session_id,user_id)
);

CREATE TABLE IF NOT EXISTS public.session_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.sessions(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT session_notifications_type_check CHECK (type IN (
    'invitation','invitation_accepted','invitation_declined','invitation_received',
    'invitation_response','schedule_changed','cancelled','join_request',
    'join_request_approved','join_request_rejected','join_request_received',
    'join_request_cancelled','reminder','session_reminder','organizer_changed',
    'session_resumed','status_changed'
  ))
);

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS recurrence_rule text,
  ADD COLUMN IF NOT EXISTS recurrence_until timestamptz,
  ADD COLUMN IF NOT EXISTS recurrence_parent_id uuid;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.sessions'::regclass
      AND conname='sessions_recurrence_parent_id_fkey'
  ) THEN
    ALTER TABLE public.sessions
      ADD CONSTRAINT sessions_recurrence_parent_id_fkey
      FOREIGN KEY (recurrence_parent_id)
      REFERENCES public.sessions(id) ON DELETE SET NULL;
  END IF;
END;
$migration$;

CREATE INDEX IF NOT EXISTS session_invite_links_session_idx
  ON public.session_invite_links(session_id,created_at DESC);
CREATE INDEX IF NOT EXISTS session_invitations_user_idx
  ON public.session_invitations(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS session_join_requests_session_status_idx
  ON public.session_join_requests(session_id,status,created_at);
CREATE INDEX IF NOT EXISTS session_join_requests_user_status_session_idx
  ON public.session_join_requests(user_id,status,session_id);
CREATE INDEX IF NOT EXISTS session_notifications_session_created_idx
  ON public.session_notifications(session_id,created_at DESC);
CREATE INDEX IF NOT EXISTS session_notifications_user_created_idx
  ON public.session_notifications(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS sessions_recurrence_parent_idx
  ON public.sessions(recurrence_parent_id,scheduled_start_at);

ALTER TABLE public.session_invite_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Session managers can view invite links"
  ON public.session_invite_links FOR SELECT TO authenticated
  USING (private.can_manage_session(session_id));
CREATE POLICY "Session managers can delete invite links"
  ON public.session_invite_links FOR DELETE TO authenticated
  USING (private.can_manage_session(session_id));
CREATE POLICY "Users can view their invitations"
  ON public.session_invitations FOR SELECT TO authenticated
  USING ((SELECT auth.uid())=user_id OR private.can_manage_session(session_id));
CREATE POLICY "users can read own join requests"
  ON public.session_join_requests FOR SELECT TO authenticated
  USING (user_id=(SELECT auth.uid()) OR private.can_manage_session(session_id));
CREATE POLICY "users can read own notifications"
  ON public.session_notifications FOR SELECT TO authenticated
  USING (user_id=(SELECT auth.uid()));
CREATE POLICY "users can update own notifications"
  ON public.session_notifications FOR UPDATE TO authenticated
  USING (user_id=(SELECT auth.uid()))
  WITH CHECK (user_id=(SELECT auth.uid()));

GRANT SELECT ON public.session_invite_links TO authenticated;
GRANT SELECT ON public.session_invitations TO authenticated;
GRANT SELECT ON public.session_join_requests TO authenticated;

-- This helper is revoked by the next security-hardening migration. Its
-- definition must exist before that migration revokes its privileges.
CREATE OR REPLACE FUNCTION public.notify_session_members(
  p_session_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_exclude_user uuid DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
  INSERT INTO public.session_notifications(user_id,session_id,type,title,body)
  SELECT user_id,p_session_id,p_type,p_title,p_body
  FROM public.session_members
  WHERE session_id=p_session_id
    AND status='accepted'
    AND (p_exclude_user IS NULL OR user_id<>p_exclude_user);
$function$;

-- Legacy SECURITY DEFINER compatibility function retained in the live schema.
-- The next privilege-hardening migration revokes all client execution.
CREATE OR REPLACE FUNCTION public.update_session_access_from_link(
  p_session_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
  UPDATE public.session_members
  SET status='accepted'
  WHERE session_id=p_session_id
    AND user_id=p_user_id
    AND role='participant';
$function$;

-- Restore database routines that are still part of the production API but were
-- omitted from the recorded migration ledger.

CREATE OR REPLACE FUNCTION public.mark_session_notification_read(p_notification_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
  UPDATE public.session_notifications
  SET read_at=now()
  WHERE id=p_notification_id
    AND user_id=(SELECT auth.uid());
$function$;
REVOKE ALL ON FUNCTION public.mark_session_notification_read(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mark_session_notification_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_ended_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING errcode='42501',message='Authentication required.';
  END IF;
  IF NOT private.is_session_organizer(p_session_id) THEN
    RAISE EXCEPTION USING errcode='42501',message='Only the organizer can permanently delete this gathering.';
  END IF;
  DELETE FROM public.sessions
  WHERE id=p_session_id AND status='ended' AND is_draft=false;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only ended gatherings can be permanently deleted.';
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public.delete_ended_session(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_ended_session(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_session_draft(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION USING errcode='42501',message='Authentication required.';
  END IF;
  IF NOT private.is_session_organizer(p_session_id) THEN
    RAISE EXCEPTION USING errcode='42501',message='Only the organizer can delete this draft.';
  END IF;
  DELETE FROM public.sessions
  WHERE id=p_session_id AND is_draft=true AND status='scheduled';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only an unpublished draft can be deleted.';
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public.delete_session_draft(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_session_draft(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_session_draft(
  p_session_id uuid,
  p_title text,
  p_description text,
  p_scheduled_start_at timestamptz,
  p_time_zone text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING errcode='42501',message='Authentication required.';
  END IF;
  IF NOT private.is_session_organizer(p_session_id) THEN
    RAISE EXCEPTION USING errcode='42501',message='Only the organizer can edit this draft.';
  END IF;
  UPDATE public.sessions
  SET title=btrim(p_title),
      description=nullif(btrim(p_description),''),
      scheduled_start_at=p_scheduled_start_at,
      time_zone=p_time_zone,
      updated_at=now()
  WHERE id=p_session_id
    AND is_draft=true
    AND status='scheduled'
    AND created_by=auth.uid()
    AND char_length(btrim(p_title)) BETWEEN 1 AND 120
    AND (p_description IS NULL OR char_length(p_description)<=2000)
    AND p_time_zone IS NOT NULL
    AND char_length(p_time_zone) BETWEEN 1 AND 80;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Draft not found or draft details are invalid.';
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public.update_session_draft(uuid,text,text,timestamptz,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_session_draft(uuid,text,text,timestamptz,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_session_join_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_session uuid;
  v_user uuid;
BEGIN
  SELECT session_id,user_id
  INTO v_session,v_user
  FROM public.session_join_requests
  WHERE id=p_request_id AND status='pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Join request is unavailable.';
  END IF;
  IF NOT private.can_manage_session(v_session) THEN
    RAISE EXCEPTION 'You cannot manage this gathering.';
  END IF;
  UPDATE public.session_join_requests
  SET status='rejected',responded_at=now()
  WHERE id=p_request_id;
  INSERT INTO public.session_notifications(user_id,session_id,type,title,body)
  VALUES(v_user,v_session,'join_request_rejected','Join request declined',
    'Your request to join this gathering was declined.');
END;
$function$;
REVOKE ALL ON FUNCTION public.reject_session_join_request(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reject_session_join_request(uuid) TO authenticated;

-- Historical soft-revocation routine. The final invitation migration replaces
-- this with permanent deletion while retaining the RPC name for compatibility.
CREATE OR REPLACE FUNCTION public.revoke_session_invite_link(p_link_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_link public.session_invite_links%rowtype;
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION USING errcode='42501',message='Authentication required.';
  END IF;
  SELECT * INTO v_link
  FROM public.session_invite_links
  WHERE id=p_link_id
  FOR UPDATE;
  IF NOT FOUND OR (
    v_user IS DISTINCT FROM v_link.created_by
    AND NOT private.can_manage_session(v_link.session_id)
  ) THEN
    RAISE EXCEPTION USING errcode='42501',message='You cannot revoke this invitation link.';
  END IF;
  UPDATE public.session_invite_links
  SET revoked_at=now()
  WHERE id=p_link_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.revoke_session_invite_link(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.revoke_session_invite_link(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.enforce_session_access_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_limit integer;
  v_count integer;
BEGIN
  IF NEW.status='accepted' THEN
    SELECT participant_limit INTO v_limit
    FROM public.sessions
    WHERE id=NEW.session_id;
    IF v_limit IS NOT NULL AND NEW.role='participant' THEN
      SELECT count(*) INTO v_count
      FROM public.session_members
      WHERE session_id=NEW.session_id
        AND status='accepted'
        AND role='participant';
      IF v_count>=v_limit AND NOT EXISTS (
        SELECT 1 FROM public.session_members
        WHERE id=NEW.id AND status='accepted'
      ) THEN
        RAISE EXCEPTION 'This gathering is full.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
