begin;

drop policy if exists "Members can join Vaani page refresh channels"
  on realtime.messages;

create policy "Accepted members can join Vaani page refresh channels"
  on realtime.messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.session_members m
      where realtime.topic() = 'session-page-updates-' || m.session_id::text
        and m.user_id = (select auth.uid())
        and m.status = 'accepted'
    )
    or realtime.topic() = 'user-gathering-updates-' || (select auth.uid())::text
  );

commit;