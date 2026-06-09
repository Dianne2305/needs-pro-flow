-- Backfill profiles for existing auth users
INSERT INTO public.profiles (id, display_name)
SELECT u.id, COALESCE(u.raw_user_meta_data->>'display_name', u.email)
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

-- Backfill created_by_name on existing facturation rows using any available profile
UPDATE public.facturation f
SET created_by_name = COALESCE(
  (SELECT display_name FROM public.profiles ORDER BY updated_at DESC NULLS LAST LIMIT 1),
  'Utilisateur'
)
WHERE f.created_by_name IS NULL AND f.profil_id IS NOT NULL;