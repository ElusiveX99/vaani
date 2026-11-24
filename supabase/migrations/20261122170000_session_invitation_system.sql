-- Invitation links and account-bound invitations are created by the gathering manager.
-- Token values are never stored; only SHA-256 token hashes are stored.
create table if not exists public.session_invite_links (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  token_hash text not null unique,
  label text,
  max_uses integer,
  use_count integer not null default 0,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint session_invite_links_max_uses_check check (max_uses is null or max_uses between 1 and 500),
  constraint session_invite_links_label_check check (label is null or char_length(label) <= 80)
);
create table if not exists public.session_invitations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  status text not null default 'pending',
  invited_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint session_invitations_status_check check (status in ('pending','accepted','declined','revoked')),
  constraint session_invitations_email_check check (char_length(trim(email)) between 3 and 320)
);
create index if not exists session_invite_links_session_idx on public.session_invite_links(session_id, created_at desc);
create index if not exists session_invitations_user_idx on public.session_invitations(user_id, created_at desc);
alter table public.session_invite_links enable row level security;
alter table public.session_invitations enable row level security;
drop policy if exists "Session managers can view invite links" on public.session_invite_links;
create policy "Session managers can view invite links" on public.session_invite_links for select to authenticated using (private.can_manage_session(session_id));
drop policy if exists "Session managers can delete invite links" on public.session_invite_links;
create policy "Session managers can delete invite links" on public.session_invite_links for delete to authenticated using (private.can_manage_session(session_id));
drop policy if exists "Users can view their invitations" on public.session_invitations;
create policy "Users can view their invitations" on public.session_invitations for select to authenticated using ((select auth.uid()) = user_id or private.can_manage_session(session_id));
create or replace function public.create_session_invite_link(p_session_id uuid,p_token_hash text,p_label text default null,p_expires_at timestamptz default null,p_max_uses integer default null) returns uuid language plpgsql security definer set search_path to '' as $$
declare v_user_id uuid := (select auth.uid()); v_id uuid;
begin
 if v_user_id is null then raise exception 'Authentication required.'; end if;
 if not private.can_manage_session(p_session_id) then raise exception 'You cannot manage this session.'; end if;
 if p_token_hash is null or char_length(p_token_hash) <> 64 then raise exception 'Invalid invitation token.'; end if;
 if p_expires_at is not null and p_expires_at <= now() then raise exception 'Invitation expiry must be in the future.'; end if;
 insert into public.session_invite_links(session_id,token_hash,label,expires_at,max_uses,created_by) values(p_session_id,p_token_hash,nullif(trim(p_label),''),p_expires_at,p_max_uses,v_user_id) returning id into v_id; return v_id;
end $$;
create or replace function public.redeem_session_invite_link(p_token text) returns uuid language plpgsql security definer set search_path to '' as $$
declare v_user_id uuid := (select auth.uid()); v_link public.session_invite_links%rowtype; v_status public.session_status; v_membership_id uuid;
begin
 if v_user_id is null then raise exception 'Authentication required.'; end if;
 select * into v_link from public.session_invite_links where token_hash=encode(extensions.digest(trim(p_token),'sha256'),'hex') for update;
 if not found or v_link.revoked_at is not null or (v_link.expires_at is not null and v_link.expires_at<=now()) or (v_link.max_uses is not null and v_link.use_count>=v_link.max_uses) then raise exception 'Invitation link is invalid or has expired.'; end if;
 select status into v_status from public.sessions where id=v_link.session_id;
 if not found or v_status not in ('scheduled','live') then raise exception 'This gathering is not accepting invitations.'; end if;
 insert into public.session_members(session_id,user_id,role,status) values(v_link.session_id,v_user_id,'participant','accepted')
 on conflict(session_id,user_id) do update set role='participant',status='accepted' where public.session_members.role='participant' and public.session_members.status in ('invited','declined','removed')
 returning id into v_membership_id;
 if v_membership_id is null then select id into v_membership_id from public.session_members where session_id=v_link.session_id and user_id=v_user_id; end if;
 if v_membership_id is null then raise exception 'You cannot join this gathering.'; end if;
 if v_membership_id is not null and exists(select 1 from public.session_members where id=v_membership_id and status='accepted') then update public.session_invite_links set use_count=use_count+1 where id=v_link.id and not exists(select 1 from public.session_members where id=v_membership_id and status='accepted' and created_at < now()); end if;
 return v_link.session_id;
end $$;
create or replace function public.invite_user_to_session(p_session_id uuid,p_email text) returns uuid language plpgsql security definer set search_path to '' as $$
declare v_actor uuid := (select auth.uid()); v_target uuid; v_id uuid;
begin
 if v_actor is null or not private.can_manage_session(p_session_id) then raise exception 'You cannot manage this session.'; end if;
 select id into v_target from auth.users where lower(email)=lower(trim(p_email)) limit 1;
 if v_target is null then raise exception 'No Vaani account was found for that email address.'; end if;
 insert into public.session_members(session_id,user_id,role,status) values(p_session_id,v_target,'participant','invited')
 on conflict(session_id,user_id) do update set role='participant',status='invited' where public.session_members.role='participant' and public.session_members.status in ('declined','removed')
 returning id into v_id;
 if v_id is null then select id into v_id from public.session_members where session_id=p_session_id and user_id=v_target and status='invited'; end if;
 if v_id is null then raise exception 'This member is already part of the gathering.'; end if;
 insert into public.session_invitations(session_id,user_id,email,invited_by,status) values(p_session_id,v_target,lower(trim(p_email)),v_actor,'pending')
 on conflict(session_id,user_id) do update set email=excluded.email,invited_by=excluded.invited_by,status='pending',responded_at=null;
 return v_id;
end $$;
create or replace function public.revoke_session_invitation(p_session_id uuid,p_user_id uuid) returns boolean language plpgsql security definer set search_path to '' as $$
begin
 if (select auth.uid()) is null or not private.can_manage_session(p_session_id) then raise exception 'You cannot manage this session.'; end if;
 update public.session_members set status='removed' where session_id=p_session_id and user_id=p_user_id and role='participant' and status in ('invited','accepted');
 update public.session_invitations set status='revoked',responded_at=now() where session_id=p_session_id and user_id=p_user_id and status='pending';
 return true;
end $$;
revoke all on function public.create_session_invite_link(uuid,text,text,timestamptz,integer) from public;
revoke all on function public.redeem_session_invite_link(text) from public;
revoke all on function public.invite_user_to_session(uuid,text) from public;
revoke all on function public.revoke_session_invitation(uuid,uuid) from public;
grant execute on function public.create_session_invite_link(uuid,text,text,timestamptz,integer) to authenticated;
grant execute on function public.redeem_session_invite_link(text) to authenticated;
grant execute on function public.invite_user_to_session(uuid,text) to authenticated;
grant execute on function public.revoke_session_invitation(uuid,uuid) to authenticated;
