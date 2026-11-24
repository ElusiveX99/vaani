CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

CREATE UNIQUE INDEX IF NOT EXISTS session_notifications_reminder_unique
ON public.session_notifications(user_id,session_id,type,(metadata->>'reminder_for'))
WHERE type='session_reminder' AND session_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.generate_session_reminders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_now timestamptz:=now();
BEGIN
 INSERT INTO public.session_notifications(user_id,session_id,type,title,body,metadata)
 SELECT m.user_id,s.id,'session_reminder','Gathering reminder',
  'Your gathering starts in about 24 hours: '||s.title,
  jsonb_build_object('reminder_for','24h')
 FROM public.sessions s JOIN public.session_members m ON m.session_id=s.id AND m.status='accepted'
 WHERE s.status='scheduled' AND NOT s.is_draft
   AND s.scheduled_start_at BETWEEN v_now+interval '23 hours 45 minutes' AND v_now+interval '24 hours 15 minutes'
 ON CONFLICT DO NOTHING;

 INSERT INTO public.session_notifications(user_id,session_id,type,title,body,metadata)
 SELECT m.user_id,s.id,'session_reminder','Gathering reminder',
  'Your gathering starts in about one hour: '||s.title,
  jsonb_build_object('reminder_for','1h')
 FROM public.sessions s JOIN public.session_members m ON m.session_id=s.id AND m.status='accepted'
 WHERE s.status='scheduled' AND NOT s.is_draft
   AND s.scheduled_start_at BETWEEN v_now+interval '52 minutes' AND v_now+interval '68 minutes'
 ON CONFLICT DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.generate_session_reminders() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.notify_member_invitation_response()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
 IF OLD.status='invited' AND NEW.status IN ('accepted','declined') THEN
  INSERT INTO public.session_notifications(user_id,session_id,type,title,body)
  SELECT m.user_id,NEW.session_id,'invitation_response','Invitation response',
   CASE NEW.status WHEN 'accepted' THEN 'A member accepted your gathering invitation.' ELSE 'A member declined your gathering invitation.' END
  FROM public.session_members m
  WHERE m.session_id=NEW.session_id AND m.role IN ('organizer','in_charge','admin')
    AND m.status='accepted' AND m.user_id<>NEW.user_id;
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS session_member_invitation_response_notify ON public.session_members;
CREATE TRIGGER session_member_invitation_response_notify
AFTER UPDATE OF status ON public.session_members
FOR EACH ROW EXECUTE FUNCTION public.notify_member_invitation_response();

DO $scheduler$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT cron.unschedule(jobid)
      FROM cron.job
      WHERE jobname = 'vaani-gathering-reminders'
    $sql$;
    EXECUTE $sql$
      SELECT cron.schedule(
        'vaani-gathering-reminders',
        '*/15 * * * *',
        'SELECT public.generate_session_reminders();'
      )
    $sql$;
  END IF;
END;
$scheduler$;
