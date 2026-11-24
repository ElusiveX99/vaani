
REVOKE ALL ON FUNCTION public.expand_session_recurrence() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_gathering_changes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_member_invitation_response() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_session_members(uuid,text,text,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_session_access_from_link(uuid,uuid) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.mark_session_notification_read(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_session_notification_read(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.reject_session_join_request(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reject_session_join_request(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.revoke_session_invite_link(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_session_invite_link(uuid) TO authenticated;
