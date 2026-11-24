CREATE OR REPLACE FUNCTION public.cancel_session_join_request(p_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
 IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
 UPDATE public.session_join_requests SET status='cancelled',responded_at=now()
 WHERE id=p_request_id AND user_id=(SELECT auth.uid()) AND status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'No pending join request was found.'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_session_join_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_session_join_request(uuid) TO authenticated;
