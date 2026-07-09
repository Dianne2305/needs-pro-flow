
-- Nouveaux champs pour la fiche profil FDM
ALTER TABLE public.profils
  ADD COLUMN IF NOT EXISTS disponibilite_calendrier jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS allergie_animaux boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pointure_chaussures integer,
  ADD COLUMN IF NOT EXISTS remarque_recruteur text,
  ADD COLUMN IF NOT EXISTS date_enregistrement timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS standby_jours integer,
  ADD COLUMN IF NOT EXISTS standby_debut timestamptz,
  ADD COLUMN IF NOT EXISTS conge_debut date,
  ADD COLUMN IF NOT EXISTS conge_fin date;

-- Backfill date_enregistrement avec created_at pour les profils existants
UPDATE public.profils
  SET date_enregistrement = created_at
  WHERE date_enregistrement IS NULL;
