-- Public, read-only invitation previews for link landing pages and social crawlers.
-- Raw codes are checked against their stored hash; no internal session UUID is returned.
create or replace function public.preview_session_invite_link(p_code text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_link public.session_invite_links%rowtype;
  v_s public.sessions%rowtype;
  v_count integer;
  v_state text;
begin
  if p_code is null or p_code !~ '^[a-z0-9]{10}$' then
    return jsonb_build_object('state','invalid');
  end if;

  select * into v_link
  from public.session_invite_links
  where token_hash=encode(extensions.digest(trim(p_code),'sha256'),'hex');

  if not found then return jsonb_build_object('state','invalid'); end if;
  if v_link.revoked_at is not null then return jsonb_build_object('state','revoked'); end if;
  if v_link.expires_at is not null and v_link.expires_at<=pg_catalog.now() then
    return jsonb_build_object('state','expired');
  end if;
  if v_link.max_uses is not null and v_link.use_count>=v_link.max_uses then
    return jsonb_build_object('state','limit_reached');
  end if;

  select * into v_s from public.sessions where id=v_link.session_id;
  if not found or v_s.is_draft or v_s.status::text not in ('scheduled','live') then
    return jsonb_build_object('state','unavailable');
  end if;

  select count(*)::integer into v_count
  from public.session_members
  where session_id=v_s.id and status='accepted' and role='participant';

  v_state := case
    when v_s.participant_limit is not null and v_count>=v_s.participant_limit then 'full'
    else 'valid'
  end;

  return jsonb_build_object(
    'state',v_state,
    'title',v_s.title,
    'description',v_s.description,
    'scheduled_start_at',v_s.scheduled_start_at,
    'time_zone',v_s.time_zone,
    'duration_minutes',v_s.duration_minutes,
    'status',v_s.status::text,
    'participants',v_count,
    'participant_limit',v_s.participant_limit,
    'waiting_room_enabled',v_s.waiting_room_enabled,
    'expires_at',v_link.expires_at,
    'max_uses',v_link.max_uses,
    'use_count',v_link.use_count
  );
end;
$function$;

-- The preview contains only information deliberately visible to anyone holding the link.
revoke all on function public.preview_session_invite_link(text) from public;
grant execute on function public.preview_session_invite_link(text) to anon, authenticated;

-- Link creation is authenticated and idempotent per session/account. The advisory lock
-- closes the concurrent first-create race before the partial unique index is reached.
create or replace function public.create_session_invite_link(
  p_session_id uuid,
  p_short_code text,
  p_token_hash text,
  p_expires_at timestamptz default null,
  p_max_uses integer default null
)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_s public.sessions%rowtype;
  v_allowed boolean := false;
  v_code text;
begin
  if v_user is null then
    raise exception using errcode='42501',message='Authentication required.';
  end if;

  select * into v_s
  from public.sessions
  where id=p_session_id and status::text in ('scheduled','live') and not is_draft
  for update;
  if not found then raise exception 'Gathering unavailable.'; end if;
  if v_s.access_type not in ('community','link') then
    raise exception using errcode='42501',message='Links unavailable.';
  end if;

  if private.can_manage_session(p_session_id) then
    v_allowed := true;
  else
    select exists(
      select 1 from public.session_members m
      where m.session_id=p_session_id and m.user_id=v_user
        and m.role='participant' and m.status='accepted'
    ) and v_s.allow_participant_invites into v_allowed;
  end if;
  if not v_allowed then
    raise exception using errcode='42501',message='You cannot create links.';
  end if;

  if p_short_code is null or p_short_code !~ '^[a-z0-9]{10}$'
     or p_token_hash is null
     or p_token_hash <> encode(extensions.digest(p_short_code,'sha256'),'hex')
     or (p_expires_at is not null and p_expires_at<=pg_catalog.now())
     or (p_max_uses is not null and p_max_uses not between 1 and 500) then
    raise exception 'Invalid link settings.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_session_id::text || ':' || v_user::text,0)
  );

  select short_code into v_code
  from public.session_invite_links
  where session_id=p_session_id and created_by=v_user and revoked_at is null
  for update;

  if v_code is not null then
    if exists(
      select 1 from public.session_invite_links
      where session_id=p_session_id and created_by=v_user and revoked_at is null
        and (expires_at is null or expires_at>pg_catalog.now())
        and (max_uses is null or use_count<max_uses)
    ) then
      return v_code;
    end if;

    update public.session_invite_links
    set revoked_at=pg_catalog.now()
    where session_id=p_session_id and created_by=v_user and revoked_at is null;
  end if;

  insert into public.session_invite_links(session_id,token_hash,short_code,expires_at,max_uses,created_by)
  values(p_session_id,p_token_hash,p_short_code,p_expires_at,p_max_uses,v_user);

  return p_short_code;
end;
$function$;

revoke all on function public.create_session_invite_link(uuid,text,text,timestamptz,integer) from public, anon;
grant execute on function public.create_session_invite_link(uuid,text,text,timestamptz,integer) to authenticated;

revoke all on function public.redeem_session_invite_link(text) from public, anon;
grant execute on function public.redeem_session_invite_link(text) to authenticated;

revoke all on function public.revoke_session_invite_link(uuid) from public, anon;
grant execute on function public.revoke_session_invite_link(uuid) to authenticated;
