-- Add new workflow columns to demandes
ALTER TABLE public.demandes 
  ADD COLUMN IF NOT EXISTS avec_produit boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS statut_candidature text DEFAULT null,
  ADD COLUMN IF NOT EXISTS candidat_nom text DEFAULT null,
  ADD COLUMN IF NOT EXISTS candidat_telephone text DEFAULT null,
  ADD COLUMN IF NOT EXISTS candidat_photo_url text DEFAULT null,
  ADD COLUMN IF NOT EXISTS confirmation_ope text DEFAULT null,
  ADD COLUMN IF NOT EXISTS motif_annulation text DEFAULT null,
  ADD COLUMN IF NOT EXISTS date_report date DEFAULT null;

-- Drop existing constraint if any
ALTER TABLE public.demandes DROP CONSTRAINT IF EXISTS demandes_statut_check;

-- Add updated constraint with all statuses
ALTER TABLE public.demandes ADD CONSTRAINT demandes_statut_check 
CHECK (statut IN ('en_attente', 'confirmee', 'rejetee', 'cloturee', 'standby', 'annulee', 'nrp', 'en_cours', 'en_attente_profil', 'confirme_intervention', 'prestation_effectuee', 'paye'));