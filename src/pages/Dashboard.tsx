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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { RefreshCw, Search, LayoutList, LayoutGrid, MoreVertical, Pencil, MessageSquare, Eye } from "lucide-react";
import { TYPES_PRESTATION, FREQUENCES, STATUTS } from "@/lib/constants";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type Demande = Tables<"demandes">;

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterService, setFilterService] = useState("all");
  const [filterPrestation, setFilterPrestation] = useState("all");
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [selectedDemande, setSelectedDemande] = useState<Demande | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [noteType, setNoteType] = useState<"commercial" | "operationnel">("commercial");
  const [noteText, setNoteText] = useState("");

  const { data: allDemandes = [], isLoading, refetch } = useQuery({
    queryKey: ["demandes", "confirmed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandes")
        .select("*")
        .in("statut", ["confirmee", "cloturee", "standby"])
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
      setEditOpen(false);
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

  const todayDemandes = allDemandes.filter((d) => d.confirmed_at && format(new Date(d.confirmed_at), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd"));
  const sppCount = filtered.filter((d) => d.type_service === "SPP").length;
  const speCount = filtered.filter((d) => d.type_service === "SPE").length;

  const kpis = [
    { label: "Demandes en cours", value: filtered.length, color: "text-primary" },
    { label: "Services Particuliers", value: sppCount, color: "text-primary" },
    { label: "Services Entreprises", value: speCount, color: "text-spe" },
    { label: "En attente", value: pendingCount, color: "text-amber-600" },
  ];

  const openDetail = (d: Demande) => { setSelectedDemande(d); setDetailOpen(true); };
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

  const renderServiceBadge = (type: string) => (
    <Badge className={type === "SPP" ? "bg-primary text-primary-foreground" : "bg-spe text-spe-foreground"}>{type}</Badge>
  );

  const renderStatusBadge = (statut: string) => {
    const s = STATUTS[statut as keyof typeof STATUTS];
    return s ? <Badge variant="outline" className={s.color}>{s.label}</Badge> : <Badge variant="outline">{statut}</Badge>;
  };

  const renderActions = (d: Demande) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => openDetail(d)}><Eye className="h-4 w-4 mr-2" />Voir détails</DropdownMenuItem>
        <DropdownMenuItem onClick={() => { setSelectedDemande(d); setEditOpen(true); }}><Pencil className="h-4 w-4 mr-2" />Éditer</DropdownMenuItem>
        <DropdownMenuItem onClick={() => openNote(d, "commercial")}><MessageSquare className="h-4 w-4 mr-2" />Note commerciale</DropdownMenuItem>
        <DropdownMenuItem onClick={() => openNote(d, "operationnel")}><MessageSquare className="h-4 w-4 mr-2" />Note opérationnelle</DropdownMenuItem>
        <DropdownMenuItem onClick={() => updateMutation.mutate({ id: d.id, updates: { statut: "cloturee" } })}>Clôturer</DropdownMenuItem>
        <DropdownMenuItem onClick={() => updateMutation.mutate({ id: d.id, updates: { statut: "standby" } })}>Standby</DropdownMenuItem>
        <DropdownMenuItem onClick={() => updateMutation.mutate({ id: d.id, updates: { statut: "annulee" } })} className="text-destructive">Annuler</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderTable = (data: Demande[]) => (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>N°</TableHead>
            <TableHead>Confirmée le</TableHead>
            <TableHead>Nom</TableHead>
            <TableHead>Tél.</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>Prestation</TableHead>
            <TableHead>Lieu</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Candidat</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Aucune demande</TableCell></TableRow>
          ) : data.map((d) => (
            <TableRow key={d.id}>
              <TableCell className="font-mono text-xs">#{d.num_demande}</TableCell>
              <TableCell className="text-sm">{d.confirmed_at ? format(new Date(d.confirmed_at), "dd/MM/yyyy", { locale: fr }) : "—"}</TableCell>
              <TableCell className="font-medium">{d.nom}</TableCell>
              <TableCell className="text-sm">{d.telephone_direct}</TableCell>
              <TableCell>{renderServiceBadge(d.type_service)}</TableCell>
              <TableCell className="text-sm">{d.type_prestation}</TableCell>
              <TableCell className="text-sm">{d.quartier || d.ville}</TableCell>
              <TableCell className="text-sm font-medium">{d.montant_total ? `${d.montant_total} MAD` : "—"}</TableCell>
              <TableCell className="text-sm">{d.montant_candidat ? `${d.montant_candidat} MAD` : "—"}</TableCell>
              <TableCell>{renderStatusBadge(d.statut)}</TableCell>
              <TableCell>{renderActions(d)}</TableCell>
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
        <Card key={d.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openDetail(d)}>
          <CardHeader className="pb-2 flex flex-row items-start justify-between">
            <div>
              <CardTitle className="text-base">{d.nom}</CardTitle>
              <p className="text-xs text-muted-foreground">#{d.num_demande}</p>
            </div>
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {renderServiceBadge(d.type_service)}
              {renderActions(d)}
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Prestation :</span> {d.type_prestation}</p>
            <p><span className="text-muted-foreground">Date :</span> {d.date_prestation || "—"}</p>
            <p><span className="text-muted-foreground">Lieu :</span> {d.quartier || d.ville}</p>
            <p><span className="text-muted-foreground">Montant :</span> {d.montant_total ? `${d.montant_total} MAD` : "—"}</p>
            {renderStatusBadge(d.statut)}
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
          <DialogHeader><DialogTitle>Détails - #{selectedDemande?.num_demande}</DialogTitle></DialogHeader>
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

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Éditer la demande #{selectedDemande?.num_demande}</DialogTitle></DialogHeader>
          {selectedDemande && <EditForm demande={selectedDemande} onSave={(updates) => { updateMutation.mutate({ id: selectedDemande.id, updates }); setEditOpen(false); }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditForm({ demande, onSave }: { demande: Demande; onSave: (u: Record<string, unknown>) => void }) {
  const [nom, setNom] = useState(demande.nom);
  const [tel, setTel] = useState(demande.telephone_direct || "");
  const [whatsapp, setWhatsapp] = useState(demande.telephone_whatsapp || "");
  const [montant, setMontant] = useState(String(demande.montant_total || ""));

  return (
    <div className="space-y-4">
      <div><Label>Nom</Label><Input value={nom} onChange={(e) => setNom(e.target.value)} /></div>
      <div><Label>Tél. direct</Label><Input value={tel} onChange={(e) => setTel(e.target.value)} /></div>
      <div><Label>Tél. WhatsApp</Label><Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} /></div>
      <div>
        <Label>Montant total (MAD)</Label>
        <Input type="number" value={montant} onChange={(e) => setMontant(e.target.value)} />
        {montant && <p className="text-xs text-muted-foreground mt-1">Candidat : {(Number(montant) / 2).toFixed(2)} MAD</p>}
      </div>
      <div className="flex justify-end">
        <Button onClick={() => onSave({ nom, telephone_direct: tel, telephone_whatsapp: whatsapp, montant_total: montant ? Number(montant) : null })}>
          Sauvegarder
        </Button>
      </div>
    </div>
  );
}
