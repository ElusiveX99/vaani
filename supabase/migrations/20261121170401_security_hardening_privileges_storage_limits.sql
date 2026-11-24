
begin;

-- The RLS automation trigger is invoked by PostgreSQL's event-trigger
-- machinery. It does not need to be callable through the PostgREST API.
revoke all privileges on function public.rls_auto_enable() from public;
revoke all privileges on function public.rls_auto_enable() from anon, authenticated;

-- Anonymous clients have no application-table access in Vaani.
revoke all privileges on all tables in schema public from anon;

-- Row-level security does not protect TRUNCATE, REFERENCES, or TRIGGER
-- privileges. Remove these unnecessary table-level capabilities.
revoke references, trigger, truncate on all tables in schema public
  from anon, authenticated;

-- Prevent those unnecessary privileges from being reintroduced on new
-- public tables created by the postgres migration role.
alter default privileges for role postgres in schema public
  revoke references, trigger, truncate on tables from anon, authenticated;

-- Remove a duplicate self-update policy; the equivalent policy remains.
drop policy if exists "Users can update their own profile" on public.profiles;

-- Enforce the same 45 MiB PDF limit in Storage that the uploader advertises.
update storage.buckets
set file_size_limit = 47185920,
    allowed_mime_types = array['application/pdf']::text[]
where id = 'session-pdfs';

commit;
