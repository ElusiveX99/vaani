-- Member profile photos and self-service profile editing.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

UPDATE public.profiles AS p
SET avatar_url = COALESCE(
  NULLIF(p.avatar_url, ''),
  NULLIF(u.raw_user_meta_data ->> 'avatar_url', ''),
  NULLIF(u.raw_user_meta_data ->> 'picture', '')
)
FROM auth.users AS u
WHERE u.id = p.id
  AND COALESCE(
    NULLIF(p.avatar_url, ''),
    NULLIF(u.raw_user_meta_data ->> 'avatar_url', ''),
    NULLIF(u.raw_user_meta_data ->> 'picture', '')
  ) IS NOT NULL;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Profile avatars are publicly readable" ON storage.objects;
CREATE POLICY "Profile avatars are publicly readable"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-avatars');

DROP POLICY IF EXISTS "Members upload their own profile avatar" ON storage.objects;
CREATE POLICY "Members upload their own profile avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS "Members update their own profile avatar" ON storage.objects;
CREATE POLICY "Members update their own profile avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
)
WITH CHECK (
  bucket_id = 'profile-avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS "Members delete their own profile avatar" ON storage.objects;
CREATE POLICY "Members delete their own profile avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS "Members can update their own profile" ON public.profiles;
CREATE POLICY "Members can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = (SELECT auth.uid()))
WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Members can create their own profile" ON public.profiles;
CREATE POLICY "Members can create their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (id = (SELECT auth.uid()));

GRANT UPDATE (display_name, avatar_url)
ON public.profiles TO authenticated;

GRANT INSERT (id, display_name, avatar_url)
ON public.profiles TO authenticated;
