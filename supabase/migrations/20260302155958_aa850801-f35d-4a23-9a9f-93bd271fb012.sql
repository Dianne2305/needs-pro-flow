
ALTER TABLE demandes 
  ADD COLUMN superficie_m2 numeric,
  ADD COLUMN etat_logement text,
  ADD COLUMN type_salissure text,
  ADD COLUMN nature_intervention text,
  ADD COLUMN description_intervention text,
  ADD COLUMN services_optionnels jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN nom_entreprise text,
  ADD COLUMN contact_entreprise text,
  ADD COLUMN email text,
  ADD COLUMN preference_horaire text,
  ADD COLUMN flexibilite_horaire text;
