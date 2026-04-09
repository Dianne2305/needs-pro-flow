ALTER TABLE public.facturation 
ADD COLUMN IF NOT EXISTS commercial text DEFAULT null,
ADD COLUMN IF NOT EXISTS commentaire text DEFAULT null,
ADD COLUMN IF NOT EXISTS tva_pourcentage numeric NOT NULL DEFAULT 20;