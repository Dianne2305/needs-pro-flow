/**
 * RejectModal.tsx
 * Modal de rejet d'une demande en attente avec motif.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

/**
 * Props du modal de rejet d'une demande.
 * @property open         - État ouvert/fermé.
 * @property onOpenChange - Callback ouverture/fermeture.
 * @property onConfirm    - Callback appelé avec le motif saisi à la confirmation.
 * @property numDemande   - Numéro de la demande affiché dans le titre.
 */
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (motif: string) => void;
  numDemande?: number;
}

/**
 * Modal de rejet d'une demande en attente.
 * Le motif est obligatoire (bouton désactivé tant que vide).
 */
export function RejectModal({ open, onOpenChange, onConfirm, numDemande }: Props) {
  const [motif, setMotif] = useState("");

  const handleConfirm = () => {
    onConfirm(motif);
    setMotif("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rejeter la demande #{numDemande}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Avis de rejet</Label>
            <Textarea
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Saisissez le motif du rejet..."
              rows={4}
              className="mt-1"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={!motif.trim()}
            >
              Confirmer le rejet
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
