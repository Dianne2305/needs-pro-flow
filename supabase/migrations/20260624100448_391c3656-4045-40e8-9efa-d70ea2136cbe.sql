
-- Add new columns to offres_marketing for promo code CDC
ALTER TABLE public.offres_marketing
  ADD COLUMN IF NOT EXISTS quota_par_client boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_offres_marketing_updated_at ON public.offres_marketing;
CREATE TRIGGER trg_offres_marketing_updated_at
  BEFORE UPDATE ON public.offres_marketing
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- promo_usages: journal des utilisations / événements code promo
-- ============================================================
CREATE TABLE IF NOT EXISTS public.promo_usages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offre_id uuid NOT NULL REFERENCES public.offres_marketing(id) ON DELETE CASCADE,
  evenement text NOT NULL CHECK (evenement IN (
    'code_envoye','message_ouvert','lien_clique','code_applique','code_refuse'
  )),
  client_id uuid,
  client_nom text,
  demande_id uuid,
  canal text,
  statut_envoi text,
  montant_remise numeric,
  raison_refus text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promo_usages_offre ON public.promo_usages(offre_id);
CREATE INDEX IF NOT EXISTS idx_promo_usages_event ON public.promo_usages(evenement);
CREATE INDEX IF NOT EXISTS idx_promo_usages_client ON public.promo_usages(client_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_usages TO authenticated, anon;
GRANT ALL ON public.promo_usages TO service_role;

ALTER TABLE public.promo_usages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to promo_usages"
  ON public.promo_usages FOR ALL
  USING (true) WITH CHECK (true);
