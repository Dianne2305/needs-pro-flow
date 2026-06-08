ALTER TABLE public.demandes DROP CONSTRAINT IF EXISTS demandes_frequence_check;
ALTER TABLE public.demandes ADD CONSTRAINT demandes_frequence_check CHECK (frequence = ANY (ARRAY[
  'ponctuel'::text,
  '1_fois_semaine'::text,
  '2_fois_semaine'::text,
  '3_fois_semaine'::text,
  '4_fois_semaine'::text,
  '5_fois_semaine'::text,
  '6_fois_semaine'::text,
  'quotidien'::text,
  '1_fois_mois'::text,
  '2_fois_mois'::text,
  '3_fois_mois'::text,
  '4_fois_mois'::text,
  'hebdomadaire'::text,
  'bi_mensuel'::text,
  'mensuel'::text
]));