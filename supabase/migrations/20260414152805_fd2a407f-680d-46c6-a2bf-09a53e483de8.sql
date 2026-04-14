
CREATE TABLE public.demande_historique (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  demande_id UUID NOT NULL REFERENCES public.demandes(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details TEXT,
  utilisateur TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.demande_historique ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to demande_historique"
  ON public.demande_historique
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_demande_historique_demande_id ON public.demande_historique(demande_id);
