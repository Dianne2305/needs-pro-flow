
CREATE TABLE public.operations_caisse (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type_operation TEXT NOT NULL CHECK (type_operation IN ('entree', 'sortie')),
  date_operation DATE NOT NULL DEFAULT CURRENT_DATE,
  montant NUMERIC NOT NULL DEFAULT 0,
  mode_paiement TEXT NOT NULL DEFAULT 'especes',
  libelle TEXT NOT NULL,
  client_nom TEXT,
  projet_service TEXT,
  utilisateur TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.operations_caisse ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to operations_caisse"
  ON public.operations_caisse
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
