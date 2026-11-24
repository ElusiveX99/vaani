DROP FUNCTION IF EXISTS public.join_community_session(uuid);
DROP FUNCTION IF EXISTS public.publish_session_draft(uuid);
DROP FUNCTION IF EXISTS public.update_session_draft(uuid,text,text,timestamptz,text);
DROP FUNCTION IF EXISTS public.update_session_access_from_link(uuid,uuid);
