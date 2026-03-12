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
  FileDown, Eye, Heart, FileText, Save, RefreshCw, Repeat, Star, ThumbsUp, ThumbsDown,
  Ban
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
        "flex items-center justify-between w-full px-5 py-3.5 rounded-t-xl text-sm font-semibold border border-border hover:shadow-sm transition-all group text-white",
        colorClass
      )}>
        <span className="flex items-center gap-2.5">
          <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-white/20 text-white">
            <Icon className="h-4 w-4" />
          </span>
          {title}
          {count !== undefined && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-white/20 text-white border-0">{count}</Badge>
          )}
        </span>
        <ChevronDown className="h-4 w-4 text-white/70 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-5 pt-3 pb-4 border border-t-0 border-border rounded-b-xl bg-card">
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

  const { data: feedback } = useQuery({
    queryKey: ["feedback_demande", demandeId],
    queryFn: async () => {
      if (!demandeId) return null;
      const { data } = await supabase.from("feedbacks").select("*").eq("demande_id", demandeId).maybeSingle();
      return data;
    },
    enabled: !!demandeId,
  });

  // All feedbacks for this client (by name)
  const { data: allClientFeedbacks = [] } = useQuery({
    queryKey: ["feedbacks_client", demande?.nom],
    queryFn: async () => {
      if (!demande?.nom) return [];
      const { data, error } = await supabase
        .from("feedbacks")
        .select("*")
        .ilike("nom_client", demande.nom.trim())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!demande?.nom,
  });

  // Facturation for this demande (candidat payment info)
  const { data: facturation } = useQuery({
    queryKey: ["facturation_demande", demandeId],
    queryFn: async () => {
      if (!demandeId) return null;
      const { data } = await supabase.from("facturation").select("*").eq("demande_id", demandeId).maybeSingle();
      return data;
    },
    enabled: !!demandeId,
  });

  const [detailFeedback, setDetailFeedback] = useState<any>(null);

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
  const [aboNbPersonnes, setAboNbPersonnes] = useState("");
  const [aboNbHeures, setAboNbHeures] = useState("");
  const [activeDemande, setActiveDemande] = useState<Demande | null>(null);

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
      const { error } = await supabase.from("demandes").insert(data as any);
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
      const targetId = activeDemande?.id || demandeId;
      if (!targetId) return;
      const { error } = await supabase.from("demandes").update({ frequence }).eq("id", targetId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demande", demandeId] });
      queryClient.invalidateQueries({ queryKey: ["demandes"] });
      toast({ title: "Abonnement activé", description: "La demande a été convertie en abonnement." });
      setSwitchAboOpen(false);
      setActiveDemande(null);
    },
  });

  const handleRenew = () => {
    createRenewalMutation.mutate({
      ...renewForm,
      services_optionnels: "[]",
      statut: "en_cours",
    });
  };

  const openRenewForDemande = (d: Demande) => {
    setRenewForm({
      nom: d.nom,
      telephone_direct: d.telephone_direct,
      telephone_whatsapp: d.telephone_whatsapp,
      type_service: d.type_service,
      type_prestation: d.type_prestation,
      type_bien: d.type_bien,
      frequence: d.frequence,
      ville: d.ville,
      quartier: d.quartier,
      adresse: d.adresse,
      montant_total: d.montant_total,
      duree_heures: d.duree_heures,
      nombre_intervenants: d.nombre_intervenants,
      avec_produit: d.avec_produit,
      email: (d as any).email,
      nom_entreprise: (d as any).nom_entreprise,
      contact_entreprise: (d as any).contact_entreprise,
    });
    setActiveDemande(d);
    setRenewOpen(true);
  };

  const openSwitchForDemande = (d: Demande) => {
    setActiveDemande(d);
    setSelectedFrequence("");
    setSwitchAboOpen(true);
  };

  // Tarif calculation for subscription based on frequency
  const calculateAboTarif = (baseTarif: number | null, freq: string) => {
    if (!baseTarif) return null;
    const multipliers: Record<string, number> = {
      "1_fois_semaine": 4,
      "2_fois_semaine": 8,
      "3_fois_semaine": 12,
      "4_fois_semaine": 16,
      "5_fois_semaine": 20,
      "6_fois_semaine": 24,
      quotidien: 28,
    };
    return baseTarif * (multipliers[freq] || 1);
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
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openRenewForDemande(demande)}>
            <RefreshCw className="h-3.5 w-3.5" /> Renouveler
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10">
            <Ban className="h-3.5 w-3.5" /> Black lister
          </Button>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">

        {/* Infos Client - full width */}
        <Section title="Informations Client" icon={User} defaultOpen colorClass="bg-[#027A76]">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1">
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

        {/* Historique Fidélité - full width below */}
        <Section title="Historique Fidélité" icon={Heart} defaultOpen colorClass="bg-[#E86C4F]" count={fideliteCount}>
          {allClientDemandes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Nom du service</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allClientDemandes.map((cd) => {
                  const cs = STATUTS[cd.statut as keyof typeof STATUTS];
                  return (
                    <TableRow key={cd.id}>
                      <TableCell className="text-xs">{format(new Date(cd.created_at), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="text-sm font-medium">{cd.type_prestation}</TableCell>
                      <TableCell>
                        <Badge className={cd.type_service === "SPP" ? "bg-primary text-primary-foreground text-[10px]" : "bg-spe text-spe-foreground text-[10px]"}>
                          {cd.type_service === "SPP" ? "Particulier" : "Entreprise"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {cs ? (
                          <Badge variant="outline" className="border-0 text-[10px]" style={{ backgroundColor: cs.hex === "#ffffff" ? "#e2e8f0" : cs.hex, color: cs.hex === "#ffffff" ? "#334155" : "#fff" }}>
                            {cs.label}
                          </Badge>
                        ) : cd.statut}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => openRenewForDemande(cd)}>
                            <RefreshCw className="h-3 w-3" /> Renouveler
                          </Button>
                          {cd.frequence === "ponctuel" && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => openSwitchForDemande(cd)}>
                              <Repeat className="h-3 w-3" /> Abonnement
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Voir détails"
                            onClick={() => navigate(`/compte-client?id=${cd.id}&from=${location.pathname}${location.search}`)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Télécharger">
                            <FileDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">Aucun historique de fidélité.</p>
          )}
        </Section>

        {/* Row: Avis commercial + Avis opérationnel */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Section title="Avis Service Commercial" icon={MessageSquare} defaultOpen colorClass="bg-[#F4A24C]">
            <Textarea
              value={noteComm}
              onChange={(e) => setNoteComm(e.target.value)}
              rows={3}
              placeholder="Saisir un avis commercial..."
              className="resize-none bg-background/60 border-border focus:bg-background"
            />
          </Section>

          <Section title="Avis Service Opérationnel" icon={MessageSquare} defaultOpen colorClass="bg-[#DBAE8D]">
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
        <Section title="Type de Fréquence" icon={Clock} defaultOpen colorClass="bg-[#BFDDCE]">
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
        <Section title="Détails Besoin Actuel" icon={Briefcase} defaultOpen colorClass="bg-[#006694]">
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

        {/* Historique Documents */}
        <Section
          title="Historique Documents"
          icon={FileText}
          defaultOpen
          colorClass="bg-[#d62f20]"
        >
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
        </Section>

        {/* Candidatures proposées */}
        <Section title="Candidats Proposés" icon={Users} colorClass="bg-[#b2d9b9]" count={d.candidat_nom ? 1 : 0}>
          {d.candidat_nom ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date d'intervention</TableHead>
                  <TableHead>Nom du profil</TableHead>
                  <TableHead>Statut profil</TableHead>
                  <TableHead>Statut paiement</TableHead>
                  <TableHead>Note du profil</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-xs">{demande.date_prestation || "—"}</TableCell>
                  <TableCell className="font-medium">{d.candidat_nom}</TableCell>
                  <TableCell>
                    {(() => {
                      const statutMap: Record<string, { label: string; color: string }> = {
                        envoye: { label: "Présenté", color: "bg-blue-100 text-blue-800" },
                        accepte: { label: "Présenté", color: "bg-green-100 text-green-800" },
                        refuse: { label: "Désistement", color: "bg-red-100 text-red-800" },
                        desistement: { label: "Désistement", color: "bg-red-100 text-red-800" },
                      };
                      const st = statutMap[d.statut_candidature] || { label: "Présenté", color: "bg-blue-100 text-blue-800" };
                      return <Badge className={st.color}>{st.label}</Badge>;
                    })()}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const paiementMap: Record<string, { label: string; color: string }> = {
                        non_paye: { label: "Non payé", color: "bg-red-100 text-red-800" },
                        paye: { label: "Payé", color: "bg-green-100 text-green-800" },
                        partiel: { label: "Partiel", color: "bg-yellow-100 text-yellow-800" },
                      };
                      const sp = facturation?.statut_paiement || d.statut_paiement_commercial || "non_paye";
                      const st = paiementMap[sp] || paiementMap.non_paye;
                      return <Badge className={st.color}>{st.label}</Badge>;
                    })()}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      // Map satisfaction from feedback to stars
                      const satisfactionStars: Record<string, number> = {
                        "Très satisfait": 5,
                        "Très satisfaite": 5,
                        "Satisfait": 4,
                        "Satisfaite": 4,
                        "Moyennement satisfait": 3,
                        "Moyennement satisfaite": 3,
                        "Pas satisfait": 2,
                        "Pas satisfaite": 2,
                        "Pas content": 1,
                        "Pas contente": 1,
                      };
                      const stars = feedback?.satisfaction ? (satisfactionStars[feedback.satisfaction] || 0) : 0;
                      if (!stars) return <span className="text-xs text-muted-foreground">—</span>;
                      return (
                        <span className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-3.5 w-3.5 ${i < stars ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                          ))}
                        </span>
                      );
                    })()}
                  </TableCell>
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

        {/* Feedback Client */}
        <Section title="Feedback Client" icon={Star} colorClass="bg-[#f37160]" count={allClientFeedbacks.length}>
          {allClientFeedbacks.length > 0 ? (
            <div className="space-y-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Profil</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Satisfaction</TableHead>
                    <TableHead>Note agence</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allClientFeedbacks.map((f: any) => {
                    const stKey = f.statut as string;
                    const stMap: Record<string, { label: string; color: string }> = {
                      en_attente: { label: "En attente", color: "bg-yellow-100 text-yellow-800" },
                      lien_envoye: { label: "Lien envoyé", color: "bg-blue-100 text-blue-800" },
                      positif: { label: "Positif", color: "bg-green-100 text-green-800" },
                      negatif: { label: "Négatif", color: "bg-red-100 text-red-800" },
                    };
                    const st = stMap[stKey] || stMap.en_attente;
                    return (
                      <TableRow key={f.id}>
                        <TableCell className="text-sm">{f.type_service || "—"}</TableCell>
                        <TableCell className="text-sm">
                          {f.profil_nom ? (
                            <button
                              className="text-primary hover:underline cursor-pointer font-medium"
                              onClick={() => {
                                // Find profil by name and navigate
                                supabase.from("profils").select("id").ilike("nom", f.profil_nom).limit(1).then(({ data }) => {
                                  if (data && data.length > 0) {
                                    navigate(`/compte-profil?id=${data[0].id}&from=/compte-client?id=${demandeId}`);
                                  }
                                });
                              }}
                            >
                              {f.profil_nom}
                            </button>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-xs">{f.date_prestation || "—"}</TableCell>
                        <TableCell>
                          {f.satisfaction ? (
                            <Badge className={
                              f.satisfaction === "Très satisfait" || f.satisfaction === "Satisfait"
                                ? "bg-green-100 text-green-800" : f.satisfaction === "Pas satisfait"
                                ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"
                            }>{f.satisfaction}</Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          {f.note_agence ? (
                            <span className="flex items-center gap-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star key={i} className={`h-3.5 w-3.5 ${i < f.note_agence ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                              ))}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell><Badge className={st.color}>{st.label}</Badge></TableCell>
                        <TableCell>
                          {f.submitted_at && (
                            <Button size="sm" variant="ghost" onClick={() => setDetailFeedback(f)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center py-6 text-center">
              <p className="text-sm text-muted-foreground">Aucun feedback associé à ce client</p>
            </div>
          )}
        </Section>

        {/* Detail feedback modal */}
        <Dialog open={!!detailFeedback} onOpenChange={() => setDetailFeedback(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Détail feedback — {detailFeedback?.nom_client}</DialogTitle>
            </DialogHeader>
            {detailFeedback && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Satisfaction :</span> <strong>{detailFeedback.satisfaction}</strong></div>
                  <div><span className="text-muted-foreground">Qualité ménage :</span> <strong>{detailFeedback.qualite_menage}</strong></div>
                  <div><span className="text-muted-foreground">Professionnel :</span> <strong>{detailFeedback.professionnel}</strong></div>
                  <div><span className="text-muted-foreground">Recommande profil :</span> <strong>{detailFeedback.recommande_profil ? "Oui" : "Non"}</strong></div>
                  <div><span className="text-muted-foreground">Recommande agence :</span> <strong>{detailFeedback.recommande_agence ? "Oui" : "Non"}</strong></div>
                  <div>
                    <span className="text-muted-foreground">Note agence :</span>{" "}
                    <span className="inline-flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3.5 w-3.5 ${i < (detailFeedback.note_agence || 0) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                      ))}
                    </span>
                  </div>
                </div>
                {detailFeedback.commentaire && (
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-muted-foreground text-xs mb-1">Commentaire</p>
                    <p>{detailFeedback.commentaire}</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Soumis le {new Date(detailFeedback.submitted_at!).toLocaleDateString("fr-FR")}</p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Historique actions */}
        <Section title="Historique" icon={Clock} colorClass="bg-[#a8d9ec]">
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

      {/* Renouveler Modal */}
      <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" /> Renouveler la demande
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Les informations ci-dessous sont pré-remplies depuis la demande actuelle. Vous pouvez les modifier avant de valider.
          </p>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Nom du client</Label>
                <Input value={String(renewForm.nom || "")} onChange={(e) => setRenewForm({ ...renewForm, nom: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Téléphone direct</Label>
                <Input value={String(renewForm.telephone_direct || "")} onChange={(e) => setRenewForm({ ...renewForm, telephone_direct: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>WhatsApp</Label>
                <Input value={String(renewForm.telephone_whatsapp || "")} onChange={(e) => setRenewForm({ ...renewForm, telephone_whatsapp: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Type de prestation</Label>
                <Input value={String(renewForm.type_prestation || "")} onChange={(e) => setRenewForm({ ...renewForm, type_prestation: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Ville</Label>
                <Input value={String(renewForm.ville || "")} onChange={(e) => setRenewForm({ ...renewForm, ville: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Quartier</Label>
                <Input value={String(renewForm.quartier || "")} onChange={(e) => setRenewForm({ ...renewForm, quartier: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Adresse</Label>
                <Input value={String(renewForm.adresse || "")} onChange={(e) => setRenewForm({ ...renewForm, adresse: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Tarif total (MAD)</Label>
                <Input type="number" value={String(renewForm.montant_total || "")} onChange={(e) => setRenewForm({ ...renewForm, montant_total: Number(e.target.value) || null })} />
              </div>
              <div className="space-y-1">
                <Label>Durée (heures)</Label>
                <Input type="number" value={String(renewForm.duree_heures || "")} onChange={(e) => setRenewForm({ ...renewForm, duree_heures: Number(e.target.value) || null })} />
              </div>
              <div className="space-y-1">
                <Label>Nombre d'intervenants</Label>
                <Input type="number" value={String(renewForm.nombre_intervenants || 1)} onChange={(e) => setRenewForm({ ...renewForm, nombre_intervenants: Number(e.target.value) || 1 })} />
              </div>
              <div className="space-y-1">
                <Label>Date intervention</Label>
                <Input type="date" value="" onChange={(e) => setRenewForm({ ...renewForm, date_prestation: e.target.value || null })} />
              </div>
              <div className="space-y-1">
                <Label>Heure intervention</Label>
                <Input type="time" value="" onChange={(e) => setRenewForm({ ...renewForm, heure_prestation: e.target.value || null })} />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => { setRenewOpen(false); setActiveDemande(null); }}>Annuler</Button>
            <Button onClick={handleRenew} disabled={createRenewalMutation.isPending} className="gap-1.5">
              <RefreshCw className="h-4 w-4" /> Activer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Switcher en abonnement Modal */}
      <Dialog open={switchAboOpen} onOpenChange={(open) => { setSwitchAboOpen(open); if (!open) setActiveDemande(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Repeat className="h-5 w-5 text-primary" /> Switcher en abonnement
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-3">
            <div className="space-y-1">
              <Label>Fréquence</Label>
              <Select value={selectedFrequence} onValueChange={setSelectedFrequence}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une fréquence" />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCES.filter(f => f.value !== "ponctuel").map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Nombre de personnes</Label>
              <Input type="number" min={1} value={aboNbPersonnes} onChange={(e) => setAboNbPersonnes(e.target.value)} placeholder="1" />
            </div>
            <div className="space-y-1">
              <Label>Nombre d'heures</Label>
              <Input type="number" min={1} value={aboNbHeures} onChange={(e) => setAboNbHeures(e.target.value)} placeholder="3" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => { setSwitchAboOpen(false); setActiveDemande(null); }}>Annuler</Button>
            <Button
              onClick={() => switchToAboMutation.mutate(selectedFrequence)}
              disabled={!selectedFrequence || switchToAboMutation.isPending}
              className="gap-1.5"
            >
              <Repeat className="h-4 w-4" /> Confirmer l'abonnement
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
