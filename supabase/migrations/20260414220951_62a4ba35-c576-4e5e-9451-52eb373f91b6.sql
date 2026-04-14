ALTER TABLE public.facturation 
  ADD COLUMN montant_profil_doit numeric DEFAULT NULL,
  ADD COLUMN montant_agence_doit numeric DEFAULT NULL;