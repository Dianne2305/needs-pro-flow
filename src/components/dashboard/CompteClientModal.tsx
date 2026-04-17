/**
 * CompteClientModal.tsx
 * Modal aperçu rapide du compte client depuis le dashboard.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { STATUTS, FREQUENCES, STATUT_CANDIDATURE_OPTIONS } from "@/lib/constants";
import { ChevronDown, FileDown, Plus, User, MessageSquare, Clock, CreditCard, Users } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type Demande = Tables<"demandes">;

/**
 * Props du modal CompteClient (aperçu rapide depuis le dashboard).
 * @property demande      - Demande dont on veut afficher le compte client lié.
 * @property open         - État ouvert/fermé du modal.
 * @property onOpenChange - Callback ouverture/fermeture.
 * @property onSave       - Callback de sauvegarde des notes commerciales/opérationnelles.
 */
interface Props {
  demande: Demande;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: Record<string, unknown>) => void;
}

/**
 * Section pliable interne au modal compte client (titre coloré + chevron + contenu).
 * Utilisée pour regrouper Profil, Historique, Paiement, Candidatures, etc.
 */
function Section({ title, icon: Icon, color, defaultOpen = false, children }: {
  title: string; icon: any; color: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className={`flex items-center justify-between w-full p-3 rounded-lg text-sm font-semibold ${color} hover:opacity-90 transition`}>
        <span className="flex items-center gap-2"><Icon className="h-4 w-4" />{title}</span>
        <ChevronDown className="h-4 w-4 transition-transform" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 py-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function CompteClientModal({ demande, open, onOpenChange, onSave }: Props) {
  const d = demande as any;
  const [noteComm, setNoteComm] = useState(demande.note_commercial || "");
  const [noteOpe, setNoteOpe] = useState(demande.note_operationnel || "");
  const s = STATUTS[demande.statut as keyof typeof STATUTS];
  const freq = FREQUENCES.find(f => f.value === demande.frequence);
  const statutCand = STATUT_CANDIDATURE_OPTIONS.find(sc => sc.value === d.statut_candidature);

  const saveNotes = () => {
    onSave({ note_commercial: noteComm || null, note_operationnel: noteOpe || null });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Compte Client — {demande.nom}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {/* Infos client */}
          <Section title="Informations Client" icon={User} color="bg-sky-50 text-sky-800" defaultOpen>
            <div className="grid grid-cols-2 gap-2 text-sm py-2">
              <div><span className="text-muted-foreground">Nom :</span> {demande.nom}</div>
              <div><span className="text-muted-foreground">Tél. direct :</span> {demande.telephone_direct || "—"}</div>
              <div><span className="text-muted-foreground">WhatsApp :</span> {demande.telephone_whatsapp || "—"}</div>
              <div><span className="text-muted-foreground">Segment :</span>
                <Badge className={demande.type_service === "SPP" ? "ml-1 bg-primary text-primary-foreground" : "ml-1 bg-spe text-spe-foreground"}>
                  {demande.type_service}
                </Badge>
              </div>
            </div>
          </Section>

          {/* Avis */}
          <Section title="Avis Commercial & Opérationnel" icon={MessageSquare} color="bg-violet-50 text-violet-800">
            <div className="space-y-3 py-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Avis Commercial</p>
                <Textarea value={noteComm} onChange={(e) => setNoteComm(e.target.value)} rows={2} placeholder="Note du commercial..." />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Avis Opérationnel</p>
                <Textarea value={noteOpe} onChange={(e) => setNoteOpe(e.target.value)} rows={2} placeholder="Note opérationnelle..." />
              </div>
              <Button size="sm" onClick={saveNotes}><Plus className="h-3 w-3 mr-1" />Enregistrer les notes</Button>
            </div>
          </Section>

          {/* Fréquence */}
          <Section title="Fréquence" icon={Clock} color="bg-amber-50 text-amber-800">
            <div className="py-2 text-sm">
              <Badge variant="outline">{freq?.label || demande.frequence}</Badge>
              {demande.frequence !== "ponctuel" && (
                <p className="mt-2 text-muted-foreground">Abonnement actif — les détails de la récurrence sont configurés dans le besoin.</p>
              )}
            </div>
          </Section>

          {/* Détails besoin */}
          <Section title="Détails du Besoin Actuel" icon={FileDown} color="bg-emerald-50 text-emerald-800">
            <div className="grid grid-cols-2 gap-2 text-sm py-2">
              <div><span className="text-muted-foreground">Réf :</span> #{demande.num_demande}</div>
              <div><span className="text-muted-foreground">Type :</span> {demande.type_prestation}</div>
              <div><span className="text-muted-foreground">Bien :</span> {demande.type_bien || "—"}</div>
              <div><span className="text-muted-foreground">Durée :</span> {demande.duree_heures ? `${demande.duree_heures}h` : "—"}</div>
              <div><span className="text-muted-foreground">Intervenants :</span> {demande.nombre_intervenants}</div>
              <div><span className="text-muted-foreground">Avec produit :</span> {d.avec_produit ? "Oui" : "Non"}</div>
              <div><span className="text-muted-foreground">Date :</span> {demande.date_prestation || "—"}</div>
              <div><span className="text-muted-foreground">Heure :</span> {demande.heure_prestation || "—"}</div>
              <div><span className="text-muted-foreground">Ville :</span> {demande.ville}</div>
              <div><span className="text-muted-foreground">Quartier :</span> {demande.quartier || "—"}</div>
              <div className="col-span-2"><span className="text-muted-foreground">Adresse :</span> {demande.adresse || "—"}</div>
              <div><span className="text-muted-foreground">Créé le :</span> {format(new Date(demande.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}</div>
              <div><span className="text-muted-foreground">Confirmé le :</span> {demande.confirmed_at ? format(new Date(demande.confirmed_at), "dd/MM/yyyy HH:mm", { locale: fr }) : "—"}</div>
              {demande.notes_client && (
                <div className="col-span-2 p-2 bg-muted rounded text-sm mt-1">
                  <span className="text-muted-foreground">Notes client :</span> {demande.notes_client}
                </div>
              )}
            </div>
          </Section>

          {/* Détails réservation/devis */}
          <Section title="Réservation / Devis" icon={CreditCard} color="bg-indigo-50 text-indigo-800">
            <div className="grid grid-cols-2 gap-2 text-sm py-2">
              <div><span className="text-muted-foreground">Tarif total :</span> {demande.montant_total ? `${demande.montant_total} MAD` : "—"}</div>
              <div><span className="text-muted-foreground">Tarif candidat :</span> {demande.montant_candidat ? `${demande.montant_candidat} MAD` : "—"}</div>
              <div><span className="text-muted-foreground">Statut :</span> {s ? <Badge variant="outline" className={s.color}>{s.label}</Badge> : demande.statut}</div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" disabled>
                  <FileDown className="h-4 w-4 mr-1" />Télécharger PDF
                </Button>
              </div>
            </div>
          </Section>

          {/* Candidatures proposées */}
          <Section title="Candidatures Proposées" icon={Users} color="bg-rose-50 text-rose-800">
            <div className="py-2 text-sm">
              {d.candidat_nom ? (
                <div className="flex items-center gap-3 p-2 bg-muted rounded">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    {d.candidat_nom.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium">{d.candidat_nom}</p>
                    <p className="text-xs text-muted-foreground">{d.candidat_telephone || "—"}</p>
                    {statutCand && <Badge variant="outline" className="mt-1">{statutCand.label}</Badge>}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Aucune candidature proposée pour le moment.</p>
              )}
            </div>
          </Section>
        </div>

        {/* Actions rapides */}
        <div className="flex flex-wrap gap-2 pt-4 border-t">
          <Button variant="outline" size="sm" onClick={() => onSave({ statut: "cloturee" })}>Clôturer</Button>
          <Button variant="outline" size="sm" onClick={() => onSave({ statut: "standby" })}>Standby</Button>
          <Button variant="outline" size="sm" className="text-destructive" onClick={() => onSave({ statut: "annulee" })}>Supprimer</Button>
          <Button variant="outline" size="sm" className="text-destructive" onClick={() => onSave({ statut: "rejetee" })}>Rejeter</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
