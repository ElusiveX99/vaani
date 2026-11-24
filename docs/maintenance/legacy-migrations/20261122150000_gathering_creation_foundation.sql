ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS time_zone text NOT NULL DEFAULT 'Asia/Kolkata',
  ADD COLUMN IF NOT EXISTS duration_minutes integer,
  ADD COLUMN IF NOT EXISTS gathering_type text NOT NULL DEFAULT 'chaturasi_gaayan',
  ADD COLUMN IF NOT EXISTS language text,
  ADD COLUMN IF NOT EXISTS instructions text,
  ADD COLUMN IF NOT EXISTS participant_limit integer,
  ADD COLUMN IF NOT EXISTS waiting_room_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_participant_invites boolean NOT NULL DEFAULT false;

UPDATE public.sessions
SET published_at = COALESCE(published_at, created_at)
WHERE NOT is_draft;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_duration_minutes_check
    CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 15 AND 480),
  ADD CONSTRAINT sessions_gathering_type_check
    CHECK (gathering_type IN ('chaturasi_gaayan', 'vaani_paath', 'other')),
  ADD CONSTRAINT sessions_language_check
    CHECK (language IS NULL OR char_length(language) <= 40),
  ADD CONSTRAINT sessions_instructions_check
    CHECK (instructions IS NULL OR char_length(instructions) <= 2000),
  ADD CONSTRAINT sessions_participant_limit_check
    CHECK (participant_limit IS NULL OR participant_limit BETWEEN 2 AND 500),
  ADD CONSTRAINT sessions_time_zone_check
    CHECK (char_length(time_zone) BETWEEN 1 AND 80);

CREATE INDEX IF NOT EXISTS sessions_published_schedule_idx
  ON public.sessions (scheduled_start_at)
  WHERE NOT is_draft AND status = 'scheduled';

CREATE OR REPLACE FUNCTION private.can_view_session(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.sessions s
    WHERE s.id = p_session_id
      AND (
        NOT s.is_draft
        OR s.created_by = (SELECT auth.uid())
      )
      AND (
        s.access_type = 'community'
        OR EXISTS (
          SELECT 1
          FROM public.session_members m
          WHERE m.session_id = s.id
            AND m.user_id = (SELECT auth.uid())
            AND m.status IN ('invited', 'accepted')
        )
      )
  );
$function$;
