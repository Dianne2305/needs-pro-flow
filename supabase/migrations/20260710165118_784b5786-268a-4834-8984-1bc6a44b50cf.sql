
-- Justificatifs bucket: remove the overly permissive ALL policy and split into safe policies
DROP POLICY IF EXISTS "Allow all uploads to justificatifs" ON storage.objects;

CREATE POLICY "Justificatifs public read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'justificatifs');

CREATE POLICY "Justificatifs public insert"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'justificatifs');

CREATE POLICY "Justificatifs authenticated update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'justificatifs')
  WITH CHECK (bucket_id = 'justificatifs');

CREATE POLICY "Justificatifs authenticated delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'justificatifs');

-- Profil-media bucket: tighten destructive/mutation policies to authenticated only
DROP POLICY IF EXISTS "Allow public delete profil-media" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update profil-media" ON storage.objects;

CREATE POLICY "Profil-media authenticated update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'profil-media')
  WITH CHECK (bucket_id = 'profil-media');

CREATE POLICY "Profil-media authenticated delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'profil-media');
