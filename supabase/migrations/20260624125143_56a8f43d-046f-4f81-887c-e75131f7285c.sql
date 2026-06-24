
-- Ajouter colonnes d'affectation commerciale sur demandes
ALTER TABLE public.demandes
  ADD COLUMN IF NOT EXISTS commercial_affecte_at timestamptz,
  ADD COLUMN IF NOT EXISTS commercial_createur text;

-- Backfill : créateur = commercial actuel pour les demandes existantes
UPDATE public.demandes
SET commercial_createur = commercial
WHERE commercial_createur IS NULL AND commercial IS NOT NULL;

-- Table d'historique d'affectation commerciale
CREATE TABLE IF NOT EXISTS public.client_commercial_historique (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demande_id uuid NOT NULL REFERENCES public.demandes(id) ON DELETE CASCADE,
  client_nom text,
  ancien_commercial text,
  nouveau_commercial text,
  action text NOT NULL DEFAULT 'reaffectation', -- creation | affectation | reaffectation | retrait
  effectue_par text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_commercial_historique TO authenticated;
GRANT SELECT, INSERT ON public.client_commercial_historique TO anon;
GRANT ALL ON public.client_commercial_historique TO service_role;

ALTER TABLE public.client_commercial_historique ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accès ouvert lecture historique commercial"
  ON public.client_commercial_historique FOR SELECT
  USING (true);

CREATE POLICY "Accès ouvert insertion historique commercial"
  ON public.client_commercial_historique FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_client_commercial_historique_demande
  ON public.client_commercial_historique(demande_id, created_at DESC);
