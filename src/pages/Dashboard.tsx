import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { RefreshCw, Search, LayoutList, LayoutGrid, MoreVertical, Pencil, MessageSquare, Eye, Users, CheckCircle, UserCheck, Settings, Archive, Pause, Trash2, XCircle, Send, CreditCard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TYPES_PRESTATION, FREQUENCES, STATUTS, STATUTS_PAIEMENT_COMMERCIAL } from "@/lib/constants";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { EditBesoinModal } from "@/components/dashboard/EditBesoinModal";
import { CandidatureModal } from "@/components/dashboard/CandidatureModal";
import { ConfirmationOpeModal } from "@/components/dashboard/ConfirmationOpeModal";

type Demande = Tables<"demandes">;

// Status color mapping for row backgrounds
const STATUS_ROW_COLORS: Record<string, string> = {
  nouveau_besoin: "bg-[hsl(210,80%,95%)]",
  en_attente_confirmation: "bg-[hsl(50,80%,93%)]",
  en_attente_profil: "bg-[hsl(50,80%,93%)]",
  confirme: "bg-[hsl(185,50%,93%)]",
  confirme_intervention: "bg-[hsl(170,45%,91%)]",
  prestation_effectuee: "bg-[hsl(35,90%,93%)]",
  facturation_en_cours: "bg-[hsl(100,60%,93%)]",
  facturation_partielle: "bg-[hsl(45,80%,93%)]",
  standby: "bg-[hsl(220,15%,93%)]",
  cloturee: "bg-[hsl(220,10%,95%)]",
  facturation_annulee: "bg-[hsl(350,80%,95%)]",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterService, setFilterService] = useState("all");
  const [filterPrestation, setFilterPrestation] = useState("all");
  const [viewMode, setViewMode] = useState<"table" | "card">("table");

  // Modal states
  const [selectedDemande, setSelectedDemande] = useState<Demande | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [editBesoinOpen, setEditBesoinOpen] = useState(false);
  const [candidatureOpen, setCandidatureOpen] = useState(false);
  const [confirmOpeOpen, setConfirmOpeOpen] = useState(false);
  const [noteType, setNoteType] = useState<"commercial" | "operationnel">("commercial");
  const [noteText, setNoteText] = useState("");

  // Post-confirmation note + send candidature state
  const [confirmNoteOpen, setConfirmNoteOpen] = useState(false);
  const [confirmNoteText, setConfirmNoteText] = useState("");

  // Report modal state (edit date/time)
  const [reportOpen, setReportOpen] = useState(false);
  const [reportDate, setReportDate] = useState("");
  const [reportHeure, setReportHeure] = useState("");

  // Facturation annulée modal
  const [factAnnuleeOpen, setFactAnnuleeOpen] = useState(false);
  const [factAnnuleeRaison, setFactAnnuleeRaison] = useState("");
  const [factAnnuleePayerProfil, setFactAnnuleePayerProfil] = useState(false);
  const [factAnnuleeMontantProfil, setFactAnnuleeMontantProfil] = useState("");

  const { data: allDemandes = [], isLoading, refetch } = useQuery({
    queryKey: ["demandes", "confirmed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandes")
        .select("*")
        .in("statut", ["confirmee", "cloturee", "standby", "nouveau_besoin", "en_attente_confirmation", "en_attente_profil", "confirme", "confirme_intervention", "prestation_effectuee", "facturation_en_cours", "facturation_partielle"])
        .order("confirmed_at", { ascending: false });
      if (error) throw error;
      return data as Demande[];
    },
  });

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["demandes", "pending_count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("demandes")
        .select("*", { count: "exact", head: true })
        .eq("statut", "en_attente");
      return count || 0;
    },
  });

  // Count all demandes per client name (across all statuses) for recurrence badge
  const { data: allDemandesForCount = [] } = useQuery({
    queryKey: ["demandes", "all_for_count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandes")
        .select("nom");
      if (error) throw error;
      return data;
    },
  });

  const clientCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    allDemandesForCount.forEach((d) => {
      const name = d.nom?.trim().toLowerCase();
      if (name) map[name] = (map[name] || 0) + 1;
    });
    return map;
  }, [allDemandesForCount]);

  // Auto-sync facturation when status changes
  const syncFacturation = async (demandeId: string, newStatut: string) => {
    // Find the demande data
    const demande = allDemandes.find((d) => d.id === demandeId);
    if (!demande) return;

    const statusesToCreate = ["confirmee", "nouveau_besoin", "confirme", "confirme_intervention", "prestation_effectuee", "paye", "facturation_en_cours", "facturation_partielle"];
    const statusesToUpdate = ["confirme_intervention", "prestation_effectuee", "paye", "facturation_annulee", "facturation_en_cours", "facturation_partielle"];

    // Check if facturation already exists for this demande
    const { data: existing } = await supabase
      .from("facturation")
      .select("id")
      .eq("demande_id", demandeId)
      .maybeSingle();

    if (!existing && statusesToCreate.includes(newStatut)) {
      // Lookup profil_id from candidat_nom
      let profilId: string | null = null;
      if (demande.candidat_nom) {
        const { data: matchedProfil } = await supabase
          .from("profils")
          .select("id")
          .or(`nom.ilike.%${demande.candidat_nom.split(" ").pop()}%`)
          .limit(1)
          .maybeSingle();
        if (matchedProfil) profilId = matchedProfil.id;
      }

      // Create new facturation entry
      const segment = demande.type_service === "SPE" ? "entreprise" : "particulier";
      const montantTotal = demande.montant_total || 0;
      await supabase.from("facturation").insert({
        demande_id: demandeId,
        nom_client: demande.nom,
        profil_id: profilId,
        profil_nom: demande.candidat_nom || null,
        ville: demande.ville,
        type_service: demande.type_prestation,
        date_intervention: demande.date_prestation || null,
        montant_total: montantTotal,
        commission_pourcentage: 50,
        mode_paiement_prevu: demande.mode_paiement || null,
        segment,
        encaisse_par: "agence",
        montant_encaisse_profil: 0,
        statut_mission: newStatut === "paye" ? "paye" : newStatut === "prestation_effectuee" ? "terminee" : "confirmee",
        statut_paiement: newStatut === "paye" ? "paye" : "non_paye",
      });
    } else if (existing && statusesToUpdate.includes(newStatut)) {
      // Update existing facturation — ne pas écraser encaisse_par (modifiable uniquement manuellement)
      const missionStatus = newStatut === "paye" ? "paye" : newStatut === "prestation_effectuee" ? "terminee" : newStatut === "facturation_annulee" ? "facturation_annulee" : newStatut === "facturation_en_cours" ? "confirmee" : newStatut === "facturation_partielle" ? "confirmee" : "confirmee";
      const updates: Record<string, unknown> = {
        statut_mission: missionStatus,
      };
      if (newStatut === "paye") {
        updates.statut_paiement = "paye";
        updates.montant_paye_client = demande.montant_total || 0;
        updates.date_paiement_client = new Date().toISOString().split("T")[0];
      }
      await supabase.from("facturation").update(updates).eq("id", existing.id);
    }
  };

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase.from("demandes").update(updates).eq("id", id);
      if (error) throw error;
      // Auto-sync facturation if status changed
      if (updates.statut && typeof updates.statut === "string") {
        await syncFacturation(id, updates.statut);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demandes"] });
      queryClient.invalidateQueries({ queryKey: ["facturation"] });
      toast({ title: "Mis à jour" });
      setNoteOpen(false);
      setConfirmNoteOpen(false);
      setReportOpen(false);
    },
  });

  const applyFilters = (demandes: Demande[]) => {
    let result = demandes;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((d) =>
        d.nom.toLowerCase().includes(q) || d.type_prestation.toLowerCase().includes(q) ||
        d.quartier?.toLowerCase().includes(q) || String(d.num_demande).includes(q)
      );
    }
    if (filterService !== "all") result = result.filter((d) => d.type_service === filterService);
    if (filterPrestation !== "all") result = result.filter((d) => d.type_prestation === filterPrestation);
    return result;
  };

  const besoins = applyFilters(allDemandes.filter((d) => d.frequence === "ponctuel"));
  const abonnements = applyFilters(allDemandes.filter((d) => d.frequence !== "ponctuel"));
  const filtered = applyFilters(allDemandes);

  const sppCount = filtered.filter((d) => d.type_service === "SPP").length;
  const speCount = filtered.filter((d) => d.type_service === "SPE").length;

  // KPI data (no separate SPP/SPE cards)


  const openModal = (d: Demande, modal: "detail" | "editBesoin" | "candidature" | "confirmOpe") => {
    setSelectedDemande(d);
    if (modal === "detail") setDetailOpen(true);
    else if (modal === "editBesoin") setEditBesoinOpen(true);
    else if (modal === "candidature") setCandidatureOpen(true);
    else if (modal === "confirmOpe") setConfirmOpeOpen(true);
  };

  const openCompteClient = (d: Demande) => {
    navigate(`/compte-client?id=${d.id}&from=/`);
  };

  const openNote = (d: Demande, type: "commercial" | "operationnel") => {
    setSelectedDemande(d);
    setNoteType(type);
    setNoteText(type === "commercial" ? (d.note_commercial || "") : (d.note_operationnel || ""));
    setNoteOpen(true);
  };

  const saveNote = () => {
    if (!selectedDemande) return;
    const field = noteType === "commercial" ? "note_commercial" : "note_operationnel";
    updateMutation.mutate({ id: selectedDemande.id, updates: { [field]: noteText } });
  };

  const handleSave = (updates: Record<string, unknown>) => {
    if (!selectedDemande) return;
    updateMutation.mutate({ id: selectedDemande.id, updates });
  };

  // Handle confirmation opé result
  const handleConfirmOpeResult = (updates: Record<string, unknown>) => {
    if (!selectedDemande) return;
    
    // If confirmed → show note + send candidature panel
    if (updates.confirmation_ope === "confirme") {
      updateMutation.mutate({ id: selectedDemande.id, updates }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["demandes"] });
          setConfirmNoteText("");
          setConfirmNoteOpen(true);
        }
      });
      return;
    }

    // If report → open date/time edit
    if (updates.confirmation_ope === "report") {
      updateMutation.mutate({ id: selectedDemande.id, updates: { ...updates } });
      setReportDate(selectedDemande.date_prestation || "");
      setReportHeure(selectedDemande.heure_prestation || "");
      setReportOpen(true);
      return;
    }

    // If annulé → archive (disappears from dashboard, goes to historique + listing client)
    if (updates.confirmation_ope === "annule") {
      updateMutation.mutate({ id: selectedDemande.id, updates: { ...updates, statut: "annulee" } });
      toast({ title: "Demande annulée", description: "Archivée dans l'historique et le listing client." });
      return;
    }

    updateMutation.mutate({ id: selectedDemande.id, updates });
  };

  const saveReport = () => {
    if (!selectedDemande) return;
    updateMutation.mutate({ 
      id: selectedDemande.id, 
      updates: { 
        date_prestation: reportDate || null, 
        heure_prestation: reportHeure || null,
        date_report: reportDate || null,
      } 
    });
  };

  const saveConfirmNote = () => {
    if (!selectedDemande) return;
    updateMutation.mutate({ 
      id: selectedDemande.id, 
      updates: { note_operationnel: confirmNoteText || null } 
    });
  };

  const sendCandidature = () => {
    if (!selectedDemande) return;
    // Save note first, then toast about candidature
    updateMutation.mutate({ 
      id: selectedDemande.id, 
      updates: { note_operationnel: confirmNoteText || null } 
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["demandes"] });
        toast({ title: "Candidature envoyée", description: "La candidature a été envoyée au client." });
        setConfirmNoteOpen(false);
      }
    });
  };

  const renderServiceBadge = (type: string) => (
    <Badge className={type === "SPP" ? "bg-primary text-primary-foreground" : "bg-spe text-spe-foreground"}>{type}</Badge>
  );

  const renderStatusBadge = (statut: string) => {
    const s = STATUTS[statut as keyof typeof STATUTS];
    return s ? (
      <Badge variant="outline" className="border-0 font-medium text-[10px] leading-tight whitespace-normal text-center max-w-[80px]" style={{ backgroundColor: s.hex, color: "#ffffff" }}>
        {s.label}
      </Badge>
    ) : <Badge variant="outline" className="text-xs">{statut}</Badge>;
  };

  // Main Action dropdown
   const renderActionButtons = (d: Demande) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="h-7 w-7">
          <Settings className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => openModal(d, "editBesoin")}>
          <Pencil className="h-4 w-4 mr-2" />Éditer le besoin
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => {
          setSelectedDemande(d);
          setConfirmOpeOpen(true);
        }}>
          <CheckCircle className="h-4 w-4 mr-2" />Confirmation Opé
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openCompteClient(d)}>
          <UserCheck className="h-4 w-4 mr-2" />Compte Client
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Context menu (3 dots or pencil icon)
  const renderQuickMenu = (d: Demande) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => openModal(d, "editBesoin")}>
          <Pencil className="h-4 w-4 mr-2" />Éditer le besoin
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => openNote(d, "commercial")}>
          <MessageSquare className="h-4 w-4 mr-2" />Note commerciale
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openNote(d, "operationnel")}>
          <MessageSquare className="h-4 w-4 mr-2" />Note opérationnelle
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => updateMutation.mutate({ id: d.id, updates: { statut: "prestation_effectuee" } })} className="text-sky-600">
          <CheckCircle className="h-4 w-4 mr-2" />Prestation effectuée
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => updateMutation.mutate({ id: d.id, updates: { statut: "annulee" } })} className="text-destructive">
          <XCircle className="h-4 w-4 mr-2" />Rejeté / Annulé
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { setSelectedDemande(d); setFactAnnuleeRaison(""); setFactAnnuleePayerProfil(false); setFactAnnuleeMontantProfil(""); setFactAnnuleeOpen(true); }} className="text-orange-600">
          <XCircle className="h-4 w-4 mr-2" />Facturation annulée
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => updateMutation.mutate({ id: d.id, updates: { statut: "annulee" } })} className="text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />Supprimer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderTable = (data: Demande[]) => (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs font-bold px-1 w-8 leading-tight"></TableHead>
            <TableHead className="text-xs font-bold px-1 leading-tight">Com</TableHead>
            <TableHead className="text-xs font-bold px-1 leading-tight">Date</TableHead>
            <TableHead className="text-xs font-bold px-1 leading-tight whitespace-normal">Statut besoin</TableHead>
            <TableHead className="text-xs font-bold px-1 leading-tight">Client</TableHead>
            <TableHead className="text-xs font-bold px-1 leading-tight max-w-[60px]">Lieu</TableHead>
            <TableHead className="text-xs font-bold px-1 leading-tight max-w-[60px] truncate">Service</TableHead>
            <TableHead className="text-xs font-bold px-1 leading-tight">Seg.</TableHead>
            <TableHead className="text-xs font-bold px-1 leading-tight">Hrs</TableHead>
            <TableHead className="text-xs font-bold px-1 leading-tight">Profil</TableHead>
            <TableHead className="text-xs font-bold px-1 leading-tight whitespace-normal">Opt. sup.</TableHead>
            <TableHead className="text-xs font-bold px-1 leading-tight">CAO</TableHead>
            <TableHead className="text-xs font-bold px-1 leading-tight whitespace-normal">Mode paie.</TableHead>
            <TableHead className="text-xs font-bold px-1 leading-tight whitespace-normal">Statut paie.</TableHead>
            <TableHead className="text-xs font-bold px-1 leading-tight">Tarif</TableHead>
            <TableHead className="text-xs font-bold px-1 w-6"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
           <TableRow><TableCell colSpan={16} className="text-center text-muted-foreground py-8">Aucune demande</TableCell></TableRow>
          ) : data.map((d) => {
            const rowColor = STATUS_ROW_COLORS[d.statut] || "";
            return (
              <TableRow key={d.id} className={rowColor}>
                <TableCell className="px-1">{renderActionButtons(d)}</TableCell>
                <TableCell className="text-[11px] px-1">{d.note_commercial ? "Mehdi" : "Kaoutar"}</TableCell>
                <TableCell className="text-[11px] px-1 whitespace-nowrap">
                  {d.date_prestation ? format(new Date(d.date_prestation + "T00:00:00"), "dd/MM/yy", { locale: fr }) : "—"}
                  {d.heure_prestation && <span className="text-muted-foreground ml-1">{d.heure_prestation.slice(0,5)}</span>}
                </TableCell>
                <TableCell className="px-1">{renderStatusBadge(d.statut)}</TableCell>
                <TableCell className="px-1">
                  <div className="flex items-center gap-1">
                    <button
                      className="text-primary underline hover:text-primary/80 font-medium text-[11px] cursor-pointer truncate max-w-[80px]"
                      onClick={() => openCompteClient(d)}
                    >
                      {d.nom}
                    </button>
                    {(() => {
                      const count = clientCountMap[d.nom?.trim().toLowerCase()] || 0;
                      if (count <= 1) return null;
                      return (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 shrink-0 border-primary/30 text-primary">
                          x{count}
                        </Badge>
                      );
                    })()}
                  </div>
                </TableCell>
                <TableCell className="text-[11px] px-1 truncate max-w-[60px]">
                  {d.quartier ? `${d.quartier}, ${d.ville}` : d.ville}
                </TableCell>
                <TableCell className="text-[11px] px-1 truncate max-w-[60px]">{d.type_prestation}</TableCell>
                <TableCell className="px-1">{renderServiceBadge(d.type_service)}</TableCell>
                <TableCell className="text-[11px] px-1 text-center">{d.duree_heures ? `${d.duree_heures}h` : "—"}</TableCell>
                <TableCell className="text-[11px] px-1">
                  {d.candidat_nom ? (
                    <button 
                      className="text-primary underline hover:text-primary/80 font-medium cursor-pointer text-[11px] truncate max-w-[70px] block"
                      onClick={() => navigate(`/compte-profil?nom=${encodeURIComponent(d.candidat_nom!)}`)}
                    >
                      {d.candidat_nom}
                    </button>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-[11px] px-1 text-center">
                  {d.avec_produit ? (
                    <Badge className="bg-primary/10 text-primary text-[10px]">Oui</Badge>
                  ) : (
                    <span className="text-muted-foreground">Non</span>
                  )}
                </TableCell>
                <TableCell className="text-[11px] px-1">
                  {d.confirmation_ope === "confirme" ? (
                    <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">Oui</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">Non</Badge>
                  )}
                </TableCell>
                <TableCell className="text-[11px] px-1 truncate max-w-[55px]">
                  {d.mode_paiement || "—"}
                </TableCell>
                <TableCell className="text-[11px] px-1">
                  {(() => {
                    const sp = d.statut_paiement_commercial;
                    if (sp === "paye") return <Badge className="bg-emerald-100 text-emerald-800 text-[9px] px-1">Payé</Badge>;
                    if (sp === "agence_payee_client") return <Badge className="bg-blue-100 text-blue-800 text-[9px] px-1">Agence payée</Badge>;
                    if (sp === "profil_paye_client") return <Badge className="bg-orange-100 text-orange-800 text-[9px] px-1">Profil payé</Badge>;
                    if (sp === "paiement_partiel") return <Badge className="bg-amber-100 text-amber-800 text-[9px] px-1">Partiel</Badge>;
                    return <Badge variant="outline" className="text-[9px] px-1">Non payé</Badge>;
                  })()}
                </TableCell>
                <TableCell className="text-[11px] px-1 font-medium whitespace-nowrap">
                  {d.montant_total ? `${d.montant_total} MAD` : "—"}
                </TableCell>
                <TableCell className="px-1">{renderQuickMenu(d)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );

  const renderCards = (data: Demande[]) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.length === 0 ? (
        <p className="text-muted-foreground col-span-full text-center py-8">Aucune demande</p>
      ) : data.map((d) => {
        const rowColor = STATUS_ROW_COLORS[d.statut] || "";
        return (
          <Card key={d.id} className={`hover:shadow-md transition-shadow ${rowColor}`}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="cursor-pointer" onClick={() => openCompteClient(d)}>
                  <p className="font-semibold">{d.nom}</p>
                  <p className="text-xs text-muted-foreground">#{d.num_demande} · {d.type_prestation}</p>
                </div>
                <div className="flex items-center gap-1">
                  {renderServiceBadge(d.type_service)}
                  {renderQuickMenu(d)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1 text-sm">
                <p><span className="text-muted-foreground">Date :</span> {d.date_prestation || "—"}</p>
                <p><span className="text-muted-foreground">Heures :</span> {d.duree_heures ? `${d.duree_heures}h` : "—"}</p>
                <p><span className="text-muted-foreground">Lieu :</span> {d.quartier || d.ville}</p>
                <p><span className="text-muted-foreground">Tarif :</span> {d.montant_total ? `${d.montant_total} MAD` : "—"}</p>
              </div>
              <div className="flex items-center gap-2">
                {renderStatusBadge(d.statut)}
                {d.avec_produit && <Badge variant="outline" className="text-[10px]">+ Produit</Badge>}
              </div>
              <div className="flex gap-1 pt-1 border-t">
                {renderActionButtons(d)}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  const renderContent = (data: Demande[]) => viewMode === "table" ? renderTable(data) : renderCards(data);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Tableau de bord</h1>
        <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />Actualiser
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4">
        <Card
          className="bg-gradient-to-br from-[#e8920a] to-[#fcc35c] border-0 cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => {
            setFilterService("all");
            setFilterPrestation("all");
            setSearch("");
          }}
        >
          <CardContent className="p-4 text-center">
            <p className="text-4xl font-bold text-white">{allDemandes.filter(d => d.statut === "nouveau_besoin").length}</p>
            <p className="text-sm mt-1 text-white opacity-80">Demandes en cours</p>
            <p className="text-xs mt-0.5 text-white opacity-70">
              {allDemandes.filter(d => d.statut === "nouveau_besoin" && d.type_service === "SPP").length} particulier(s) · {allDemandes.filter(d => d.statut === "nouveau_besoin" && d.type_service === "SPE").length} entreprise(s)
            </p>
          </CardContent>
        </Card>
        <Card
          className="bg-gradient-to-br from-[#b8a20e] to-[#e8d84a] border-0 cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => navigate("/demandes")}
        >
          <CardContent className="p-4 text-center">
            <p className="text-4xl font-bold text-white">{pendingCount}</p>
            <p className="text-sm mt-1 text-white opacity-80">En attente</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterService} onValueChange={setFilterService}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous segments</SelectItem>
            <SelectItem value="SPP">SPP</SelectItem>
            <SelectItem value="SPE">SPE</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPrestation} onValueChange={setFilterPrestation}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes prestations</SelectItem>
            {TYPES_PRESTATION.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex border rounded-md">
          <Button variant={viewMode === "table" ? "default" : "ghost"} size="icon" onClick={() => setViewMode("table")}><LayoutList className="h-4 w-4" /></Button>
          <Button variant={viewMode === "card" ? "default" : "ghost"} size="icon" onClick={() => setViewMode("card")}><LayoutGrid className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="besoins">
        <TabsList>
          <TabsTrigger value="besoins">Besoins ({besoins.length})</TabsTrigger>
          <TabsTrigger value="abonnements">Abonnements ({abonnements.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="besoins">{renderContent(besoins)}</TabsContent>
        <TabsContent value="abonnements">{renderContent(abonnements)}</TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Détails — #{selectedDemande?.num_demande}</DialogTitle></DialogHeader>
          {selectedDemande && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Nom :</span> {selectedDemande.nom}</div>
                <div><span className="text-muted-foreground">Tél. direct :</span> {selectedDemande.telephone_direct}</div>
                <div><span className="text-muted-foreground">WhatsApp :</span> {selectedDemande.telephone_whatsapp}</div>
                <div><span className="text-muted-foreground">Service :</span> {renderServiceBadge(selectedDemande.type_service)}</div>
                <div><span className="text-muted-foreground">Prestation :</span> {selectedDemande.type_prestation}</div>
                <div><span className="text-muted-foreground">Fréquence :</span> {FREQUENCES.find(f => f.value === selectedDemande.frequence)?.label || selectedDemande.frequence}</div>
                <div><span className="text-muted-foreground">Durée :</span> {selectedDemande.duree_heures ? `${selectedDemande.duree_heures}h` : "—"}</div>
                <div><span className="text-muted-foreground">Ville :</span> {selectedDemande.ville}</div>
                <div><span className="text-muted-foreground">Quartier :</span> {selectedDemande.quartier || "—"}</div>
                <div><span className="text-muted-foreground">Montant :</span> {selectedDemande.montant_total ? `${selectedDemande.montant_total} MAD` : "—"}</div>
              </div>
              {selectedDemande.notes_client && <div><span className="text-muted-foreground font-medium">Notes client :</span><p className="mt-1 p-2 bg-muted rounded">{selectedDemande.notes_client}</p></div>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Note Dialog */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Note {noteType === "commercial" ? "commerciale" : "opérationnelle"}</DialogTitle></DialogHeader>
          <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Saisir la note..." rows={4} />
          <div className="flex justify-end"><Button onClick={saveNote} disabled={updateMutation.isPending}>Enregistrer</Button></div>
        </DialogContent>
      </Dialog>

      {/* Post-Confirmation Note + Send Candidature Dialog */}
      <Dialog open={confirmNoteOpen} onOpenChange={setConfirmNoteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              Opération confirmée — #{selectedDemande?.num_demande}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-emerald-50 rounded-lg text-sm text-emerald-800">
              L'opération a été confirmée avec succès. Vous pouvez ajouter une note et envoyer la candidature au client.
            </div>
            <div>
              <Label>Note opérationnelle</Label>
              <Textarea 
                value={confirmNoteText} 
                onChange={(e) => setConfirmNoteText(e.target.value)} 
                rows={3} 
                placeholder="Ajouter une note..." 
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={saveConfirmNote} disabled={updateMutation.isPending}>
              Enregistrer la note
            </Button>
            <Button onClick={sendCandidature} disabled={updateMutation.isPending}>
              <Send className="h-4 w-4 mr-1" />Envoyer candidature
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Dialog — edit date/time */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Report — #{selectedDemande?.num_demande}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nouvelle date d'intervention</Label>
              <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
            </div>
            <div>
              <Label>Nouvelle heure</Label>
              <Input type="time" value={reportHeure} onChange={(e) => setReportHeure(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setReportOpen(false)}>Annuler</Button>
            <Button onClick={saveReport} disabled={updateMutation.isPending}>Enregistrer</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Facturation annulée Dialog */}
      <Dialog open={factAnnuleeOpen} onOpenChange={setFactAnnuleeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Facturation annulée — #{selectedDemande?.num_demande}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Raison de l'annulation</Label>
              <Textarea value={factAnnuleeRaison} onChange={(e) => setFactAnnuleeRaison(e.target.value)} rows={3} placeholder="Indiquer la raison..." />
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-sm">Le profil sera payé ?</Label>
              <div className="flex gap-2">
                <Button size="sm" variant={factAnnuleePayerProfil ? "default" : "outline"} onClick={() => setFactAnnuleePayerProfil(true)}>Oui</Button>
                <Button size="sm" variant={!factAnnuleePayerProfil ? "default" : "outline"} onClick={() => setFactAnnuleePayerProfil(false)}>Non</Button>
              </div>
            </div>
            {factAnnuleePayerProfil && (
              <div>
                <Label>Montant à payer au profil (MAD)</Label>
                <Input type="number" value={factAnnuleeMontantProfil} onChange={(e) => setFactAnnuleeMontantProfil(e.target.value)} placeholder="0" />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setFactAnnuleeOpen(false)}>Annuler</Button>
            <Button
              disabled={!factAnnuleeRaison || updateMutation.isPending}
              onClick={() => {
                if (!selectedDemande) return;
                const updates: Record<string, unknown> = {
                  statut: "facturation_annulee",
                  motif_annulation: factAnnuleeRaison,
                  montant_candidat: factAnnuleePayerProfil && factAnnuleeMontantProfil ? Number(factAnnuleeMontantProfil) : null,
                };
                updateMutation.mutate({ id: selectedDemande.id, updates }, {
                  onSuccess: () => setFactAnnuleeOpen(false),
                });
              }}
            >
              Confirmer l'annulation
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Besoin Modal */}
      {selectedDemande && (
        <>
          <EditBesoinModal demande={selectedDemande} open={editBesoinOpen} onOpenChange={setEditBesoinOpen} onSave={handleSave} />
          <CandidatureModal demande={selectedDemande} open={candidatureOpen} onOpenChange={setCandidatureOpen} onSave={handleSave} />
          <ConfirmationOpeModal demande={selectedDemande} open={confirmOpeOpen} onOpenChange={setConfirmOpeOpen} onSave={handleConfirmOpeResult} />
        </>
      )}
    </div>
  );
}
