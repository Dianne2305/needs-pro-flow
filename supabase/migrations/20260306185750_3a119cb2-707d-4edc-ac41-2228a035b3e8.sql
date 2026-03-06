
ALTER TABLE public.demandes DROP CONSTRAINT IF EXISTS demandes_statut_check;
ALTER TABLE public.demandes ADD CONSTRAINT demandes_statut_check CHECK (statut IN ('en_cours', 'en_attente', 'en_attente_confirmation', 'confirme', 'confirme_intervention', 'prestation_effectuee', 'paye', 'annulee', 'standby', 'nrp', 'en_attente_profil', 'facturation_annulee', 'facturation_en_cours', 'facturation_partielle', 'rejetee', 'cloturee'));
