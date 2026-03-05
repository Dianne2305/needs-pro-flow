
CREATE TABLE public.profils (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  nom text NOT NULL,
  prenom text NOT NULL,
  quartier text,
  ville text DEFAULT 'Casablanca',
  numero_cin text,
  date_naissance date,
  sexe text,
  telephone text,
  whatsapp text,
  situation_matrimoniale text,
  a_des_enfants boolean DEFAULT false,
  nationalite text DEFAULT 'Marocaine',
  langue jsonb DEFAULT '[]'::jsonb,
  niveau_etude text,
  experience_annees integer DEFAULT 0,
  experience_mois integer DEFAULT 0,
  statut_profil text DEFAULT 'disponible',
  type_profil text,
  formation_requise boolean DEFAULT false,
  sait_lire_ecrire boolean DEFAULT false,
  maladie_handicap text,
  presentation_physique text,
  corpulence text,
  dispo_urgences boolean DEFAULT false,
  dispo_journee boolean DEFAULT false,
  dispo_soiree boolean DEFAULT false,
  dispo_7j7 boolean DEFAULT false,
  dispo_jours_feries boolean DEFAULT false,
  note_operateur text,
  photo_url text,
  cin_url text,
  attestation_url text,
  experiences jsonb DEFAULT '[]'::jsonb
);

ALTER TABLE public.profils ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to profils" ON public.profils
  FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.profil_historique (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profil_id uuid REFERENCES public.profils(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL,
  note text,
  utilisateur text
);

ALTER TABLE public.profil_historique ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to profil_historique" ON public.profil_historique
  FOR ALL USING (true) WITH CHECK (true);
