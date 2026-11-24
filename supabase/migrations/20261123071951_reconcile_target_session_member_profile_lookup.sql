-- Restore authenticated, gathering-scoped access to accepted members' profile details.
-- This avoids relying on token metadata for conference tiles and member lists.
create or replace function public.get_session_member_profiles(p_session_id uuid)
returns table(id uuid, display_name text, avatar_url text, avatar_path text)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if not exists (
    select 1
    from public.session_members viewer
    where viewer.session_id = p_session_id
      and viewer.user_id = v_user_id
      and viewer.status = 'accepted'
  ) then
    raise exception using errcode = '42501', message = 'Accepted gathering membership required.';
  end if;

  return query
  select p.id, p.display_name, p.avatar_url, p.avatar_path
  from public.profiles p
  join public.session_members member
    on member.user_id = p.id
   and member.session_id = p_session_id
   and member.status = 'accepted'
  order by p.display_name nulls last;
end;
$function$;

revoke all on function public.get_session_member_profiles(uuid) from public, anon;
grant execute on function public.get_session_member_profiles(uuid) to authenticated;
