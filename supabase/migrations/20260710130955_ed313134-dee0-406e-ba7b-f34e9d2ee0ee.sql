ALTER TABLE public.profils
  ADD COLUMN IF NOT EXISTS services_affectables text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS segment_affectable text DEFAULT 'tout',
  ADD COLUMN IF NOT EXISTS autre_service text;