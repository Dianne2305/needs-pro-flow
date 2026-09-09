ALTER TABLE public.demandes
  ADD COLUMN IF NOT EXISTS montant_virement numeric,
  ADD COLUMN IF NOT EXISTS montant_especes numeric,
  ADD COLUMN IF NOT EXISTS especes_recupere_par text,
  ADD COLUMN IF NOT EXISTS reste_recupere_par text;