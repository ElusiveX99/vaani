begin;

-- Vaani's Supabase project enforces private Realtime channels.
-- Allow only accepted members of the session encoded in this exact topic
-- to join the shared conference event channel.
drop policy if exists "Accepted members can join conference realtime"
  on realtime.messages;

create policy "Accepted members can join conference realtime"
  on realtime.messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.sessions s
      where realtime.topic() = 'conference-realtime:' || s.id::text
        and private.is_accepted_member(s.id)
    )
  );

commit;
