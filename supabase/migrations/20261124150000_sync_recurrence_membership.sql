-- Keep recurring gathering membership consistent across the series.
-- Occurrences remain separate sessions for lifecycle/conference history, but
-- membership is inherited from the series root.
create or replace function public.sync_recurrence_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_id uuid;
  v_session_id uuid;
begin
  if tg_op = 'DELETE' then
    v_session_id := old.session_id;
  else
    v_session_id := new.session_id;
  end if;

  select s.recurrence_parent_id
    into v_parent_id
  from public.sessions s
  where s.id = v_session_id;

  -- Only propagate changes made to the series root. Occurrence changes do not
  -- recurse back into the series.
  if v_parent_id is not null then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    update public.session_members child_member
    set status = 'removed',
        can_control_reader = false,
        updated_at = pg_catalog.now()
    where child_member.user_id = old.user_id
      and child_member.session_id in (
        select id
        from public.sessions
        where recurrence_parent_id = old.session_id
      );
    return old;
  end if;

  insert into public.session_members (
    session_id, user_id, role, status, can_control_reader
  )
  select child.id, new.user_id, new.role, new.status, new.can_control_reader
  from public.sessions child
  where child.recurrence_parent_id = new.session_id
  on conflict (session_id, user_id) do update
    set role = excluded.role,
        status = excluded.status,
        can_control_reader = excluded.can_control_reader,
        updated_at = pg_catalog.now();

  return new;
end;
$$;

drop trigger if exists session_members_sync_recurrence on public.session_members;

create trigger session_members_sync_recurrence
after insert or update or delete on public.session_members
for each row
execute function public.sync_recurrence_membership();

-- Backfill existing occurrences from their current series-root membership.
insert into public.session_members (
  session_id, user_id, role, status, can_control_reader
)
select child.id, parent_member.user_id, parent_member.role,
       parent_member.status, parent_member.can_control_reader
from public.session_members parent_member
join public.sessions root
  on root.id = parent_member.session_id
 and root.recurrence_parent_id is null
join public.sessions child
  on child.recurrence_parent_id = root.id
where parent_member.status = 'accepted'
on conflict (session_id, user_id) do update
  set role = excluded.role,
      status = excluded.status,
      can_control_reader = excluded.can_control_reader,
      updated_at = pg_catalog.now();
