/**
 * CandidatureModal.tsx
 * Modal de gestion de candidature pour une demande : assignation profil, statut, logistique RDV, envoi candidature/contact.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { STATUT_CANDIDATURE_OPTIONS } from "@/lib/constants";
import { User, Phone, Send, CheckCircle } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type Demande = Tables<"demandes">;

interface Props {
  demande: Demande;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: Record<string, unknown>) => void;
}

export function CandidatureModal({ demande, open, onOpenChange, onSave }: Props) {
  const d = demande as any;
  const [candidatNom, setCandidatNom] = useState(d.candidat_nom || "");
  const [candidatTel, setCandidatTel] = useState(d.candidat_telephone || "");
  const [statutCandidature, setStatutCandidature] = useState(d.statut_candidature || "disponible");
  const [noteOpe, setNoteOpe] = useState(demande.note_operationnel || "");

  const handleConfirm = () => {
    onSave({
      candidat_nom: candidatNom || null,
      candidat_telephone: candidatTel || null,
      statut_candidature: statutCandidature,
      note_operationnel: noteOpe || null,
    });
    onOpenChange(false);
  };

  const handleSendCandidature = () => {
    // Future: send candidature details to client via WhatsApp
    handleConfirm();
  };

  const handleSendContact = () => {
    // Future: send candidate contact info
    handleConfirm();
  };

  const statutOption = STATUT_CANDIDATURE_OPTIONS.find(s => s.value === statutCandidature);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Candidature — #{demande.num_demande}</DialogTitle>
        </DialogHeader>

        {/* Profil candidat */}
        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
          <Avatar className="h-16 w-16">
            <AvatarImage src={d.candidat_photo_url} />
            <AvatarFallback className="bg-primary text-primary-foreground text-lg">
              {candidatNom ? candidatNom.charAt(0).toUpperCase() : <User className="h-6 w-6" />}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-1">
            <p className="font-semibold">{candidatNom || "Aucun candidat assigné"}</p>
            {candidatTel && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />{candidatTel}
              </p>
            )}
            {statutOption && <Badge variant="outline">{statutOption.label}</Badge>}
          </div>
        </div>

        {/* Formulaire */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-muted-foreground">Détails candidature</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nom du candidat</Label>
              <Input value={candidatNom} onChange={(e) => setCandidatNom(e.target.value)} placeholder="Nom complet" />
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input value={candidatTel} onChange={(e) => setCandidatTel(e.target.value)} placeholder="06..." />
            </div>
          </div>

          <div>
            <Label>Statut candidature</Label>
            <Select value={statutCandidature} onValueChange={setStatutCandidature}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUT_CANDIDATURE_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Logistique */}
          <div className="border-t pt-3">
            <p className="text-sm font-semibold text-muted-foreground mb-2">Logistique RDV</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">Date :</span> {demande.date_prestation || "—"}</div>
              <div><span className="text-muted-foreground">Heure :</span> {demande.heure_prestation || "—"}</div>
              <div className="col-span-2"><span className="text-muted-foreground">Lieu :</span> {demande.quartier || demande.ville}</div>
            </div>
          </div>

          <div>
            <Label>Notes opérationnelles</Label>
            <Textarea value={noteOpe} onChange={(e) => setNoteOpe(e.target.value)} rows={3} placeholder="Notes sur le candidat..." />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-4 border-t">
          <Button onClick={handleConfirm}><CheckCircle className="h-4 w-4 mr-1" />Confirmer</Button>
          <Button variant="outline" onClick={handleSendCandidature}><Send className="h-4 w-4 mr-1" />Envoyer candidature</Button>
          <Button variant="secondary" onClick={handleSendContact}><Phone className="h-4 w-4 mr-1" />Envoyer contact</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
