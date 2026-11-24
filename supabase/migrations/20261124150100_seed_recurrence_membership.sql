-- Seed current series membership whenever a new recurrence occurrence is created.
create or replace function public.seed_recurrence_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.recurrence_parent_id is null then
    return new;
  end if;

  insert into public.session_members (
    session_id, user_id, role, status, can_control_reader
  )
  select new.id, parent_member.user_id, parent_member.role,
         parent_member.status, parent_member.can_control_reader
  from public.session_members parent_member
  where parent_member.session_id = new.recurrence_parent_id
    and parent_member.status = 'accepted'
  on conflict (session_id, user_id) do update
    set role = excluded.role,
        status = excluded.status,
        can_control_reader = excluded.can_control_reader,
        updated_at = pg_catalog.now();

  return new;
end;
$$;

drop trigger if exists session_seed_recurrence_membership on public.sessions;

create trigger session_seed_recurrence_membership
after insert on public.sessions
for each row
execute function public.seed_recurrence_membership();
