-- Add categorie column to operations_caisse
ALTER TABLE public.operations_caisse ADD COLUMN IF NOT EXISTS categorie TEXT;

-- Config table for Trésorerie (solde initial)
CREATE TABLE IF NOT EXISTS public.tresorerie_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  solde_initial NUMERIC NOT NULL DEFAULT 0,
  date_solde_initial DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tresorerie_config TO authenticated;
GRANT SELECT ON public.tresorerie_config TO anon;
GRANT ALL ON public.tresorerie_config TO service_role;

ALTER TABLE public.tresorerie_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read tresorerie_config" ON public.tresorerie_config FOR SELECT USING (true);
CREATE POLICY "Public write tresorerie_config" ON public.tresorerie_config FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.tresorerie_config (id, solde_initial) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;