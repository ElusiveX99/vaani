-- Strengthen public gathering slugs and keep community previews member-only.
update public.sessions
set public_slug = encode(extensions.gen_random_bytes(16), 'hex')
where public_slug ~ '^[a-f0-9]{18}$';

alter table public.sessions
  alter column public_slug set default encode(extensions.gen_random_bytes(16), 'hex');

alter table public.sessions
  add constraint sessions_public_slug_format_check
  check (public_slug ~ '^[a-f0-9]{32}$');

create or replace function public.preview_gathering_by_slug(p_slug text)
returns table (
  session_id uuid,
  title text,
  description text,
  access_type text,
  status text,
  scheduled_start_at timestamptz,
  time_zone text,
  duration_minutes integer,
  participant_count bigint,
  participant_limit integer,
  waiting_room_enabled boolean
)
language sql
stable
security definer
set search_path to ''
as $$
  select
    s.id,
    s.title,
    s.description,
    s.access_type,
    s.status::text,
    s.scheduled_start_at,
    s.time_zone,
    s.duration_minutes,
    (select count(*) from public.session_members m
      where m.session_id = s.id and m.status = 'accepted' and m.role = 'participant') as participant_count,
    s.participant_limit,
    s.waiting_room_enabled
  from public.sessions s
  where s.public_slug = p_slug
    and not s.is_draft
    and s.status in ('scheduled', 'live')
    and (s.access_type = 'link' or (s.access_type = 'community' and auth.uid() is not null))
  limit 1;
$$;

revoke all on function public.preview_gathering_by_slug(text) from public;
grant execute on function public.preview_gathering_by_slug(text) to anon, authenticated;
