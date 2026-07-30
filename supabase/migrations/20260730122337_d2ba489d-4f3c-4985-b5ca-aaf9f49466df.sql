DROP POLICY IF EXISTS "Justificatifs public read" ON storage.objects;

CREATE POLICY "Justificatifs authenticated read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'justificatifs');