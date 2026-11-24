ALTER TABLE public.session_members
  ADD COLUMN IF NOT EXISTS can_control_reader boolean NOT NULL DEFAULT false;

ALTER TABLE public.session_reader_state
  ADD COLUMN IF NOT EXISTS current_offset double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS controller_user_id uuid,
  ADD COLUMN IF NOT EXISTS controller_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS controller_epoch bigint NOT NULL DEFAULT 0;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'session_reader_state_current_offset_check'
      AND conrelid = 'public.session_reader_state'::regclass
  ) THEN
    ALTER TABLE public.session_reader_state
      ADD CONSTRAINT session_reader_state_current_offset_check
      CHECK (current_offset >= 0 AND current_offset <= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'session_reader_state_controller_epoch_check'
      AND conrelid = 'public.session_reader_state'::regclass
  ) THEN
    ALTER TABLE public.session_reader_state
      ADD CONSTRAINT session_reader_state_controller_epoch_check
      CHECK (controller_epoch >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'session_reader_state_controller_lease_check'
      AND conrelid = 'public.session_reader_state'::regclass
  ) THEN
    ALTER TABLE public.session_reader_state
      ADD CONSTRAINT session_reader_state_controller_lease_check
      CHECK (
        (controller_user_id IS NULL AND controller_expires_at IS NULL)
        OR
        (controller_user_id IS NOT NULL AND controller_expires_at IS NOT NULL)
      );
  END IF;
END;
$constraints$;

CREATE OR REPLACE FUNCTION public.claim_session_reader_control(
  p_session_id uuid
)
RETURNS TABLE (
  granted boolean,
  active_controller_id uuid,
  lease_expires_at timestamptz,
  epoch bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
  v_role text;
  v_reader_access boolean;
  v_controller uuid;
  v_expires timestamptz;
  v_epoch bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sessions AS s
    WHERE s.id = p_session_id
      AND s.status = 'live'
  ) THEN
    RAISE EXCEPTION 'Session is not live'
      USING ERRCODE = '22023';
  END IF;

  SELECT m.role::text, m.can_control_reader
    INTO v_role, v_reader_access
  FROM public.session_members AS m
  WHERE m.session_id = p_session_id
    AND m.user_id = v_user_id
    AND m.status = 'accepted';

  IF NOT FOUND OR NOT (
    v_role IN ('organizer', 'in_charge')
    OR (v_role = 'admin' AND v_reader_access)
  ) THEN
    RAISE EXCEPTION 'You are not assigned to control this reader'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.session_reader_state (
    session_id,
    current_document_id,
    current_page,
    current_offset,
    updated_by
  )
  SELECT
    p_session_id,
    (
      SELECT d.id
      FROM public.session_documents AS d
      WHERE d.session_id = p_session_id
        AND d.is_active = true
      ORDER BY d.display_order ASC, d.created_at ASC
      LIMIT 1
    ),
    1,
    0,
    v_user_id
  ON CONFLICT (session_id) DO NOTHING;

  SELECT
    s.controller_user_id,
    s.controller_expires_at,
    s.controller_epoch
  INTO
    v_controller,
    v_expires,
    v_epoch
  FROM public.session_reader_state AS s
  WHERE s.session_id = p_session_id
  FOR UPDATE;

  IF
    v_role = 'organizer'
    OR v_controller IS NULL
    OR v_expires IS NULL
    OR v_expires <= now()
    OR v_controller = v_user_id
  THEN
    IF v_controller IS DISTINCT FROM v_user_id THEN
      v_epoch := v_epoch + 1;
    END IF;

    v_expires := now() + interval '20 seconds';

    UPDATE public.session_reader_state
      SET controller_user_id = v_user_id,
          controller_expires_at = v_expires,
          controller_epoch = v_epoch,
          updated_by = v_user_id,
          updated_at = now()
    WHERE session_id = p_session_id;

    RETURN QUERY SELECT true, v_user_id, v_expires, v_epoch;
  ELSE
    RETURN QUERY SELECT false, v_controller, v_expires, v_epoch;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_session_reader_control(
  p_session_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := (SELECT auth.uid());
BEGIN
  UPDATE public.session_reader_state
    SET controller_user_id = NULL,
        controller_expires_at = NULL,
        controller_epoch = controller_epoch + 1,
        updated_by = v_user_id,
        updated_at = now()
  WHERE session_id = p_session_id
    AND controller_user_id = v_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_session_reader_access(
  p_session_id uuid,
  p_user_id uuid,
  p_enabled boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor_role text;
  v_target_role text;
  v_target_status text;
BEGIN
  SELECT m.role::text
    INTO v_actor_role
  FROM public.session_members AS m
  WHERE m.session_id = p_session_id
    AND m.user_id = (SELECT auth.uid())
    AND m.status = 'accepted'
  FOR UPDATE;

  IF v_actor_role IS DISTINCT FROM 'organizer' THEN
    RAISE EXCEPTION 'Only the organizer can assign reader control'
      USING ERRCODE = '42501';
  END IF;

  SELECT m.role::text, m.status::text
    INTO v_target_role, v_target_status
  FROM public.session_members AS m
  WHERE m.session_id = p_session_id
    AND m.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_target_status IS DISTINCT FROM 'accepted' THEN
    RAISE EXCEPTION 'Accepted session member not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_target_role <> 'admin' THEN
    RAISE EXCEPTION 'Reader control can only be assigned to a session admin'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.session_members
    SET can_control_reader = p_enabled,
        updated_at = now()
  WHERE session_id = p_session_id
    AND user_id = p_user_id;

  IF NOT p_enabled THEN
    UPDATE public.session_reader_state
      SET controller_user_id = NULL,
          controller_expires_at = NULL,
          controller_epoch = controller_epoch + 1,
          updated_at = now()
    WHERE session_id = p_session_id
      AND controller_user_id = p_user_id;
  END IF;
END;
$function$;

-- Demoting an admin also revokes any previously assigned reader-control privilege.
CREATE OR REPLACE FUNCTION public.set_session_admin(
  p_session_id uuid,
  p_user_id uuid,
  p_make_admin boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor_role text;
  v_target_role text;
  v_target_status text;
BEGIN
  SELECT m.role::text
    INTO v_actor_role
  FROM public.session_members AS m
  WHERE m.session_id = p_session_id
    AND m.user_id = (SELECT auth.uid())
    AND m.status = 'accepted'
  FOR UPDATE;

  IF v_actor_role IS DISTINCT FROM 'organizer' THEN
    RAISE EXCEPTION 'Only the organizer can manage session admins'
      USING ERRCODE = '42501';
  END IF;

  SELECT m.role::text, m.status::text
    INTO v_target_role, v_target_status
  FROM public.session_members AS m
  WHERE m.session_id = p_session_id
    AND m.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_target_status IS DISTINCT FROM 'accepted' THEN
    RAISE EXCEPTION 'Accepted session member not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_target_role = 'organizer' THEN
    RAISE EXCEPTION 'The organizer role cannot be changed'
      USING ERRCODE = '42501';
  END IF;

  IF p_make_admin THEN
    IF v_target_role NOT IN ('participant', 'admin') THEN
      RAISE EXCEPTION 'This member has a protected session role'
        USING ERRCODE = '42501';
    END IF;

    UPDATE public.session_members
      SET role = 'admin'::public.session_role,
          can_control_reader = false,
          updated_at = now()
    WHERE session_id = p_session_id
      AND user_id = p_user_id;
  ELSE
    IF v_target_role = 'admin' THEN
      UPDATE public.session_members
        SET role = 'participant'::public.session_role,
            can_control_reader = false,
            updated_at = now()
      WHERE session_id = p_session_id
        AND user_id = p_user_id;

      UPDATE public.session_reader_state
        SET controller_user_id = NULL,
            controller_expires_at = NULL,
            controller_epoch = controller_epoch + 1,
            updated_at = now()
      WHERE session_id = p_session_id
        AND controller_user_id = p_user_id;
    END IF;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.remove_session_member(
  p_session_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor_role text;
  v_target_role text;
  v_target_status text;
BEGIN
  SELECT m.role::text
    INTO v_actor_role
  FROM public.session_members AS m
  WHERE m.session_id = p_session_id
    AND m.user_id = (SELECT auth.uid())
    AND m.status = 'accepted'
  FOR UPDATE;

  IF NOT FOUND OR v_actor_role NOT IN ('organizer', 'in_charge', 'admin') THEN
    RAISE EXCEPTION 'Session management permission required'
      USING ERRCODE = '42501';
  END IF;

  SELECT m.role::text, m.status::text
    INTO v_target_role, v_target_status
  FROM public.session_members AS m
  WHERE m.session_id = p_session_id
    AND m.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_target_status IS DISTINCT FROM 'accepted' THEN
    RAISE EXCEPTION 'Accepted session member not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF
    v_target_role = 'organizer'
    OR (v_actor_role <> 'organizer' AND v_target_role <> 'participant')
  THEN
    RAISE EXCEPTION 'You cannot remove this session member'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.session_members
    SET status = 'removed',
        can_control_reader = false,
        updated_at = now()
  WHERE session_id = p_session_id
    AND user_id = p_user_id;

  UPDATE public.session_reader_state
    SET controller_user_id = NULL,
        controller_expires_at = NULL,
        controller_epoch = controller_epoch + 1,
        updated_at = now()
  WHERE session_id = p_session_id
    AND controller_user_id = p_user_id;
  RETURN true;
END;
$function$;

REVOKE ALL
  ON FUNCTION public.claim_session_reader_control(uuid)
  FROM PUBLIC;
REVOKE ALL
  ON FUNCTION public.release_session_reader_control(uuid)
  FROM PUBLIC;
REVOKE ALL
  ON FUNCTION public.set_session_reader_access(uuid, uuid, boolean)
  FROM PUBLIC;
REVOKE ALL
  ON FUNCTION public.remove_session_member(uuid, uuid)
  FROM PUBLIC;

GRANT EXECUTE
  ON FUNCTION public.claim_session_reader_control(uuid)
  TO authenticated;
GRANT EXECUTE
  ON FUNCTION public.release_session_reader_control(uuid)
  TO authenticated;
GRANT EXECUTE
  ON FUNCTION public.set_session_reader_access(uuid, uuid, boolean)
  TO authenticated;
GRANT EXECUTE
  ON FUNCTION public.remove_session_member(uuid, uuid)
  TO authenticated;

DO $reader_publication$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'session_reader_state'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.session_reader_state;
  END IF;
END;
$reader_publication$;
