-- Session admins can manage documents, participants, and reader state.
-- Only the organizer can assign or remove the admin role.

CREATE OR REPLACE FUNCTION private.can_manage_session(
  p_session_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.session_members AS m
    WHERE m.session_id = p_session_id
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'accepted'
      AND m.role::text IN ('organizer', 'in_charge', 'admin')
  );
$function$;

DROP POLICY IF EXISTS "Session managers can delete documents"
  ON public.session_documents;

CREATE POLICY "Session managers can delete documents"
  ON public.session_documents
  FOR DELETE
  TO authenticated
  USING (private.can_manage_session(session_id));

GRANT DELETE ON public.session_documents TO authenticated;

DROP POLICY IF EXISTS "Session managers can delete session PDFs"
  ON storage.objects;

CREATE POLICY "Session managers can delete session PDFs"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'session-pdfs'
    AND EXISTS (
      SELECT 1
      FROM public.session_documents AS d
      WHERE d.storage_path = objects.name
        AND private.can_manage_session(d.session_id)
    )
  );

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
  IF p_session_id IS NULL
    OR p_user_id IS NULL
    OR p_make_admin IS NULL
  THEN
    RAISE EXCEPTION 'Invalid role assignment request'
      USING ERRCODE = '22023';
  END IF;

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
          updated_at = now()
    WHERE session_id = p_session_id
      AND user_id = p_user_id;
  ELSE
    IF v_target_role = 'admin' THEN
      UPDATE public.session_members
        SET role = 'participant'::public.session_role,
            updated_at = now()
      WHERE session_id = p_session_id
        AND user_id = p_user_id;
    END IF;
  END IF;
END;
$function$;

REVOKE ALL
  ON FUNCTION public.set_session_admin(uuid, uuid, boolean)
  FROM PUBLIC;

GRANT EXECUTE
  ON FUNCTION public.set_session_admin(uuid, uuid, boolean)
  TO authenticated;

-- Keep the document library and membership views live across clients.
DO $publication$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'session_documents'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.session_documents;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'session_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.session_members;
  END IF;
END;
$publication$;
