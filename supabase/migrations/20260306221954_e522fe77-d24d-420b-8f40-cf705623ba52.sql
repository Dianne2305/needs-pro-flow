
-- Table des offres/codes promo
CREATE TABLE public.offres_marketing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  type text NOT NULL DEFAULT 'code_promo', -- code_promo, offre_speciale
  code_promo text,
  type_reduction text NOT NULL DEFAULT 'pourcentage', -- pourcentage, montant_fixe
  valeur_reduction numeric NOT NULL DEFAULT 0,
  services_concernes jsonb DEFAULT '[]'::jsonb,
  segment_client text DEFAULT 'tous',
  limite_utilisation integer, -- null = illimité
  nombre_utilisations integer DEFAULT 0,
  date_debut date NOT NULL DEFAULT CURRENT_DATE,
  date_fin date,
  statut text NOT NULL DEFAULT 'active', -- active, planifiee, expiree, desactivee
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.offres_marketing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to offres_marketing" ON public.offres_marketing FOR ALL USING (true) WITH CHECK (true);

-- Table des gestes commerciaux
CREATE TABLE public.gestes_commerciaux (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_nom text NOT NULL,
  client_telephone text,
  demande_id uuid REFERENCES public.demandes(id),
  type_geste text NOT NULL, -- reduction_prochaine, credit_compte, intervention_gratuite, code_promo_perso
  montant numeric,
  pourcentage numeric,
  raison text,
  commentaire text,
  cree_par text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gestes_commerciaux ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to gestes_commerciaux" ON public.gestes_commerciaux FOR ALL USING (true) WITH CHECK (true);

-- Table des campagnes marketing
CREATE TABLE public.campagnes_marketing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  segment_cible text NOT NULL DEFAULT 'tous',
  canal text NOT NULL DEFAULT 'whatsapp', -- whatsapp, email, sms
  message text,
  nombre_destinataires integer DEFAULT 0,
  nombre_envoyes integer DEFAULT 0,
  statut text NOT NULL DEFAULT 'brouillon', -- brouillon, planifiee, envoyee
  date_envoi timestamptz,
  offre_id uuid REFERENCES public.offres_marketing(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campagnes_marketing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to campagnes_marketing" ON public.campagnes_marketing FOR ALL USING (true) WITH CHECK (true);
