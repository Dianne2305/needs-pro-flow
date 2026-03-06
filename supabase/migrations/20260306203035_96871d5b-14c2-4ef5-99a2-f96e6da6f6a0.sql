
CREATE TABLE public.feedbacks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  demande_id UUID REFERENCES public.demandes(id) ON DELETE CASCADE NOT NULL,
  profil_id UUID REFERENCES public.profils(id) ON DELETE SET NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  nom_client TEXT NOT NULL,
  telephone_client TEXT,
  ville TEXT,
  type_service TEXT,
  profil_nom TEXT,
  date_prestation DATE,
  satisfaction TEXT,
  qualite_menage TEXT,
  professionnel TEXT,
  recommande_profil BOOLEAN,
  recommande_agence BOOLEAN,
  note_agence INTEGER,
  commentaire TEXT,
  statut TEXT NOT NULL DEFAULT 'en_attente',
  lien_envoye_at TIMESTAMP WITH TIME ZONE,
  submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to feedbacks" ON public.feedbacks FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.feedbacks;
