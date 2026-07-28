-- 1. Restrict profiles SELECT to own row; expose a minimal directory via a definer function
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE OR REPLACE FUNCTION public.get_directory_profiles()
RETURNS TABLE (id uuid, display_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.display_name, p.avatar_url
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_directory_profiles() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_directory_profiles() TO authenticated;

-- 2. Storage: ownership-based write access
DROP POLICY IF EXISTS "Justificatifs public insert" ON storage.objects;
DROP POLICY IF EXISTS "Justificatifs authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "Justificatifs authenticated delete" ON storage.objects;

CREATE POLICY "Justificatifs owner insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'justificatifs' AND owner = auth.uid());

CREATE POLICY "Justificatifs owner update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'justificatifs' AND owner = auth.uid())
WITH CHECK (bucket_id = 'justificatifs' AND owner = auth.uid());

CREATE POLICY "Justificatifs owner delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'justificatifs' AND owner = auth.uid());

DROP POLICY IF EXISTS "Allow public insert profil-media" ON storage.objects;
DROP POLICY IF EXISTS "Profil-media authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "Profil-media authenticated delete" ON storage.objects;

CREATE POLICY "Profil-media owner insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'profil-media' AND owner = auth.uid());

CREATE POLICY "Profil-media owner update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'profil-media' AND owner = auth.uid())
WITH CHECK (bucket_id = 'profil-media' AND owner = auth.uid());

CREATE POLICY "Profil-media owner delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'profil-media' AND owner = auth.uid());