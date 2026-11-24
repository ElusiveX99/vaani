
-- Remove email-based member invitations while retaining private account-to-account invitations.
alter table public.session_invitations
  drop constraint if exists session_invitations_email_check;
alter table public.session_invitations
  drop column if exists email;

create or replace function public.invite_session_member(p_session_id uuid, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_status text;
  v_invitation_id uuid;
begin
  if v_actor is null then
    raise exception using errcode='42501', message='Authentication required.';
  end if;
  if p_user_id is null or p_user_id=v_actor then
    raise exception using errcode='22023', message='Choose another Vaani member.';
  end if;
  if not private.can_manage_session(p_session_id) then
    raise exception using errcode='42501', message='Only gathering managers can invite members.';
  end if;

  perform 1 from public.sessions
    where id=p_session_id and status in ('scheduled','live') and not is_draft
    for update;
  if not found then
    raise exception 'This gathering is not accepting invitations.';
  end if;
  if not exists(select 1 from auth.users where id=p_user_id) then
    raise exception using errcode='22023', message='Vaani member not found.';
  end if;

  select status::text into v_status
    from public.session_members
    where session_id=p_session_id and user_id=p_user_id and role='participant'
    for update;

  if v_status='accepted' then
    raise exception 'This member has already joined the gathering.';
  elsif v_status='invited' then
    null;
  else
    insert into public.session_members(session_id,user_id,role,status)
    values(p_session_id,p_user_id,'participant','invited')
    on conflict(session_id,user_id) do update
      set status='invited'
      where public.session_members.role='participant'
        and public.session_members.status in ('declined','removed');
    if not found then
      raise exception 'This member cannot be invited to the gathering.';
    end if;
  end if;

  select id into v_invitation_id
    from public.session_invitations
    where session_id=p_session_id and user_id=p_user_id and status='pending'
    order by created_at desc limit 1 for update;

  if v_invitation_id is null then
    insert into public.session_invitations(session_id,user_id,status,invited_by)
    values(p_session_id,p_user_id,'pending',v_actor)
    returning id into v_invitation_id;
  else
    update public.session_invitations
      set invited_by=v_actor, created_at=now(), responded_at=null
      where id=v_invitation_id;
  end if;

  return v_invitation_id;
end;
$function$;

revoke all on function public.invite_session_member(uuid,uuid) from public, anon;
grant execute on function public.invite_session_member(uuid,uuid) to authenticated;
drop function if exists public.invite_user_to_session(uuid,text);

create or replace function public.create_session_invite_link(
  p_session_id uuid,
  p_token_hash text,
  p_label text default null,
  p_expires_at timestamptz default null,
  p_max_uses integer default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid := (select auth.uid());
  v_session public.sessions%rowtype;
  v_allowed boolean := false;
  v_id uuid;
begin
  if v_user is null then
    raise exception using errcode='42501', message='Authentication required.';
  end if;
  select * into v_session from public.sessions
    where id=p_session_id and status in ('scheduled','live') and not is_draft
    for update;
  if not found then
    raise exception 'This gathering is not accepting invitation links.';
  end if;
  if v_session.access_type <> 'link' then
    raise exception using errcode='42501', message='Invitation links are only available for link-access gatherings.';
  end if;
  if private.can_manage_session(p_session_id) then
    v_allowed := true;
  else
    select exists(
      select 1 from public.session_members m
      where m.session_id=p_session_id and m.user_id=v_user
        and m.role='participant' and m.status='accepted'
    ) and v_session.allow_participant_invites into v_allowed;
  end if;
  if not v_allowed then
    raise exception using errcode='42501', message='You cannot create invitation links for this gathering.';
  end if;
  if p_token_hash is null or char_length(p_token_hash)<>64 then
    raise exception using errcode='22023', message='Invalid invitation token.';
  end if;
  if p_expires_at is not null and p_expires_at<=now() then
    raise exception using errcode='22023', message='Invitation expiry must be in the future.';
  end if;
  if p_max_uses is not null and p_max_uses not between 1 and 500 then
    raise exception using errcode='22023', message='Invalid invitation use limit.';
  end if;
  insert into public.session_invite_links(session_id,token_hash,label,expires_at,max_uses,created_by)
  values(p_session_id,p_token_hash,nullif(trim(p_label),''),p_expires_at,p_max_uses,v_user)
  returning id into v_id;
  return v_id;
end;
$function$;

revoke all on function public.create_session_invite_link(uuid,text,text,timestamptz,integer) from public,anon;
grant execute on function public.create_session_invite_link(uuid,text,text,timestamptz,integer) to authenticated;

create or replace function public.redeem_session_invite_link(p_token text)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_link public.session_invite_links%rowtype;
  v_session public.sessions%rowtype;
  v_membership_id uuid;
  v_existing_status text;
  v_count integer;
begin
  if v_user_id is null then
    raise exception using errcode='42501', message='Authentication required.';
  end if;
  if p_token is null or char_length(p_token)<32 or char_length(p_token)>128 then
    raise exception using errcode='22023', message='Invalid invitation link.';
  end if;
  select * into v_link
    from public.session_invite_links
    where token_hash=encode(extensions.digest(trim(p_token),'sha256'),'hex')
    for update;
  if not found or v_link.revoked_at is not null
     or (v_link.expires_at is not null and v_link.expires_at<=now())
     or (v_link.max_uses is not null and v_link.use_count>=v_link.max_uses) then
    raise exception 'Invitation link is invalid or has expired.';
  end if;
  select * into v_session from public.sessions
    where id=v_link.session_id for update;
  if not found or v_session.status not in ('scheduled','live') or v_session.is_draft then
    raise exception 'This gathering is not accepting invitations.';
  end if;
  if v_session.access_type <> 'link' then
    raise exception using errcode='42501', message='This gathering does not accept invitation links.';
  end if;

  select status::text into v_existing_status
    from public.session_members
    where session_id=v_link.session_id and user_id=v_user_id
    for update;
  if v_existing_status='accepted' then
    return v_link.session_id;
  end if;

  select count(*) into v_count from public.session_members
    where session_id=v_link.session_id and status='accepted';
  if v_session.participant_limit is not null and v_count>=v_session.participant_limit then
    raise exception 'This gathering is full.';
  end if;

  insert into public.session_members(session_id,user_id,role,status)
  values(v_link.session_id,v_user_id,'participant','accepted')
  on conflict(session_id,user_id) do update
    set role='participant',status='accepted'
    where public.session_members.role='participant'
      and public.session_members.status in ('invited','declined','removed')
  returning id into v_membership_id;
  if v_membership_id is null then
    raise exception 'You cannot join this gathering.';
  end if;

  update public.session_invite_links set use_count=use_count+1 where id=v_link.id;
  return v_link.session_id;
end;
$function$;

revoke all on function public.redeem_session_invite_link(text) from public,anon;
grant execute on function public.redeem_session_invite_link(text) to authenticated;

create or replace function public.delete_cancelled_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $function$
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Authentication required.';
  end if;
  if not private.is_session_organizer(p_session_id) then
    raise exception using errcode='42501', message='Only the organizer can permanently delete this gathering.';
  end if;
  delete from public.sessions
    where id=p_session_id and status='cancelled' and is_draft=false;
  if not found then
    raise exception 'Only cancelled gatherings can be permanently deleted.';
  end if;
end;
$function$;

revoke all on function public.delete_cancelled_session(uuid) from public,anon;
grant execute on function public.delete_cancelled_session(uuid) to authenticated;
