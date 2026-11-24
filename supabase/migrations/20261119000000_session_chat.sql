CREATE TABLE public.session_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  sender_id uuid NOT NULL DEFAULT auth.uid(),
  body text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT session_messages_pkey
    PRIMARY KEY (id),

  CONSTRAINT session_messages_session_id_fkey
    FOREIGN KEY (session_id)
    REFERENCES public.sessions(id)
    ON DELETE CASCADE,

  CONSTRAINT session_messages_sender_id_fkey
    FOREIGN KEY (sender_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE,

  CONSTRAINT session_messages_body_check
    CHECK (
      char_length(btrim(body))
      BETWEEN 1 AND 2000
    )
);

CREATE INDEX session_messages_session_created_idx
  ON public.session_messages(
    session_id,
    created_at
  );

ALTER TABLE public.session_messages
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accepted members can view session messages"
  ON public.session_messages
  FOR SELECT
  TO authenticated
  USING (
    private.is_accepted_member(session_id)
  );

CREATE POLICY "Accepted members can send session messages"
  ON public.session_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    private.is_accepted_member(session_id)
    AND sender_id = auth.uid()
  );

GRANT SELECT, INSERT
  ON public.session_messages
  TO authenticated;

ALTER PUBLICATION supabase_realtime
  ADD TABLE public.session_messages;
