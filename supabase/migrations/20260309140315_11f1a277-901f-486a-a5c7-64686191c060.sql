ALTER TABLE public.demandes ADD COLUMN IF NOT EXISTS statut_paiement_commercial text DEFAULT 'non_paye';
ALTER TABLE public.demandes ADD COLUMN IF NOT EXISTS montant_verse_client numeric DEFAULT NULL;