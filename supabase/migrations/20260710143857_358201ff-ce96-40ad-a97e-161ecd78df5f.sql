ALTER TABLE public.profils ADD COLUMN IF NOT EXISTS fume text DEFAULT 'non';

GRANT SELECT, INSERT, UPDATE ON public.profils TO authenticated;
GRANT ALL ON public.profils TO service_role;