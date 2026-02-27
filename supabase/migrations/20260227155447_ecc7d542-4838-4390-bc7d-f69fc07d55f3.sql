
ALTER TABLE public.demandes DROP CONSTRAINT IF EXISTS demandes_statut_check;
ALTER TABLE public.demandes ADD CONSTRAINT demandes_statut_check CHECK (statut IN ('en_attente', 'confirmee', 'rejetee', 'cloturee', 'standby', 'annulee', 'nrp'));
