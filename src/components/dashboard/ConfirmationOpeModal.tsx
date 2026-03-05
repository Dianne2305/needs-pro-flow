import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CONFIRMATION_OPE_OPTIONS } from "@/lib/constants";
import { CheckCircle, AlertTriangle, XCircle, Send, User, Phone, UserPlus } from "lucide-react";
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
  const [showCandidature, setShowCandidature] = useState(false);

  const handleValidate = () => {
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
    // Build WhatsApp message with candidate info
    const candidatNom = demande.candidat_nom || "Non assigné";
    const candidatTel = demande.candidat_telephone || "";
    const message = encodeURIComponent(
      `Bonjour,\n\nSuite à votre demande #${demande.num_demande}, nous vous proposons le profil suivant :\n\n` +
      `👤 Nom : ${candidatNom}\n` +
      `📞 Téléphone : ${candidatTel}\n` +
      `📅 Date : ${demande.date_prestation || "À définir"}\n` +
      `🕐 Heure : ${demande.heure_prestation || "À définir"}\n` +
      `📍 Lieu : ${demande.quartier || demande.ville}\n\n` +
      `Cordialement,\nL'équipe opérationnelle`
    );
    const phoneNumber = (demande.telephone_whatsapp || demande.telephone_direct || "").replace(/\s/g, "");
    if (phoneNumber) {
      window.open(`https://wa.me/${phoneNumber}?text=${message}`, "_blank");
    }

    // Also save confirmation
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
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
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

          {/* Décision */}
          <div>
            <Label>Décision</Label>
            <Select value={confirmation} onValueChange={(val) => { setConfirmation(val); setShowCandidature(false); }}>
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

          {/* Confirmé */}
          {confirmation === "confirme" && (
            <div className="space-y-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <p className="text-sm font-medium text-emerald-800 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" /> Opération confirmée avec le client
              </p>

              {/* Bouton Postuler */}
              {!showCandidature && (
                <Button variant="outline" className="w-full" onClick={() => setShowCandidature(true)}>
                  <UserPlus className="h-4 w-4 mr-2" /> Postuler — Afficher la fiche candidat
                </Button>
              )}

              {/* Fiche candidat */}
              {showCandidature && (
                <div className="space-y-3 p-3 bg-background rounded-lg border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fiche candidat</p>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={d.candidat_photo_url} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-base">
                        {demande.candidat_nom ? demande.candidat_nom.charAt(0).toUpperCase() : <User className="h-5 w-5" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{demande.candidat_nom || "Aucun candidat assigné"}</p>
                      {demande.candidat_telephone && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {demande.candidat_telephone}
                        </p>
                      )}
                      {demande.statut_candidature && (
                        <Badge variant="outline" className="mt-1 text-xs">{demande.statut_candidature}</Badge>
                      )}
                    </div>
                  </div>

                  {/* Logistique */}
                  <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground border-t pt-2">
                    <span>📅 {demande.date_prestation || "—"}</span>
                    <span>🕐 {demande.heure_prestation || "—"}</span>
                    <span className="col-span-2">📍 {demande.quartier || demande.ville}</span>
                  </div>

                  {/* Envoyer candidature via WhatsApp */}
                  <Button onClick={handleSendCandidature} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Send className="h-4 w-4 mr-2" /> Envoyer la candidature via WhatsApp
                  </Button>
                </div>
              )}

              {/* Note opérationnelle */}
              <div>
                <Label>Note opérationnelle</Label>
                <Textarea value={noteOpe} onChange={(e) => setNoteOpe(e.target.value)} rows={3} placeholder="Ajouter une note pour le service opération..." />
              </div>
            </div>
          )}

          {/* Report */}
          {confirmation === "report" && (
            <div>
              <Label>Nouvelle date proposée</Label>
              <Input type="date" value={dateReport} onChange={(e) => setDateReport(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Le commercial sera alerté du changement de date.</p>
            </div>
          )}

          {/* Annulé */}
          {confirmation === "annule" && (
            <div>
              <Label>Motif d'annulation *</Label>
              <Textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={3} placeholder="Saisir le motif d'annulation..." />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            onClick={handleValidate}
            disabled={!confirmation || (confirmation === "annule" && !motif)}
          >
            <CheckCircle className="h-4 w-4 mr-2" /> Valider
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
