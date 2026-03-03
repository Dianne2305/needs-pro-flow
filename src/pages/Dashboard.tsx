import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { RefreshCw, Search, LayoutList, LayoutGrid, MoreVertical, Pencil, MessageSquare, Eye, Users, CheckCircle, UserCheck, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TYPES_PRESTATION, FREQUENCES, STATUTS } from "@/lib/constants";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { EditBesoinModal } from "@/components/dashboard/EditBesoinModal";
import { CandidatureModal } from "@/components/dashboard/CandidatureModal";
import { ConfirmationOpeModal } from "@/components/dashboard/ConfirmationOpeModal";

type Demande = Tables<"demandes">;

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
  // compteClient now navigates to page
  const [noteType, setNoteType] = useState<"commercial" | "operationnel">("commercial");
  const [noteText, setNoteText] = useState("");

  const { data: allDemandes = [], isLoading, refetch } = useQuery({
    queryKey: ["demandes", "confirmed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandes")
        .select("*")
        .in("statut", ["confirmee", "cloturee", "standby", "en_cours", "en_attente_profil", "confirme_intervention", "prestation_effectuee", "paye"])
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

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase.from("demandes").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demandes"] });
      toast({ title: "Mis à jour" });
      setNoteOpen(false);
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

  const kpis = [
    { label: "Demandes en cours", value: filtered.length, color: "text-primary" },
    { label: "Services Particuliers", value: sppCount, color: "text-primary" },
    { label: "Services Entreprises", value: speCount, color: "text-spe" },
    { label: "En attente", value: pendingCount, color: "text-amber-600" },
  ];

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

  const renderServiceBadge = (type: string) => (
    <Badge className={type === "SPP" ? "bg-primary text-primary-foreground" : "bg-spe text-spe-foreground"}>{type}</Badge>
  );

  const renderStatusBadge = (statut: string) => {
    const s = STATUTS[statut as keyof typeof STATUTS];
    return s ? (
      <Badge variant="outline" className="border-0 text-white font-medium" style={{ backgroundColor: s.hex === "#ffffff" ? "#e2e8f0" : s.hex, color: s.hex === "#ffffff" ? "#334155" : "#ffffff" }}>
        {s.label}
      </Badge>
    ) : <Badge variant="outline">{statut}</Badge>;
  };

  // Action buttons for each row
  const renderActionButtons = (d: Demande) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1">
          <Settings className="h-3.5 w-3.5" />Actions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => openModal(d, "editBesoin")}>
          <Pencil className="h-4 w-4 mr-2" />Éditer le besoin
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openModal(d, "candidature")}>
          <Users className="h-4 w-4 mr-2" />Candidature
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openModal(d, "confirmOpe")}>
          <CheckCircle className="h-4 w-4 mr-2" />Confirmation Opé
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openCompteClient(d)}>
          <UserCheck className="h-4 w-4 mr-2" />Compte Client
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Quick menu (3 dots)
  const renderQuickMenu = (d: Demande) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => openModal(d, "detail")}><Eye className="h-4 w-4 mr-2" />Voir détails</DropdownMenuItem>
        <DropdownMenuItem onClick={() => openNote(d, "commercial")}><MessageSquare className="h-4 w-4 mr-2" />Note commerciale</DropdownMenuItem>
        <DropdownMenuItem onClick={() => openNote(d, "operationnel")}><MessageSquare className="h-4 w-4 mr-2" />Note opérationnelle</DropdownMenuItem>
        <DropdownMenuItem onClick={() => updateMutation.mutate({ id: d.id, updates: { statut: "cloturee" } })}>Clôturer</DropdownMenuItem>
        <DropdownMenuItem onClick={() => updateMutation.mutate({ id: d.id, updates: { statut: "standby" } })}>Standby</DropdownMenuItem>
        <DropdownMenuItem onClick={() => updateMutation.mutate({ id: d.id, updates: { statut: "annulee" } })} className="text-destructive">Supprimer</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderTable = (data: Demande[]) => (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Actions</TableHead>
            <TableHead>Réf</TableHead>
            <TableHead>Date confirmation</TableHead>
            <TableHead>Date intervention</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Segment</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>Volume</TableHead>
            <TableHead>Intervenants</TableHead>
            <TableHead>Profil</TableHead>
            <TableHead>Quartier / Ville</TableHead>
            <TableHead>Type habitation</TableHead>
            <TableHead>Fréquence</TableHead>
            <TableHead>CAO</TableHead>
            <TableHead>Commercial</TableHead>
            <TableHead>Tarif</TableHead>
            <TableHead>Mode paiement</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow><TableCell colSpan={19} className="text-center text-muted-foreground py-8">Aucune demande</TableCell></TableRow>
          ) : data.map((d) => (
            <TableRow key={d.id}>
              <TableCell>{renderActionButtons(d)}</TableCell>
              <TableCell className="font-mono text-xs">#{d.num_demande}</TableCell>
              <TableCell className="text-xs">{d.confirmed_at ? format(new Date(d.confirmed_at), "dd/MM/yy", { locale: fr }) : "—"}</TableCell>
              <TableCell className="text-xs">{d.date_prestation ? format(new Date(d.date_prestation + "T00:00:00"), "dd/MM/yy", { locale: fr }) : "—"}{d.heure_prestation ? <span className="text-muted-foreground ml-1">{d.heure_prestation.slice(0,5)}</span> : ""}</TableCell>
              <TableCell>
                <div className="font-medium text-sm">{d.nom}</div>
              </TableCell>
              <TableCell>{renderServiceBadge(d.type_service)}</TableCell>
              <TableCell className="text-sm">{d.type_prestation}</TableCell>
              <TableCell className="text-sm">{d.duree_heures ? `${d.duree_heures}h` : "—"}</TableCell>
              <TableCell className="text-sm text-center">{d.nombre_intervenants || 1}</TableCell>
              <TableCell className="text-sm font-medium">{d.candidat_nom || "—"}</TableCell>
              <TableCell className="text-sm">
                <div>{d.quartier || "—"}</div>
                <div className="text-xs text-muted-foreground">{d.ville}</div>
              </TableCell>
              <TableCell className="text-sm">{d.type_bien || "—"}</TableCell>
              <TableCell className="text-xs">
                {d.frequence === "ponctuel" ? "Une fois" : "Abonnement"}
                {d.avec_produit && <Badge variant="outline" className="text-[10px] mt-1">+ Produit</Badge>}
              </TableCell>
              <TableCell className="text-xs">{d.confirmation_ope === "confirme" ? <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">Oui</Badge> : <Badge variant="outline" className="text-[10px]">Pas encore</Badge>}</TableCell>
              <TableCell className="text-sm">{d.note_commercial ? "Mehdi" : "Kaoutar"}</TableCell>
              <TableCell className="text-sm font-medium">{d.montant_total ? `${d.montant_total} MAD` : "—"}</TableCell>
              <TableCell className="text-sm">{d.mode_paiement || "—"}</TableCell>
              <TableCell>{renderStatusBadge(d.statut)}</TableCell>
              <TableCell>{renderQuickMenu(d)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const renderCards = (data: Demande[]) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.length === 0 ? (
        <p className="text-muted-foreground col-span-full text-center py-8">Aucune demande</p>
      ) : data.map((d) => (
        <Card key={d.id} className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2 flex flex-row items-start justify-between">
            <div className="cursor-pointer" onClick={() => openCompteClient(d)}>
              <CardTitle className="text-base">{d.nom}</CardTitle>
              <p className="text-xs text-muted-foreground">#{d.num_demande} · {d.type_prestation}</p>
            </div>
            <div className="flex items-center gap-1">
              {renderServiceBadge(d.type_service)}
              {renderQuickMenu(d)}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-1 text-sm">
              <p><span className="text-muted-foreground">Date :</span> {d.date_prestation || "—"}</p>
              <p><span className="text-muted-foreground">Volume :</span> {d.duree_heures ? `${d.duree_heures}h` : "—"}</p>
              <p><span className="text-muted-foreground">Lieu :</span> {d.quartier || d.ville}</p>
              <p><span className="text-muted-foreground">Tarif :</span> {d.montant_total ? `${d.montant_total} MAD` : "—"}</p>
            </div>
            <div className="flex items-center gap-2">
              {renderStatusBadge(d.statut)}
            </div>
            <div className="flex gap-1 pt-1 border-t">
              {renderActionButtons(d)}
            </div>
          </CardContent>
        </Card>
      ))}
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4 text-center">
              <p className={`text-3xl font-bold ${k.color}`}>{k.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{k.label}</p>
            </CardContent>
          </Card>
        ))}
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
            <SelectItem value="all">Tous services</SelectItem>
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
                <div><span className="text-muted-foreground">Type de bien :</span> {selectedDemande.type_bien || "—"}</div>
                <div><span className="text-muted-foreground">Fréquence :</span> {FREQUENCES.find(f => f.value === selectedDemande.frequence)?.label || selectedDemande.frequence}</div>
                <div><span className="text-muted-foreground">Durée :</span> {selectedDemande.duree_heures ? `${selectedDemande.duree_heures}h` : "—"}</div>
                <div><span className="text-muted-foreground">Intervenants :</span> {selectedDemande.nombre_intervenants}</div>
                <div><span className="text-muted-foreground">Date :</span> {selectedDemande.date_prestation || "—"}</div>
                <div><span className="text-muted-foreground">Heure :</span> {selectedDemande.heure_prestation || "—"}</div>
                <div><span className="text-muted-foreground">Ville :</span> {selectedDemande.ville}</div>
                <div><span className="text-muted-foreground">Quartier :</span> {selectedDemande.quartier || "—"}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Adresse :</span> {selectedDemande.adresse || "—"}</div>
                <div><span className="text-muted-foreground">Montant total :</span> {selectedDemande.montant_total ? `${selectedDemande.montant_total} MAD` : "—"}</div>
                <div><span className="text-muted-foreground">Montant candidat :</span> {selectedDemande.montant_candidat ? `${selectedDemande.montant_candidat} MAD` : "—"}</div>
              </div>
              {selectedDemande.notes_client && <div><span className="text-muted-foreground font-medium">Notes client :</span><p className="mt-1 p-2 bg-muted rounded">{selectedDemande.notes_client}</p></div>}
              {selectedDemande.note_commercial && <div><span className="text-muted-foreground font-medium">Note commerciale :</span><p className="mt-1 p-2 bg-muted rounded">{selectedDemande.note_commercial}</p></div>}
              {selectedDemande.note_operationnel && <div><span className="text-muted-foreground font-medium">Note opérationnelle :</span><p className="mt-1 p-2 bg-muted rounded">{selectedDemande.note_operationnel}</p></div>}
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

      {/* Edit Besoin Modal */}
      {selectedDemande && (
        <>
          <EditBesoinModal demande={selectedDemande} open={editBesoinOpen} onOpenChange={setEditBesoinOpen} onSave={handleSave} />
          <CandidatureModal demande={selectedDemande} open={candidatureOpen} onOpenChange={setCandidatureOpen} onSave={handleSave} />
          <ConfirmationOpeModal demande={selectedDemande} open={confirmOpeOpen} onOpenChange={setConfirmOpeOpen} onSave={handleSave} />
        </>
      )}
    </div>
  );
}
