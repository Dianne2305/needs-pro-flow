import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { STATUTS, FREQUENCES, STATUT_CANDIDATURE_OPTIONS } from "@/lib/constants";
import {
  ChevronDown, ArrowLeft, User, MessageSquare, Clock, CreditCard,
  Users, Phone, MapPin, Calendar as CalendarIcon, Hash, Briefcase,
  FileDown, Eye, Heart, FileText, Save, RefreshCw, Repeat
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tables } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

type Demande = Tables<"demandes">;

// Colored section component
function Section({ title, icon: Icon, children, defaultOpen = false, count, colorClass = "bg-card" }: {
  title: string; icon: any; defaultOpen?: boolean; count?: number; children: React.ReactNode; colorClass?: string;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className={cn(
        "flex items-center justify-between w-full px-5 py-3.5 rounded-t-xl text-sm font-semibold border border-border hover:shadow-sm transition-all group",
        colorClass
      )}>
        <span className="flex items-center gap-2.5">
          <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-background/60 text-foreground">
            <Icon className="h-4 w-4" />
          </span>
          {title}
          {count !== undefined && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{count}</Badge>
          )}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className={cn("px-5 pt-3 pb-4 border border-t-0 border-border rounded-b-xl", colorClass)}>
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="py-1">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || "—"}</p>
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

  // Count all demandes for this client (fidélité)
  const { data: allClientDemandes = [] } = useQuery({
    queryKey: ["demandes", "client_fidelite", demande?.nom],
    queryFn: async () => {
      if (!demande?.nom) return [];
      const { data, error } = await supabase
        .from("demandes")
        .select("*")
        .ilike("nom", demande.nom.trim())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Demande[];
    },
    enabled: !!demande?.nom,
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
  const [aboNote, setAboNote] = useState("");
  const [aboDate, setAboDate] = useState<Date | undefined>();
  const notesInitialized = useState(false);

  // Renouveler & Switcher modals
  const [renewOpen, setRenewOpen] = useState(false);
  const [switchAboOpen, setSwitchAboOpen] = useState(false);
  const [selectedFrequence, setSelectedFrequence] = useState("");

  // Renew form state (pre-filled from current demande)
  const [renewForm, setRenewForm] = useState<Record<string, unknown>>({});
  const [renewInitialized, setRenewInitialized] = useState(false);

  if (demande && !notesInitialized[0]) {
    setNoteComm(demande.note_commercial || "");
    setNoteOpe(demande.note_operationnel || "");
    notesInitialized[1](true);
  }

  if (demande && !renewInitialized) {
    setRenewForm({
      nom: demande.nom,
      telephone_direct: demande.telephone_direct,
      telephone_whatsapp: demande.telephone_whatsapp,
      type_service: demande.type_service,
      type_prestation: demande.type_prestation,
      type_bien: demande.type_bien,
      frequence: demande.frequence,
      ville: demande.ville,
      quartier: demande.quartier,
      adresse: demande.adresse,
      montant_total: demande.montant_total,
      duree_heures: demande.duree_heures,
      nombre_intervenants: demande.nombre_intervenants,
      avec_produit: demande.avec_produit,
      email: (demande as any).email,
      nom_entreprise: (demande as any).nom_entreprise,
      contact_entreprise: (demande as any).contact_entreprise,
    });
    setRenewInitialized(true);
  }

  const createRenewalMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const { error } = await supabase.from("demandes").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demandes"] });
      toast({ title: "Demande renouvelée", description: "Une nouvelle demande a été créée avec succès." });
      setRenewOpen(false);
    },
  });

  const switchToAboMutation = useMutation({
    mutationFn: async (frequence: string) => {
      if (!demandeId) return;
      const { error } = await supabase.from("demandes").update({ frequence }).eq("id", demandeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demande", demandeId] });
      queryClient.invalidateQueries({ queryKey: ["demandes"] });
      toast({ title: "Abonnement activé", description: "La demande a été convertie en abonnement." });
      setSwitchAboOpen(false);
    },
  });

  const handleRenew = () => {
    createRenewalMutation.mutate({
      ...renewForm,
      services_optionnels: "[]",
      statut: "en_attente",
    });
  };

  const fideliteCount = allClientDemandes.length;

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
  const isReservation = ["confirme", "confirme_intervention", "prestation_effectuee", "paye"].includes(demande.statut);

  const saveNotes = () => {
    updateMutation.mutate({ note_commercial: noteComm || null, note_operationnel: noteOpe || null });
  };

  // Mock history actions (future: store in a separate table)
  const historyActions = [
    { user: "Système", date: demande.created_at, action: "Demande créée", note: "" },
    ...(demande.confirmed_at ? [{ user: "Commercial", date: demande.confirmed_at, action: "Demande confirmée", note: "" }] : []),
    ...(demande.confirmation_ope === "confirme" ? [{ user: "Opérationnel", date: demande.confirmed_at || demande.created_at, action: "Confirmation opérationnelle", note: demande.note_operationnel || "" }] : []),
    ...(demande.statut === "annulee" ? [{ user: "Commercial", date: demande.created_at, action: "Demande annulée", note: demande.motif_annulation || "" }] : []),
  ];

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
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
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-foreground leading-tight">{demande.nom}</h1>
                <Badge variant="outline" className="text-[10px] border-primary/30 text-primary font-semibold">
                  <Heart className="h-3 w-3 mr-1" /> x{fideliteCount}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground font-mono">#{demande.num_demande}</span>
                <Badge className={demande.type_service === "SPP" ? "bg-primary text-primary-foreground text-[10px]" : "bg-spe text-spe-foreground text-[10px]"}>
                  {demande.type_service === "SPP" ? "Particulier" : "Entreprise"}
                </Badge>
                {s && (
                  <Badge variant="outline" className="border-0 text-[10px] font-medium" style={{ backgroundColor: s.hex === "#ffffff" ? "#e2e8f0" : s.hex, color: s.hex === "#ffffff" ? "#334155" : "#ffffff" }}>
                    {s.label}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">

        {/* Row: Infos Client + Historique Fidélité */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Section title="Informations Client" icon={User} defaultOpen colorClass="bg-[hsl(210,40%,96%)]">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              <InfoItem label="Nom complet" value={demande.nom} />
              <InfoItem label="Segment" value={demande.type_service === "SPP" ? "Particulier" : "Entreprise"} />
              <InfoItem label="Téléphone direct" value={demande.telephone_direct} />
              <InfoItem label="WhatsApp" value={demande.telephone_whatsapp} />
              <InfoItem label="Email" value={d.email} />
              <InfoItem label="Ville" value={demande.ville} />
              <InfoItem label="Quartier" value={demande.quartier} />
              <InfoItem label="Adresse" value={demande.adresse} />
              {d.nom_entreprise && <InfoItem label="Entreprise" value={d.nom_entreprise} />}
              {d.contact_entreprise && <InfoItem label="Contact entreprise" value={d.contact_entreprise} />}
            </div>
          </Section>

          <Section title="Historique Fidélité" icon={Heart} defaultOpen colorClass="bg-[hsl(330,40%,96%)]" count={fideliteCount}>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Ce client a fait appel à nos services <strong className="text-foreground">{fideliteCount} fois</strong>.
              </p>
              {allClientDemandes.length > 0 && (
                <div className="max-h-[200px] overflow-y-auto space-y-1.5">
                  {allClientDemandes.map((cd) => {
                    const cs = STATUTS[cd.statut as keyof typeof STATUTS];
                    return (
                      <div key={cd.id} className="flex items-center justify-between p-2 bg-background/60 rounded-lg text-xs">
                        <div>
                          <span className="font-mono text-muted-foreground">#{cd.num_demande}</span>
                          <span className="ml-2 font-medium">{cd.type_prestation}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{format(new Date(cd.created_at), "dd/MM/yy")}</span>
                          {cs && (
                            <Badge variant="outline" className="border-0 text-[9px]" style={{ backgroundColor: cs.hex === "#ffffff" ? "#e2e8f0" : cs.hex, color: cs.hex === "#ffffff" ? "#334155" : "#fff" }}>
                              {cs.label}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Section>
        </div>

        {/* Row: Avis commercial + Avis opérationnel */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Section title="Avis Service Commercial" icon={MessageSquare} defaultOpen colorClass="bg-[hsl(45,50%,95%)]">
            <Textarea
              value={noteComm}
              onChange={(e) => setNoteComm(e.target.value)}
              rows={3}
              placeholder="Saisir un avis commercial..."
              className="resize-none bg-background/60 border-border focus:bg-background"
            />
          </Section>

          <Section title="Avis Service Opérationnel" icon={MessageSquare} defaultOpen colorClass="bg-[hsl(25,50%,95%)]">
            <Textarea
              value={noteOpe}
              onChange={(e) => setNoteOpe(e.target.value)}
              rows={3}
              placeholder="Saisir un avis opérationnel..."
              className="resize-none bg-background/60 border-border focus:bg-background"
            />
          </Section>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={saveNotes} disabled={updateMutation.isPending} className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> Enregistrer les avis
          </Button>
        </div>

        {/* Fréquence */}
        <Section title="Type de Fréquence" icon={Clock} defaultOpen colorClass="bg-[hsl(160,30%,95%)]">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-sm px-3 py-1">{freq?.label || demande.frequence}</Badge>
              <span className="text-sm text-muted-foreground">
                {demande.frequence === "ponctuel" ? "Intervention unique" : `Abonnement — ${freq?.label}`}
              </span>
            </div>
            {demande.frequence !== "ponctuel" && (
              <div className="space-y-2 border-t pt-3">
                <p className="text-xs font-semibold text-muted-foreground">Programmer les interventions</p>
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <Textarea
                      value={aboNote}
                      onChange={(e) => setAboNote(e.target.value)}
                      rows={2}
                      placeholder="Détails planning (ex : Lundi et Jeudi, 9h-12h)..."
                      className="resize-none bg-background/60"
                    />
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {aboDate ? format(aboDate, "dd/MM/yyyy") : "Date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={aboDate} onSelect={setAboDate} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* Détails besoin actuel */}
        <Section title="Détails Besoin Actuel" icon={Briefcase} defaultOpen colorClass="bg-[hsl(220,30%,96%)]">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
            <InfoItem label="Réf commande" value={<span className="font-mono">#{demande.num_demande}</span>} />
            <InfoItem label="Type de service" value={demande.type_prestation} />
            <InfoItem label="Type d'habitation" value={demande.type_bien} />
            <InfoItem label="Nombre d'heures" value={demande.duree_heures ? `${demande.duree_heures}h` : undefined} />
            <InfoItem label="Tarif" value={demande.montant_total ? `${demande.montant_total} MAD` : undefined} />
            <InfoItem label="Date intervention" value={demande.date_prestation} />
            <InfoItem label="Heure intervention" value={demande.heure_prestation} />
            <InfoItem label="Adresse" value={demande.adresse} />
            <InfoItem label="Ville" value={demande.ville} />
            <InfoItem label="Repère / Quartier" value={demande.quartier} />
            <InfoItem label="Date création" value={format(new Date(demande.created_at), "dd MMM yyyy à HH:mm", { locale: fr })} />
            <InfoItem label="Dernière modification" value={format(new Date(demande.created_at), "dd MMM yyyy à HH:mm", { locale: fr })} />
            {d.superficie_m2 && <InfoItem label="Superficie" value={`${d.superficie_m2} m²`} />}
            {d.etat_logement && <InfoItem label="État logement" value={d.etat_logement} />}
            {d.nature_intervention && <InfoItem label="Nature intervention" value={d.nature_intervention} />}
            <InfoItem label="Avec produit" value={d.avec_produit ? "Oui" : "Non"} />
            <InfoItem label="Mode paiement" value={d.mode_paiement} />
            <InfoItem label="Nbre intervenants" value={demande.nombre_intervenants} />
          </div>
          {demande.notes_client && (
            <div className="mt-3 p-3 bg-background/60 rounded-lg border border-border">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Notes du client</p>
              <p className="text-sm text-foreground">{demande.notes_client}</p>
            </div>
          )}
        </Section>

        {/* Détails réservation / devis */}
        <Section
          title={isReservation ? "Détails Réservation" : "Détails Devis"}
          icon={CreditCard}
          defaultOpen
          colorClass="bg-[hsl(270,25%,96%)]"
        >
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Réf</TableHead>
                  <TableHead>Tarif</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Fréquence</TableHead>
                  <TableHead>Création</TableHead>
                  <TableHead>Confirmation</TableHead>
                  <TableHead>Nb confirmations</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-mono text-xs">#{demande.num_demande}</TableCell>
                  <TableCell className="font-medium">{demande.montant_total ? `${demande.montant_total} MAD` : "—"}</TableCell>
                  <TableCell>
                    {s ? (
                      <Badge variant="outline" className="border-0 text-[10px]" style={{ backgroundColor: s.hex === "#ffffff" ? "#e2e8f0" : s.hex, color: s.hex === "#ffffff" ? "#334155" : "#fff" }}>
                        {s.label}
                      </Badge>
                    ) : demande.statut}
                  </TableCell>
                  <TableCell className="text-xs">{freq?.label || demande.frequence}</TableCell>
                  <TableCell className="text-xs">{format(new Date(demande.created_at), "dd/MM/yy HH:mm")}</TableCell>
                  <TableCell className="text-xs">{demande.confirmed_at ? format(new Date(demande.confirmed_at), "dd/MM/yy HH:mm") : "—"}</TableCell>
                  <TableCell className="text-center">1</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Télécharger PDF">
                        <FileDown className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>

            {/* Historique docs */}
            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Historique Documents</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date d'émission</TableHead>
                    <TableHead>Commercial</TableHead>
                    <TableHead>Segment</TableHead>
                    <TableHead>Type de service</TableHead>
                    <TableHead>Statut demande</TableHead>
                    <TableHead className="text-center">Fichier (PNG/PDF)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-xs">{format(new Date(demande.created_at), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="text-xs font-medium">—</TableCell>
                    <TableCell>
                      <Badge className={demande.type_service === "SPP" ? "bg-primary text-primary-foreground text-[10px]" : "bg-spe text-spe-foreground text-[10px]"}>
                        {demande.type_service === "SPP" ? "Particulier" : "Entreprise"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{demande.type_prestation}</TableCell>
                    <TableCell>
                      {s ? (
                        <Badge variant="outline" className="border-0 text-[10px]" style={{ backgroundColor: s.hex === "#ffffff" ? "#e2e8f0" : s.hex, color: s.hex === "#ffffff" ? "#334155" : "#fff" }}>
                          {s.label}
                        </Badge>
                      ) : demande.statut}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Voir le formulaire">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Télécharger">
                          <FileDown className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </Section>

        {/* Candidatures proposées */}
        <Section title="Candidatures Proposées" icon={Users} colorClass="bg-[hsl(140,30%,95%)]" count={d.candidat_nom ? 1 : 0}>
          {d.candidat_nom ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom prénom</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Avis du client</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">{d.candidat_nom}</TableCell>
                  <TableCell>
                    {statutCand ? (
                      <Badge variant="outline">{statutCand.label}</Badge>
                    ) : (
                      <Badge variant="outline">Présenté</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">—</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-2">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Aucune candidature proposée</p>
            </div>
          )}
        </Section>

        {/* Historique actions */}
        <Section title="Historique" icon={Clock} colorClass="bg-[hsl(0,0%,96%)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyActions.map((h, i) => (
                <TableRow key={i}>
                  <TableCell className="text-sm font-medium">{h.user}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(h.date), "dd/MM/yy HH:mm")}</TableCell>
                  <TableCell className="text-sm">{h.action}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{h.note || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
      </div>
    </div>
  );
}
