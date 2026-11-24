-- Provision the private Storage bucket used by gathering PDF uploads.
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES (
  'session-pdfs',
  'session-pdfs',
  false,
  47185920,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE
SET name=EXCLUDED.name,
    public=EXCLUDED.public,
    file_size_limit=EXCLUDED.file_size_limit,
    allowed_mime_types=EXCLUDED.allowed_mime_types;
