import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { OperationCaisse } from "./CaissePage";

const LIBELLES_ENTREE = [
  "Paiement client – prestation ménage",
  "Paiement client – frais de recrutement",
  "Paiement abonnement client",
];

const LIBELLES_SORTIE = [
  "Paiement salaire femme de ménage",
  "Achat matériel",
  "Dépenses administratives",
  "Dépenses marketing",
  "Remboursement client",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operation: OperationCaisse | null;
  defaultType: "entree" | "sortie";
}

export default function CaisseOperationModal({ open, onOpenChange, operation, defaultType }: Props) {
  const queryClient = useQueryClient();
  const isEdit = !!operation;

  const [typeOp, setTypeOp] = useState<"entree" | "sortie">(defaultType);
  const [dateOp, setDateOp] = useState(new Date().toISOString().slice(0, 10));
  const [montant, setMontant] = useState("");
  const [modePaiement, setModePaiement] = useState("especes");
  const [libelle, setLibelle] = useState("");
  const [libelleCustom, setLibelleCustom] = useState("");
  const [clientNom, setClientNom] = useState("");
  const [projetService, setProjetService] = useState("");
  const [utilisateur, setUtilisateur] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (operation) {
      setTypeOp(operation.type_operation);
      setDateOp(operation.date_operation);
      setMontant(String(operation.montant));
      setModePaiement(operation.mode_paiement);
      const suggestions = operation.type_operation === "entree" ? LIBELLES_ENTREE : LIBELLES_SORTIE;
      if (suggestions.includes(operation.libelle)) {
        setLibelle(operation.libelle);
        setLibelleCustom("");
      } else {
        setLibelle("autre");
        setLibelleCustom(operation.libelle);
      }
      setClientNom(operation.client_nom || "");
      setProjetService(operation.projet_service || "");
      setUtilisateur(operation.utilisateur || "");
      setNotes(operation.notes || "");
    } else {
      setTypeOp(defaultType);
      setDateOp(new Date().toISOString().slice(0, 10));
      setMontant("");
      setModePaiement("especes");
      setLibelle("");
      setLibelleCustom("");
      setClientNom("");
      setProjetService("");
      setUtilisateur("");
      setNotes("");
    }
  }, [operation, defaultType, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const finalLibelle = libelle === "autre" ? libelleCustom : libelle;
      if (!finalLibelle || !montant) throw new Error("Champs obligatoires manquants");

      const payload = {
        type_operation: typeOp,
        date_operation: dateOp,
        montant: Number(montant),
        mode_paiement: modePaiement,
        libelle: finalLibelle,
        client_nom: clientNom || null,
        projet_service: projetService || null,
        utilisateur: utilisateur || null,
        notes: notes || null,
      };

      if (isEdit) {
        const { error } = await supabase.from("operations_caisse").update(payload).eq("id", operation!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("operations_caisse").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operations_caisse"] });
      toast.success(isEdit ? "Opération modifiée" : "Opération ajoutée");
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const suggestions = typeOp === "entree" ? LIBELLES_ENTREE : LIBELLES_SORTIE;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier l'opération" : typeOp === "entree" ? "Ajouter une entrée" : "Ajouter une sortie"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Type d'opération</Label>
              <Select value={typeOp} onValueChange={(v) => { setTypeOp(v as any); setLibelle(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entree">Entrée</SelectItem>
                  <SelectItem value="sortie">Sortie</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={dateOp} onChange={(e) => setDateOp(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Montant (MAD) *</Label>
              <Input type="number" min="0" step="0.01" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Mode de paiement</Label>
              <Select value={modePaiement} onValueChange={setModePaiement}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="especes">Espèces</SelectItem>
                  <SelectItem value="virement">Virement</SelectItem>
                  <SelectItem value="cheque">Chèque</SelectItem>
                  <SelectItem value="paiement_agence">Paiement agence</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Libellé / Motif *</Label>
            <Select value={libelle} onValueChange={setLibelle}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un motif..." /></SelectTrigger>
              <SelectContent>
                {suggestions.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
                <SelectItem value="autre">Autre (saisie libre)</SelectItem>
              </SelectContent>
            </Select>
            {libelle === "autre" && (
              <Input className="mt-2" value={libelleCustom} onChange={(e) => setLibelleCustom(e.target.value)} placeholder="Saisir le motif..." />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Client associé (optionnel)</Label>
              <Input value={clientNom} onChange={(e) => setClientNom(e.target.value)} placeholder="Nom du client" />
            </div>
            <div>
              <Label>Projet / Service (optionnel)</Label>
              <Select value={projetService} onValueChange={setProjetService}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="menage">Agence Ménage</SelectItem>
                  <SelectItem value="recrutement">Recrutement</SelectItem>
                  <SelectItem value="autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Utilisateur</Label>
            <Input value={utilisateur} onChange={(e) => setUtilisateur(e.target.value)} placeholder="Qui enregistre l'opération ?" />
          </div>

          <div>
            <Label>Notes (optionnel)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Remarques..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Enregistrement..." : isEdit ? "Modifier" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
