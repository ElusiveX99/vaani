create table if not exists public.library_documents (
  id uuid primary key default gen_random_uuid(), title text not null, description text,
  storage_path text not null unique, mime_type text not null default 'application/pdf',
  size_bytes bigint not null, is_published boolean not null default false,
  is_archived boolean not null default false, display_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (mime_type = 'application/pdf'), check (size_bytes > 0 and size_bytes <= 47185920)
);
create index if not exists library_documents_published_order_idx on public.library_documents (display_order, created_at) where is_published = true and is_archived = false;
alter table public.session_documents add column if not exists library_document_id uuid references public.library_documents(id) on delete restrict;
create index if not exists session_documents_library_document_id_idx on public.session_documents (library_document_id) where library_document_id is not null;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('vaani-library-pdfs','vaani-library-pdfs',false,47185920,array['application/pdf'])
on conflict (id) do update set public=false,file_size_limit=47185920,allowed_mime_types=array['application/pdf'];
alter table public.library_documents enable row level security;
drop policy if exists "Members can view published library documents" on public.library_documents;
create policy "Members can view published library documents" on public.library_documents for select to authenticated using (is_published=true and is_archived=false);
create or replace function public.library_documents_updated_at() returns trigger language plpgsql set search_path to ''
as $func$ begin new.updated_at=now(); return new; end; $func$;
drop trigger if exists library_documents_updated_at on public.library_documents;
create trigger library_documents_updated_at before update on public.library_documents for each row execute function public.library_documents_updated_at();
create or replace function public.add_library_document_to_session(p_session_id uuid,p_library_document_id uuid) returns uuid
language plpgsql security definer set search_path to ''
as $func$
declare v_document_id uuid;
begin
 if not exists (select 1 from public.session_members where session_id=p_session_id and user_id=(select auth.uid()) and status='accepted' and role::text in ('organizer','in_charge','admin')) then raise exception 'You cannot manage this session library' using errcode='42501'; end if;
 if not exists (select 1 from public.library_documents where id=p_library_document_id and is_published=true and is_archived=false) then raise exception 'Library document not found' using errcode='P0002'; end if;
 select id into v_document_id from public.session_documents where session_id=p_session_id and library_document_id=p_library_document_id limit 1;
 if v_document_id is not null then return v_document_id; end if;
 insert into public.session_documents(session_id,title,storage_path,mime_type,size_bytes,uploaded_by,is_active,display_order,library_document_id)
 select p_session_id,title,storage_path,mime_type,size_bytes,(select auth.uid()),true,
 coalesce((select max(display_order)+1 from public.session_documents where session_id=p_session_id),0),id
 from public.library_documents where id=p_library_document_id returning id into v_document_id;
 return v_document_id;
end; $func$;
revoke all on function public.add_library_document_to_session(uuid,uuid) from public;
grant execute on function public.add_library_document_to_session(uuid,uuid) to authenticated;
comment on column public.session_documents.library_document_id is 'References a shared Vaani Library PDF; session deletion never removes the shared library object.';
