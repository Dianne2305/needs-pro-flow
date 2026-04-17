-- Function: auto-create feedback when facturation becomes "paye"
CREATE OR REPLACE FUNCTION public.create_feedback_on_paiement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_telephone text;
  v_client_nom text;
BEGIN
  IF NEW.statut_paiement = 'paye'
     AND (TG_OP = 'INSERT' OR OLD.statut_paiement IS DISTINCT FROM 'paye') THEN

    IF EXISTS (SELECT 1 FROM public.feedbacks WHERE demande_id = NEW.demande_id) THEN
      RETURN NEW;
    END IF;

    SELECT telephone_direct, nom INTO v_telephone, v_client_nom
    FROM public.demandes WHERE id = NEW.demande_id;

    INSERT INTO public.feedbacks (
      demande_id, profil_id, nom_client, telephone_client,
      ville, type_service, profil_nom, date_prestation
    ) VALUES (
      NEW.demande_id,
      NEW.profil_id,
      COALESCE(NEW.nom_client, v_client_nom, 'Client'),
      v_telephone,
      NEW.ville,
      NEW.type_service,
      NEW.profil_nom,
      NEW.date_intervention
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_feedback_on_paiement ON public.facturation;

CREATE TRIGGER trg_create_feedback_on_paiement
AFTER INSERT OR UPDATE OF statut_paiement ON public.facturation
FOR EACH ROW
EXECUTE FUNCTION public.create_feedback_on_paiement();