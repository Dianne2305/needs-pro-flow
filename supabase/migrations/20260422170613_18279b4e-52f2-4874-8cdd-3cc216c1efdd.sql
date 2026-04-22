
ALTER TABLE public.campagnes_marketing
  ADD COLUMN IF NOT EXISTS cible text NOT NULL DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS critere_ciblage text DEFAULT 'tous',
  ADD COLUMN IF NOT EXISTS ville_ciblage text DEFAULT 'Casablanca',
  ADD COLUMN IF NOT EXISTS heure_debut time DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS heure_fin time DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS date_diffusion date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS nombre_destinataires_jour integer DEFAULT 0;
