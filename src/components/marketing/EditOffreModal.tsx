/**
 * EditOffreModal.tsx
 * Édition d'un code promo existant (CDC v1).
 */
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PromoCodeForm, formToPayload, rowToForm, validatePromoForm, PromoFormState } from "./PromoCodeForm";

interface Props {
  offre: any | null;
  onClose: () => void;
}

export function EditOffreModal({ offre, onClose }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PromoFormState>(() => rowToForm(offre));
  const [codeError, setCodeError] = useState<string | null>(null);

  useEffect(() => {
    if (offre) {
      setForm(rowToForm(offre));
      setCodeError(null);
    }
  }, [offre]);

  const isValid = validatePromoForm(form);

  const mutation = useMutation({
    mutationFn: async () => {
      setCodeError(null);
      const { error } = await supabase
        .from("offres_marketing")
        .update(formToPayload(form) as any)
        .eq("id", offre?.id);
      if (error) {
        if (error.message?.includes("unique") || error.code === "23505") {
          setCodeError("Ce code promo existe déjà");
          throw new Error("Ce code promo existe déjà");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offres_marketing"] });
      toast.success("Code promo modifié !");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || "Erreur lors de la modification"),
  });

  return (
    <Dialog open={!!offre} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le code promo</DialogTitle>
        </DialogHeader>
        <PromoCodeForm value={form} onChange={setForm} codeError={codeError} />
        <DialogFooter>
          <Button onClick={() => mutation.mutate()} disabled={!isValid || mutation.isPending} className="w-full">
            ✅ Enregistrer les modifications
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
