/**
 * AbonnementActionsModal.tsx
 * Modales de confirmation pour les actions Suspendre / Renouveler / Facturer
 * depuis la page Gestion Abonnement.
 */
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Pause, RefreshCw, Receipt, Loader2 } from "lucide-react";
import { addMonths, format } from "date-fns";

type Demande = Tables<"demandes">;
export type AbonnementAction = "suspendre" | "renouveler" | "facturer";

interface Props {
  demande: Demande | null;
  action: AbonnementAction | null;
  onClose: () => void;
}

const MODE_PAIEMENT = ["Virement", "Chèque", "Espèces à l'agence", "Sur place"];

export default function AbonnementActionsModal({ demande, action, onClose }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  // Suspendre
  const [motif, setMotif] = useState("");
  // Renouveler
  const [dateDebut, setDateDebut] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dureeMois, setDureeMois] = useState("1");
  // Facturer
  const [montant, setMontant] = useState("");
  const [mode, setMode] = useState("Virement");
  const [dateInterv, setDateInterv] = useState(format(new Date(), "yyyy-MM-dd"));
  const [commentaire, setCommentaire] = useState("");

  useEffect(() => {
    if (demande) {
      setMotif("");
      setDateDebut(format(new Date(), "yyyy-MM-dd"));
      setDureeMois("1");
      setMontant(String(demande.montant_total ?? ""));
      setMode(demande.mode_paiement || "Virement");
      setDateInterv(format(new Date(), "yyyy-MM-dd"));
      setCommentaire("");
    }
  }, [demande]);

  const suspendreMut = useMutation({
    mutationFn: async () => {
      if (!demande) throw new Error("no demande");
      const { error } = await supabase
        .from("demandes")
        .update({ statut: "suspendu", motif_annulation: motif || "Suspendu depuis Gestion Abonnement" })
        .eq("id", demande.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["demandes"] });
      toast({ title: "Abonnement suspendu", description: `#${demande?.num_demande} · ${demande?.nom}` });
      onClose();
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const renouvelerMut = useMutation({
    mutationFn: async () => {
      if (!demande) throw new Error("no demande");
      const mois = Math.max(1, parseInt(dureeMois || "1", 10));
      const finPrev = format(addMonths(new Date(dateDebut), mois), "yyyy-MM-dd");
      // Duplication de la demande (nouvel abonnement) — champs essentiels seulement
      const insertRow: any = {
        nom: demande.nom,
        telephone_direct: demande.telephone_direct,
        telephone_whatsapp: demande.telephone_whatsapp,
        email: demande.email,
        type_service: demande.type_service,
        type_prestation: demande.type_prestation,
        type_bien: demande.type_bien,
        frequence: demande.frequence,
        duree_heures: demande.duree_heures,
        nombre_intervenants: demande.nombre_intervenants,
        date_prestation: dateDebut,
        heure_prestation: demande.heure_prestation,
        ville: demande.ville,
        quartier: demande.quartier,
        adresse: demande.adresse,
        montant_total: demande.montant_total,
        mode_paiement: demande.mode_paiement,
        nom_entreprise: demande.nom_entreprise,
        contact_entreprise: demande.contact_entreprise,
        commercial: demande.commercial,
        commercial_createur: demande.commercial_createur,
        statut: "nouveau_besoin",
        note_commercial: `Renouvellement de #${demande.num_demande} — ${dateDebut} → ${finPrev}`,
      };
      const { error } = await supabase.from("demandes").insert(insertRow);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["demandes"] });
      toast({ title: "Abonnement renouvelé", description: `Nouvelle demande créée pour ${demande?.nom}` });
      onClose();
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const facturerMut = useMutation({
    mutationFn: async () => {
      if (!demande) throw new Error("no demande");
      const mt = parseFloat(montant || "0");
      if (!mt || mt <= 0) throw new Error("Montant invalide");
      const insertRow: any = {
        demande_id: demande.id,
        nom_client: demande.nom_entreprise || demande.nom,
        ville: demande.ville || "Casablanca",
        type_service: demande.type_prestation || demande.type_service,
        date_intervention: dateInterv,
        montant_total: mt,
        mode_paiement_prevu: mode,
        statut_mission: "confirmee",
        statut_paiement: "non_paye",
        segment: demande.nom_entreprise ? "entreprise" : "particulier",
        commercial: demande.commercial,
        commentaire: commentaire || null,
      };
      const { error } = await supabase.from("facturation").insert(insertRow);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["facturation"] });
      qc.invalidateQueries({ queryKey: ["demandes"] });
      toast({ title: "Facture créée", description: `Mission facturée pour ${demande?.nom}` });
      onClose();
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  if (!demande || !action) return null;
  const busy = suspendreMut.isPending || renouvelerMut.isPending || facturerMut.isPending;

  return (
    <Dialog open={!!action} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {action === "suspendre" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-700">
                <Pause className="h-5 w-5" /> Suspendre l'abonnement
              </DialogTitle>
              <DialogDescription>
                #{demande.num_demande} — {demande.nom_entreprise || demande.nom}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="motif">Motif de suspension</Label>
                <Textarea
                  id="motif"
                  placeholder="Paiement non reçu, demande du client, congés…"
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  rows={3}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Les prochaines interventions ne seront plus planifiées tant que l'abonnement reste suspendu.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={busy}>Annuler</Button>
              <Button
                className="bg-amber-600 hover:bg-amber-700"
                onClick={() => suspendreMut.mutate()}
                disabled={busy}
              >
                {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Confirmer la suspension
              </Button>
            </DialogFooter>
          </>
        )}

        {action === "renouveler" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-700">
                <RefreshCw className="h-5 w-5" /> Renouveler l'abonnement
              </DialogTitle>
              <DialogDescription>
                #{demande.num_demande} — {demande.nom_entreprise || demande.nom}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="dateDebut">Date de début</Label>
                  <Input id="dateDebut" type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="duree">Durée (mois)</Label>
                  <Input id="duree" type="number" min="1" max="24" value={dureeMois} onChange={(e) => setDureeMois(e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Une nouvelle demande sera créée en reprenant les paramètres actuels (fréquence, service, tarifs, adresse).
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={busy}>Annuler</Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => renouvelerMut.mutate()}
                disabled={busy}
              >
                {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Renouveler
              </Button>
            </DialogFooter>
          </>
        )}

        {action === "facturer" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-violet-700">
                <Receipt className="h-5 w-5" /> Créer une facture
              </DialogTitle>
              <DialogDescription>
                #{demande.num_demande} — {demande.nom_entreprise || demande.nom}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="montant">Montant (DH)</Label>
                  <Input id="montant" type="number" step="0.01" min="0" value={montant} onChange={(e) => setMontant(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dateInterv">Date intervention</Label>
                  <Input id="dateInterv" type="date" value={dateInterv} onChange={(e) => setDateInterv(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Mode de paiement</Label>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODE_PAIEMENT.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="comm">Commentaire (optionnel)</Label>
                <Textarea id="comm" rows={2} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={busy}>Annuler</Button>
              <Button
                className="bg-violet-600 hover:bg-violet-700"
                onClick={() => facturerMut.mutate()}
                disabled={busy}
              >
                {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Créer la facture
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
