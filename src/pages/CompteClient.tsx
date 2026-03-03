import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { STATUTS, FREQUENCES, STATUT_CANDIDATURE_OPTIONS } from "@/lib/constants";
import {
  ChevronDown, ArrowLeft, FileDown, Plus, User, MessageSquare,
  Clock, CreditCard, Users, Phone, MapPin, Calendar, Hash, Briefcase
} from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";

type Demande = Tables<"demandes">;

function Section({ title, icon: Icon, children, defaultOpen = false, count }: {
  title: string; icon: any; defaultOpen?: boolean; count?: number; children: React.ReactNode;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full px-5 py-3.5 rounded-xl text-sm font-semibold bg-card border border-border hover:border-primary/30 hover:shadow-sm transition-all group">
        <span className="flex items-center gap-2.5">
          <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          {title}
          {count !== undefined && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{count}</Badge>
          )}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-5 pt-3 pb-4">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function InfoItem({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: any }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      {Icon && (
        <span className="flex items-center justify-center h-5 w-5 mt-0.5 rounded text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <p className="text-sm font-medium text-foreground">{value || "—"}</p>
      </div>
    </div>
  );
}

export default function CompteClient() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const demandeId = new URLSearchParams(location.search).get("id");
  const from = new URLSearchParams(location.search).get("from") || "/";

  const { data: demande, isLoading } = useQuery({
    queryKey: ["demande", demandeId],
    queryFn: async () => {
      if (!demandeId) return null;
      const { data, error } = await supabase.from("demandes").select("*").eq("id", demandeId).single();
      if (error) throw error;
      return data as Demande;
    },
    enabled: !!demandeId,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      if (!demandeId) return;
      const { error } = await supabase.from("demandes").update(updates).eq("id", demandeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demande", demandeId] });
      queryClient.invalidateQueries({ queryKey: ["demandes"] });
      toast({ title: "Mis à jour avec succès" });
    },
  });

  const [noteComm, setNoteComm] = useState("");
  const [noteOpe, setNoteOpe] = useState("");
  const notesInitialized = useState(false);

  if (demande && !notesInitialized[0]) {
    setNoteComm(demande.note_commercial || "");
    setNoteOpe(demande.note_operationnel || "");
    notesInitialized[1](true);
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Chargement du compte client...</p>
      </div>
    );
  }

  if (!demande) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <User className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground font-medium">Demande introuvable</p>
        <Button variant="outline" size="sm" onClick={() => navigate(from)}>
          <ArrowLeft className="h-4 w-4 mr-1" />Retour
        </Button>
      </div>
    );
  }

  const d = demande as any;
  const s = STATUTS[demande.statut as keyof typeof STATUTS];
  const freq = FREQUENCES.find(f => f.value === demande.frequence);
  const statutCand = STATUT_CANDIDATURE_OPTIONS.find(sc => sc.value === d.statut_candidature);

  const saveNotes = () => {
    updateMutation.mutate({ note_commercial: noteComm || null, note_operationnel: noteOpe || null });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate(from)} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />Retour
          </Button>
          <Separator orientation="vertical" className="h-8" />
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-md">
              {demande.nom.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground leading-tight">{demande.nom}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground font-mono">#{demande.num_demande}</span>
                <Badge className={demande.type_service === "SPP" ? "bg-primary text-primary-foreground text-[10px]" : "bg-spe text-spe-foreground text-[10px]"}>
                  {demande.type_service}
                </Badge>
                {s && <Badge variant="outline" className="border-0 text-[10px] font-medium" style={{ backgroundColor: s.hex === "#ffffff" ? "#e2e8f0" : s.hex, color: s.hex === "#ffffff" ? "#334155" : "#ffffff" }}>{s.label}</Badge>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <CreditCard className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Tarif</p>
              <p className="text-base font-bold text-foreground">{demande.montant_total ? `${demande.montant_total} MAD` : "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Durée</p>
              <p className="text-base font-bold text-foreground">{demande.duree_heures ? `${demande.duree_heures}h` : "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Intervenants</p>
              <p className="text-base font-bold text-foreground">{demande.nombre_intervenants || 1}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Prestation</p>
              <p className="text-base font-bold text-foreground">{demande.date_prestation || "—"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {/* Client Info */}
        <Section title="Informations Client" icon={User} defaultOpen>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
            <InfoItem label="Nom complet" value={demande.nom} icon={User} />
            <InfoItem label="Téléphone direct" value={demande.telephone_direct} icon={Phone} />
            <InfoItem label="WhatsApp" value={demande.telephone_whatsapp} icon={Phone} />
            <InfoItem label="Ville" value={demande.ville} icon={MapPin} />
            <InfoItem label="Quartier" value={demande.quartier} icon={MapPin} />
            <InfoItem label="Adresse" value={demande.adresse} icon={MapPin} />
          </div>
        </Section>

        {/* Notes */}
        <Section title="Avis Commercial & Opérationnel" icon={MessageSquare}>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Avis Commercial</label>
              <Textarea
                value={noteComm}
                onChange={(e) => setNoteComm(e.target.value)}
                rows={2}
                placeholder="Saisir une note commerciale..."
                className="resize-none bg-muted/50 border-border focus:bg-card"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Avis Opérationnel</label>
              <Textarea
                value={noteOpe}
                onChange={(e) => setNoteOpe(e.target.value)}
                rows={2}
                placeholder="Saisir une note opérationnelle..."
                className="resize-none bg-muted/50 border-border focus:bg-card"
              />
            </div>
            <Button size="sm" onClick={saveNotes} disabled={updateMutation.isPending} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />Enregistrer
            </Button>
          </div>
        </Section>

        {/* Fréquence */}
        <Section title="Fréquence & Abonnement" icon={Clock}>
          <div className="flex items-center gap-3 py-1">
            <Badge variant="outline" className="text-sm px-3 py-1">{freq?.label || demande.frequence}</Badge>
            {demande.frequence !== "ponctuel" && (
              <p className="text-sm text-muted-foreground">Abonnement actif — récurrence configurée dans le besoin.</p>
            )}
          </div>
        </Section>

        {/* Détails besoin */}
        <Section title="Détails du Besoin" icon={Briefcase}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
            <InfoItem label="Référence" value={<span className="font-mono">#{demande.num_demande}</span>} icon={Hash} />
            <InfoItem label="Type prestation" value={demande.type_prestation} icon={Briefcase} />
            <InfoItem label="Type de bien" value={demande.type_bien} icon={Briefcase} />
            <InfoItem label="Durée" value={demande.duree_heures ? `${demande.duree_heures}h` : undefined} icon={Clock} />
            <InfoItem label="Intervenants" value={demande.nombre_intervenants} icon={Users} />
            <InfoItem label="Avec produit" value={d.avec_produit ? "Oui" : "Non"} />
            <InfoItem label="Date prestation" value={demande.date_prestation} icon={Calendar} />
            <InfoItem label="Heure" value={demande.heure_prestation} icon={Clock} />
            <InfoItem label="Créé le" value={format(new Date(demande.created_at), "dd MMM yyyy à HH:mm", { locale: fr })} icon={Calendar} />
            <InfoItem label="Confirmé le" value={demande.confirmed_at ? format(new Date(demande.confirmed_at), "dd MMM yyyy à HH:mm", { locale: fr }) : undefined} icon={Calendar} />
          </div>
          {demande.notes_client && (
            <div className="mt-3 p-3 bg-muted/60 rounded-lg border border-border">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Notes du client</p>
              <p className="text-sm text-foreground">{demande.notes_client}</p>
            </div>
          )}
        </Section>

        {/* Devis */}
        <Section title="Réservation & Devis" icon={CreditCard}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
            <InfoItem label="Tarif total" value={demande.montant_total ? `${demande.montant_total} MAD` : undefined} icon={CreditCard} />
            <InfoItem label="Tarif candidat" value={demande.montant_candidat ? `${demande.montant_candidat} MAD` : undefined} icon={CreditCard} />
            <InfoItem label="Statut" value={s ? <Badge variant="outline" className={s.color}>{s.label}</Badge> : demande.statut} />
          </div>
          <div className="mt-3">
            <Button variant="outline" size="sm" disabled className="gap-1.5 text-muted-foreground">
              <FileDown className="h-4 w-4" />Télécharger le devis (PDF)
            </Button>
          </div>
        </Section>

        {/* Candidatures */}
        <Section title="Candidatures Proposées" icon={Users} count={d.candidat_nom ? 1 : 0}>
          {d.candidat_nom ? (
            <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-xl border border-border">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                {d.candidat_nom.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground">{d.candidat_nom}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{d.candidat_telephone || "Pas de téléphone"}</p>
              </div>
              {statutCand && (
                <Badge variant="outline" className="shrink-0">{statutCand.label}</Badge>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-2">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Aucune candidature proposée pour le moment</p>
            </div>
          )}
        </Section>
      </div>

      {/* Actions */}
      <Card className="border-border">
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Actions rapides</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => updateMutation.mutate({ statut: "cloturee" })} className="gap-1.5">
              Clôturer
            </Button>
            <Button variant="outline" size="sm" onClick={() => updateMutation.mutate({ statut: "standby" })} className="gap-1.5">
              Standby
            </Button>
            <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => updateMutation.mutate({ statut: "annulee" })}>
              Supprimer
            </Button>
            <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => updateMutation.mutate({ statut: "rejetee" })}>
              Rejeter
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
