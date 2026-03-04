import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CONFIRMATION_OPE_OPTIONS } from "@/lib/constants";
import { CheckCircle, AlertTriangle, XCircle, Send } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type Demande = Tables<"demandes">;

interface Props {
  demande: Demande;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: Record<string, unknown>) => void;
}

export function ConfirmationOpeModal({ demande, open, onOpenChange, onSave }: Props) {
  const d = demande as any;
  const [confirmation, setConfirmation] = useState(d.confirmation_ope || "");
  const [motif, setMotif] = useState(d.motif_annulation || "");
  const [dateReport, setDateReport] = useState(d.date_report || "");
  const [noteOpe, setNoteOpe] = useState(demande.note_operationnel || "");

  const handleSave = () => {
    const updates: Record<string, unknown> = {
      confirmation_ope: confirmation,
      note_operationnel: noteOpe || null,
    };

    if (confirmation === "confirme") {
      updates.statut = "confirme_intervention";
    } else if (confirmation === "report") {
      updates.date_report = dateReport || null;
    } else if (confirmation === "annule") {
      updates.motif_annulation = motif;
      updates.statut = "annulee";
    }

    onSave(updates);
    onOpenChange(false);
  };

  const handleSendCandidature = () => {
    const updates: Record<string, unknown> = {
      confirmation_ope: "confirme",
      statut: "confirme_intervention",
      note_operationnel: noteOpe || null,
    };
    onSave(updates);
    onOpenChange(false);
  };

  const icons = {
    confirme: <CheckCircle className="h-5 w-5 text-emerald-600" />,
    report: <AlertTriangle className="h-5 w-5 text-amber-600" />,
    annule: <XCircle className="h-5 w-5 text-destructive" />,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmation opérationnelle — #{demande.num_demande}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Résumé intervention */}
          <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
            <p><span className="text-muted-foreground">Client :</span> {demande.nom}</p>
            <p><span className="text-muted-foreground">Date :</span> {demande.date_prestation || "—"}</p>
            <p><span className="text-muted-foreground">Heure :</span> {demande.heure_prestation || "—"}</p>
            <p><span className="text-muted-foreground">Lieu :</span> {demande.quartier || demande.ville}</p>
          </div>

          <div>
            <Label>Décision</Label>
            <Select value={confirmation} onValueChange={setConfirmation}>
              <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
              <SelectContent>
                {CONFIRMATION_OPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-2">
                      {icons[opt.value as keyof typeof icons]}
                      {opt.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Confirmé → Note + Envoyer candidature */}
          {confirmation === "confirme" && (
            <div className="space-y-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <p className="text-sm font-medium text-emerald-800">Opération confirmée</p>
              <div>
                <Label>Note opérationnelle</Label>
                <Textarea value={noteOpe} onChange={(e) => setNoteOpe(e.target.value)} rows={3} placeholder="Ajouter une note..." />
              </div>
              <Button onClick={handleSendCandidature} className="w-full">
                <Send className="h-4 w-4 mr-2" />Envoyer candidature
              </Button>
            </div>
          )}

          {confirmation === "report" && (
            <div>
              <Label>Nouvelle date proposée</Label>
              <Input type="date" value={dateReport} onChange={(e) => setDateReport(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Le commercial sera alerté du changement de date.</p>
            </div>
          )}

          {confirmation === "annule" && (
            <div>
              <Label>Motif d'annulation *</Label>
              <Textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={3} placeholder="Saisir le motif d'annulation..." />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            onClick={handleSave}
            disabled={!confirmation || (confirmation === "annule" && !motif)}
          >
            Valider
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
