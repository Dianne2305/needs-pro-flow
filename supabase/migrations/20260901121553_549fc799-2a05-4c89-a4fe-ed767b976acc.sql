CREATE TABLE public.airbnb_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  type_client text NOT NULL DEFAULT 'conciergerie',
  trigramme text,
  telephone text,
  email text,
  ville text NOT NULL DEFAULT 'Casablanca',
  mode_paiement text NOT NULL DEFAULT 'passage',
  commercial text,
  date_demarrage date,
  contrat_signe boolean NOT NULL DEFAULT false,
  probatoire boolean NOT NULL DEFAULT true,
  statut text NOT NULL DEFAULT 'actif',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.airbnb_clients TO authenticated;
GRANT ALL ON public.airbnb_clients TO service_role;
ALTER TABLE public.airbnb_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "airbnb_clients_authenticated" ON public.airbnb_clients FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.airbnb_biens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.airbnb_clients(id) ON DELETE CASCADE,
  code text NOT NULL,
  quartier text,
  ville text NOT NULL DEFAULT 'Casablanca',
  typologie text NOT NULL DEFAULT 'Studio',
  adresse text,
  acces_type text,
  acces_details text,
  zone_eloignee boolean NOT NULL DEFAULT false,
  services text NOT NULL DEFAULT 'menage',
  tarif_base numeric NOT NULL DEFAULT 0,
  ical_url text,
  sets_rechange integer NOT NULL DEFAULT 2,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.airbnb_biens TO authenticated;
GRANT ALL ON public.airbnb_biens TO service_role;
ALTER TABLE public.airbnb_biens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "airbnb_biens_authenticated" ON public.airbnb_biens FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.airbnb_commandes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  client_id uuid REFERENCES public.airbnb_clients(id) ON DELETE SET NULL,
  bien_id uuid REFERENCES public.airbnb_biens(id) ON DELETE SET NULL,
  date_intervention date NOT NULL,
  heure_intervention time,
  nature_linge text NOT NULL DEFAULT 'aucun',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  montant_menage numeric NOT NULL DEFAULT 0,
  montant_zone numeric NOT NULL DEFAULT 0,
  montant_options numeric NOT NULL DEFAULT 0,
  montant_linge numeric NOT NULL DEFAULT 0,
  montant_linge_abime numeric NOT NULL DEFAULT 0,
  statut text NOT NULL DEFAULT 'brouillon',
  photos_recues boolean NOT NULL DEFAULT false,
  comptage_valide boolean NOT NULL DEFAULT false,
  intervenante text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.airbnb_commandes TO authenticated;
GRANT ALL ON public.airbnb_commandes TO service_role;
ALTER TABLE public.airbnb_commandes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "airbnb_commandes_authenticated" ON public.airbnb_commandes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.airbnb_comptages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id uuid REFERENCES public.airbnb_commandes(id) ON DELETE CASCADE,
  bien_code text,
  quantites jsonb NOT NULL DEFAULT '{}'::jsonb,
  quantites_laverie jsonb,
  total_pieces integer NOT NULL DEFAULT 0,
  sets integer NOT NULL DEFAULT 0,
  pieces_supp integer NOT NULL DEFAULT 0,
  ecart integer NOT NULL DEFAULT 0,
  montant numeric NOT NULL DEFAULT 0,
  montant_fige boolean NOT NULL DEFAULT false,
  etape text NOT NULL DEFAULT 'recu',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.airbnb_comptages TO authenticated;
GRANT ALL ON public.airbnb_comptages TO service_role;
ALTER TABLE public.airbnb_comptages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "airbnb_comptages_authenticated" ON public.airbnb_comptages FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.airbnb_signalements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id uuid REFERENCES public.airbnb_commandes(id) ON DELETE CASCADE,
  categorie text NOT NULL DEFAULT 'linge',
  motif text,
  description text,
  nb_pieces integer NOT NULL DEFAULT 0,
  facture boolean NOT NULL DEFAULT false,
  montant numeric NOT NULL DEFAULT 0,
  photo_url text,
  statut text NOT NULL DEFAULT 'en_attente',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.airbnb_signalements TO authenticated;
GRANT ALL ON public.airbnb_signalements TO service_role;
ALTER TABLE public.airbnb_signalements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "airbnb_signalements_authenticated" ON public.airbnb_signalements FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.airbnb_factures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  client_id uuid REFERENCES public.airbnb_clients(id) ON DELETE SET NULL,
  client_nom text,
  mode text NOT NULL DEFAULT 'passage',
  periode_debut date,
  periode_fin date,
  date_emission date,
  date_echeance date,
  montant numeric NOT NULL DEFAULT 0,
  statut text NOT NULL DEFAULT 'emise',
  date_paiement date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.airbnb_factures TO authenticated;
GRANT ALL ON public.airbnb_factures TO service_role;
ALTER TABLE public.airbnb_factures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "airbnb_factures_authenticated" ON public.airbnb_factures FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.airbnb_parametres (
  id integer PRIMARY KEY DEFAULT 1,
  grille jsonb NOT NULL DEFAULT '[]'::jsonb,
  zones jsonb NOT NULL DEFAULT '[]'::jsonb,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  set_composition jsonb NOT NULL DEFAULT '{}'::jsonb,
  tarif_set numeric NOT NULL DEFAULT 50,
  tarif_piece numeric NOT NULL DEFAULT 5,
  minimum_linge numeric NOT NULL DEFAULT 50,
  delai_paiement_jours integer NOT NULL DEFAULT 4,
  seuil_conciergerie integer NOT NULL DEFAULT 3,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.airbnb_parametres TO authenticated;
GRANT ALL ON public.airbnb_parametres TO service_role;
ALTER TABLE public.airbnb_parametres ENABLE ROW LEVEL SECURITY;
CREATE POLICY "airbnb_parametres_authenticated" ON public.airbnb_parametres FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.airbnb_parametres (id) VALUES (1) ON CONFLICT DO NOTHING;