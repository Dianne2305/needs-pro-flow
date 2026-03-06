
-- Change formation_requise from boolean to text
ALTER TABLE public.profils ALTER COLUMN formation_requise TYPE text USING CASE WHEN formation_requise THEN 'Oui' ELSE NULL END;

-- Create storage bucket for profile media
INSERT INTO storage.buckets (id, name, public) VALUES ('profil-media', 'profil-media', true) ON CONFLICT DO NOTHING;

-- RLS policy for profil-media bucket
CREATE POLICY "Allow public read profil-media" ON storage.objects FOR SELECT USING (bucket_id = 'profil-media');
CREATE POLICY "Allow public insert profil-media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'profil-media');
CREATE POLICY "Allow public update profil-media" ON storage.objects FOR UPDATE USING (bucket_id = 'profil-media');
CREATE POLICY "Allow public delete profil-media" ON storage.objects FOR DELETE USING (bucket_id = 'profil-media');
