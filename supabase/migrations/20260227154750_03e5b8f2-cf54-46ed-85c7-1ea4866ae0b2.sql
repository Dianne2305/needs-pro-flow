
CREATE TABLE public.demandes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  num_demande SERIAL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  statut TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'confirmee', 'rejetee', 'cloturee', 'standby', 'annulee')),
  
  -- Contact
  nom TEXT NOT NULL,
  telephone_direct TEXT,
  telephone_whatsapp TEXT,
  
  -- Prestation
  type_service TEXT NOT NULL CHECK (type_service IN ('SPP', 'SPE')),
  type_prestation TEXT NOT NULL,
  type_bien TEXT,
  frequence TEXT NOT NULL DEFAULT 'ponctuel' CHECK (frequence IN ('ponctuel', 'hebdomadaire', 'bi_mensuel', 'mensuel', 'quotidien')),
  duree_heures NUMERIC(4,1),
  nombre_intervenants INTEGER DEFAULT 1,
  
  -- Lieu et horaire
  date_prestation DATE,
  heure_prestation TIME,
  ville TEXT NOT NULL DEFAULT 'Casablanca',
  quartier TEXT,
  adresse TEXT,
  
  -- Montants
  montant_total NUMERIC(10,2),
  montant_candidat NUMERIC(10,2) GENERATED ALWAYS AS (montant_total / 2) STORED,
  
  -- Notes
  notes_client TEXT,
  note_commercial TEXT,
  note_operationnel TEXT
);

CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  demande_id UUID REFERENCES public.demandes(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('client', 'profil', 'operationnel')),
  message TEXT NOT NULL,
  lu BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  date_rappel TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Disable RLS since no auth
ALTER TABLE public.demandes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to demandes" ON public.demandes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for demandes
ALTER PUBLICATION supabase_realtime ADD TABLE public.demandes;
