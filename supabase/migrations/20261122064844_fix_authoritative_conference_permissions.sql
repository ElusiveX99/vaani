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
  IF p_session_id IS NULL OR p_user_id IS NULL OR p_make_admin IS NULL THEN
    RAISE EXCEPTION 'Invalid role assignment request'
      USING ERRCODE = '22023';
  END IF;

  SELECT m.role::text INTO v_actor_role
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
          can_control_reader = CASE
            WHEN v_target_role = 'admin' THEN can_control_reader
            ELSE false
          END,
          updated_at = now()
    WHERE session_id = p_session_id
      AND user_id = p_user_id;
  ELSIF v_target_role = 'admin' THEN
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
END;
$function$;

REVOKE ALL ON FUNCTION public.set_session_admin(uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_session_admin(uuid, uuid, boolean) TO authenticated;
