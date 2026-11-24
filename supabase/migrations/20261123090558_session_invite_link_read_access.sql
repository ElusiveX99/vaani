alter table public.session_invite_links enable row level security;

grant select on table public.session_invite_links to authenticated;

drop policy if exists "Session managers and link creators can view invite links"
on public.session_invite_links;

create policy "Session managers and link creators can view invite links"
on public.session_invite_links
for select
to authenticated
using (
  created_by = (select auth.uid())
  or private.can_manage_session(session_id)
);
