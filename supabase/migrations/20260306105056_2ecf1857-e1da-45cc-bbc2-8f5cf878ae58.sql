
-- Create facturation table for financial tracking
CREATE TABLE public.facturation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  num_mission serial NOT NULL,
  demande_id uuid REFERENCES public.demandes(id) ON DELETE CASCADE NOT NULL,
  profil_id uuid REFERENCES public.profils(id) ON DELETE SET NULL,
  profil_nom text,
  nom_client text NOT NULL,
  ville text DEFAULT 'Casablanca',
  type_service text,
  date_intervention date,
  montant_total numeric NOT NULL DEFAULT 0,
  commission_pourcentage numeric NOT NULL DEFAULT 50,
  mode_paiement_prevu text,
  statut_mission text NOT NULL DEFAULT 'confirmee',
  -- Paiement client
  montant_paye_client numeric DEFAULT 0,
  mode_paiement_reel text,
  date_paiement_client date,
  justificatif_url text,
  statut_paiement text NOT NULL DEFAULT 'non_paye',
  -- Répartition interne
  encaisse_par text DEFAULT 'agence',
  montant_encaisse_profil numeric DEFAULT 0,
  part_agence_reversee boolean DEFAULT false,
  date_remise_agence date,
  part_profil_versee boolean DEFAULT false,
  date_versement_profil date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facturation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to facturation" ON public.facturation FOR ALL USING (true) WITH CHECK (true);

-- Storage bucket for justificatifs
INSERT INTO storage.buckets (id, name, public) VALUES ('justificatifs', 'justificatifs', true);

CREATE POLICY "Allow all uploads to justificatifs" ON storage.objects FOR ALL USING (bucket_id = 'justificatifs') WITH CHECK (bucket_id = 'justificatifs');
