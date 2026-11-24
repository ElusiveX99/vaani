
begin;
create index if not exists session_documents_uploaded_by_idx
  on public.session_documents (uploaded_by);
create index if not exists session_messages_sender_id_idx
  on public.session_messages (sender_id);
create index if not exists session_reader_state_document_session_idx
  on public.session_reader_state (session_id, current_document_id);
create index if not exists session_reader_state_updated_by_idx
  on public.session_reader_state (updated_by);
create index if not exists sessions_created_by_idx
  on public.sessions (created_by);

drop policy if exists "Accepted members can send session messages"
  on public.session_messages;
create policy "Accepted members can send session messages"
  on public.session_messages
  for insert to authenticated
  with check (
    private.is_accepted_member(session_id)
    and sender_id = (select auth.uid())
  );
commit;
