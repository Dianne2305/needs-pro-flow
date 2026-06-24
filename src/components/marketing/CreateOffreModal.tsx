/**
 * CreateOffreModal.tsx
 * Modal de création d'un code promo (CDC v1) — workflow Brouillon vs Publier+activer.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PromoCodeForm, defaultPromoForm, validatePromoForm, formToPayload, PromoFormState, PromoFormVariant } from "./PromoCodeForm";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pré-remplissage (utilisé par la duplication). */
  initial?: Partial<PromoFormState> | null;
  /** "simple" = formulaire allégé (sans statut client, limite, canal, message). Défaut "bd". */
  variant?: PromoFormVariant;
}

export function CreateOffreModal({ open, onClose, initial, variant = "bd" }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PromoFormState>(() => ({ ...defaultPromoForm(), ...(initial ?? {}) }));
  const [codeError, setCodeError] = useState<string | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const isValid = validatePromoForm(form);

  // Re-init quand on rouvre avec un nouveau pré-remplissage
  // (on garde simple : utilise key={} côté parent si on veut un reset strict)

  const mutation = useMutation({
    mutationFn: async (statut: "brouillon" | "active") => {
      setCodeError(null);
      const { error } = await supabase.from("offres_marketing").insert({
        ...(formToPayload(form) as any),
        statut,
      } as any);
      if (error) {
        if (error.message?.includes("unique") || error.code === "23505") {
          setCodeError("Ce code promo existe déjà");
          throw new Error("Ce code promo existe déjà");
        }
        throw error;
      }
      return statut;
    },
    onSuccess: (statut) => {
      queryClient.invalidateQueries({ queryKey: ["offres_marketing"] });
      toast.success(statut === "brouillon" ? "Brouillon enregistré" : "Code promo publié et activé !");
      setForm(defaultPromoForm());
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || "Erreur lors de la création"),
  });

  const contactsCount = 0; // TODO : connecter au segment réel quand dispo
  const canaux = form.canaux.length ? form.canaux.join(", ") : "aucun canal";

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Créer un code promo</DialogTitle>
          </DialogHeader>
          <PromoCodeForm value={form} onChange={setForm} codeError={codeError} />
          <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
            <Button
              variant="outline"
              onClick={() => mutation.mutate("brouillon")}
              disabled={!isValid || mutation.isPending}
              className="flex-1"
            >
              💾 Enregistrer en brouillon
            </Button>
            <Button
              onClick={() => setConfirmPublish(true)}
              disabled={!isValid || mutation.isPending}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              🚀 Publier et activer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmPublish} onOpenChange={setConfirmPublish}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer l'envoi</AlertDialogTitle>
            <AlertDialogDescription>
              Vous allez activer le code <span className="font-mono font-semibold">{form.code_promo}</span>
              {form.canaux.length > 0 ? (
                <>
                  {" "}et envoyer le message à <strong>{contactsCount}</strong> contact(s) via <strong>{canaux}</strong>.
                </>
              ) : (
                <> (aucun canal de diffusion sélectionné — code disponible en saisie manuelle).</>
              )}
              <br />
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                setConfirmPublish(false);
                mutation.mutate("active");
              }}
            >
              Confirmer et envoyer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
