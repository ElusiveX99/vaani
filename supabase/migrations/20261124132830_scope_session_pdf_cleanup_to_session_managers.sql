DROP POLICY IF EXISTS "Session managers can delete session PDFs" ON storage.objects;
CREATE POLICY "Session managers can delete session PDFs"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'session-pdfs'
  AND cardinality(storage.foldername(name)) = 2
  AND EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id::text = (storage.foldername(objects.name))[1]
      AND private.can_manage_session(s.id)
  )
);
