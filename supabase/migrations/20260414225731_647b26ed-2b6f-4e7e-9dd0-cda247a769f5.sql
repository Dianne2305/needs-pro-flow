ALTER TABLE public.demandes DROP CONSTRAINT demandes_statut_check;

ALTER TABLE public.demandes ADD CONSTRAINT demandes_statut_check CHECK (statut = ANY (ARRAY[
  'en_attente', 'nouveau_besoin', 'en_cours',
  'en_attente_confirmation', 'en_attente_profil',
  'confirme', 'confirme_intervention',
  'prestation_en_cours', 'prestation_terminee', 'prestation_effectuee',
  'facturation_en_cours', 'facturation_partielle',
  'paye', 'facturation_annulee', 'annulee',
  'standby', 'cloturee', 'nrp', 'rejetee', 'confirmee'
]));