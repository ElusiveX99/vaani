begin;

-- The main site also has session-scoped and per-user realtime refresh
-- channels. The project enforces private channels globally, so authorize
-- those exact topics without granting cross-session or cross-user access.
drop policy if exists "Members can join Vaani page refresh channels"
  on realtime.messages;

create policy "Members can join Vaani page refresh channels"
  on realtime.messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.session_members m
      where realtime.topic() = 'session-page-updates-' || m.session_id::text
        and m.user_id = (select auth.uid())
    )
    or realtime.topic() = 'user-gathering-updates-' || (select auth.uid())::text
  );

commit;
