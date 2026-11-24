CREATE OR REPLACE FUNCTION public.notify_gathering_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
 IF TG_TABLE_NAME='session_invitations' AND NEW.status='pending' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) AND NEW.user_id IS NOT NULL THEN
  INSERT INTO public.session_notifications(user_id,session_id,type,title,body) VALUES(NEW.user_id,NEW.session_id,'invitation_received','Gathering invitation','You have been invited to a gathering on Vaani.');
 ELSIF TG_TABLE_NAME='session_join_requests' AND NEW.status='pending' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
  INSERT INTO public.session_notifications(user_id,session_id,type,title,body)
  SELECT user_id,NEW.session_id,'join_request_received','New join request','A member has requested to join your gathering.'
  FROM public.session_members WHERE session_id=NEW.session_id AND role IN ('organizer','in_charge','admin') AND status='accepted';
 ELSIF TG_TABLE_NAME='session_join_requests' AND OLD.status='pending' AND NEW.status='cancelled' THEN
  INSERT INTO public.session_notifications(user_id,session_id,type,title,body)
  SELECT user_id,NEW.session_id,'join_request_cancelled','Join request cancelled','A member cancelled their request to join your gathering.'
  FROM public.session_members WHERE session_id=NEW.session_id AND role IN ('organizer','in_charge','admin') AND status='accepted';
 ELSIF TG_TABLE_NAME='sessions' AND TG_OP='UPDATE' THEN
  IF OLD.scheduled_start_at IS DISTINCT FROM NEW.scheduled_start_at THEN
   PERFORM public.notify_session_members(NEW.id,'schedule_changed','Gathering rescheduled','The gathering schedule has changed.',NEW.created_by);
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('live','ended','cancelled','scheduled') THEN
   PERFORM public.notify_session_members(NEW.id,
    CASE WHEN NEW.status='scheduled' AND OLD.status='cancelled' THEN 'session_resumed' ELSE 'status_changed' END,
    CASE WHEN NEW.status='scheduled' AND OLD.status='cancelled' THEN 'Gathering resumed' ELSE 'Gathering status updated' END,
    CASE NEW.status WHEN 'live' THEN 'The gathering has started.' WHEN 'ended' THEN 'The gathering has ended.' WHEN 'cancelled' THEN 'The gathering was cancelled.' ELSE 'The organizer resumed this gathering.' END,
    NEW.created_by);
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
