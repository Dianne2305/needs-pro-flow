CREATE TABLE public.supplements_especes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  demande_id uuid REFERENCES public.demandes(id) ON DELETE SET NULL,
  profil_id uuid REFERENCES public.profils(id) ON DELETE SET NULL,
  profil_nom text,
  nom_client text,
  ville text,
  type_service text,
  date_recuperation date NOT NULL DEFAULT CURRENT_DATE,
  montant numeric NOT NULL DEFAULT 0,
  recupere boolean NOT NULL DEFAULT false,
  commentaire text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplements_especes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplements_especes TO anon;
GRANT ALL ON public.supplements_especes TO service_role;
ALTER TABLE public.supplements_especes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to supplements_especes" ON public.supplements_especes FOR ALL USING (true) WITH CHECK (true);