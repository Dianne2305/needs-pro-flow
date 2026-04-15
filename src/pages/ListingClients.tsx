import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { STATUTS, SEGMENTS } from "@/lib/constants";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { EditBesoinModal } from "@/components/dashboard/EditBesoinModal";
import {
  RefreshCw, Search, Settings, Pencil, MessageSquare, UserCheck, Trash2,
  CalendarIcon, Users, Ban, MoreVertical
} from "lucide-react";

type Demande = Tables<"demandes">;

const COMMERCIAUX = ["Mehdi", "Kaoutar"] as const;

const STATUS_FILTER_TABS = [
  { value: "all", label: "Tout" },
  { value: "en_attente", label: "En attente" },
  { value: "nouveau_besoin", label: "Nouveau besoin" },
  { value: "confirme", label: "Confirmé" },
  { value: "prestation_en_cours", label: "Pres. en cours" },
  { value: "prestation_terminee", label: "Pres. terminée" },
  { value: "annulee", label: "Annulé" },
  { value: "paye", label: "Payé" },
  { value: "facturation_en_cours", label: "Facturation en cours" },
  { value: "facturation_partielle", label: "Facturation partielle" },
  { value: "facturation_annulee", label: "Facturation annulée" },
] as const;

const STATUS_ROW_COLORS: Record<string, string> = {
  en_attente: "bg-[hsl(220,15%,95%)]",
  nouveau_besoin: "bg-[hsl(210,80%,95%)]",
  en_attente_confirmation: "bg-[hsl(50,80%,93%)]",
  en_attente_profil: "bg-[hsl(50,80%,93%)]",
  confirme: "bg-[hsl(185,50%,93%)]",
  confirme_intervention: "bg-[hsl(185,50%,90%)]",
  prestation_en_cours: "bg-[hsl(240,60%,95%)]",
  prestation_terminee: "bg-[hsl(35,90%,93%)]",
  facturation_en_cours: "bg-[hsl(100,60%,93%)]",
  facturation_partielle: "bg-[hsl(45,80%,93%)]",
  paye: "bg-[hsl(140,50%,93%)]",
  standby: "bg-[hsl(220,15%,93%)]",
  annulee: "bg-[hsl(0,60%,95%)]",
  facturation_annulee: "bg-[hsl(350,80%,95%)]",
};

export default function ListingClients() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [commercialFilter, setCommercialFilter] = useState("all");
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  // Modals
  const [selectedDemande, setSelectedDemande] = useState<Demande | null>(null);
  const [editBesoinOpen, setEditBesoinOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteType, setNoteType] = useState<"commercial" | "operationnel">("commercial");
  const [noteText, setNoteText] = useState("");
  const [affectationOpen, setAffectationOpen] = useState(false);
  const [affectationCommercial, setAffectationCommercial] = useState("");
  const [gesteOpen, setGesteOpen] = useState(false);
  const [gesteMotif, setGesteMotif] = useState("");
  const [deleteClientId, setDeleteClientId] = useState<string | null>(null);

  // Fetch all demandes for listing
  const { data: allDemandes = [], isLoading, refetch } = useQuery({
    queryKey: ["demandes", "listing_clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Demande[];
    },
  });

  // Count per client name for fidélité
  const clientCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    allDemandes.forEach((d) => {
      const name = d.nom?.trim().toLowerCase();
      if (name) map[name] = (map[name] || 0) + 1;
    });
    return map;
  }, [allDemandes]);

  // Unique services for filter
  const uniqueServices = useMemo(() => {
    const set = new Set(allDemandes.map((d) => d.type_prestation));
    return Array.from(set).sort();
  }, [allDemandes]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase.from("demandes").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demandes"] });
      toast({ title: "Mis à jour" });
      setNoteOpen(false);
      setAffectationOpen(false);
      setGesteOpen(false);
    },
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("demandes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demandes"] });
      toast({ title: "Demande supprimée" });
      setDeleteClientId(null);
    },
  });

  // Apply filters
  const filtered = useMemo(() => {
    let result = allDemandes;

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((d) => d.statut === statusFilter);
    }

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((d) =>
        d.nom.toLowerCase().includes(q) ||
        String(d.num_demande).includes(q) ||
        d.ville?.toLowerCase().includes(q) ||
        d.quartier?.toLowerCase().includes(q)
      );
    }

    // Commercial (placeholder — stored as note_commercial prefix for now)
    if (commercialFilter !== "all") {
      // Future: filter by assigned commercial
    }

    // Segment
    if (segmentFilter !== "all") {
      result = result.filter((d) => d.type_service === segmentFilter);
    }

    // Service
    if (serviceFilter !== "all") {
      result = result.filter((d) => d.type_prestation === serviceFilter);
    }

    // Date range
    if (dateFrom) {
      result = result.filter((d) => new Date(d.created_at) >= dateFrom);
    }
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59);
      result = result.filter((d) => new Date(d.created_at) <= endDate);
    }

    return result;
  }, [allDemandes, statusFilter, search, commercialFilter, segmentFilter, serviceFilter, dateFrom, dateTo]);

  const openCompteClient = (d: Demande) => {
    navigate(`/compte-client?id=${d.id}&from=/clients`);
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

  const renderStatusBadge = (statut: string) => {
    const s = STATUTS[statut as keyof typeof STATUTS];
    return s ? (
      <Badge variant="outline" className="border-0 font-medium text-xs whitespace-nowrap" style={{ backgroundColor: s.hex, color: "#ffffff" }}>
        {s.label}
      </Badge>
    ) : <Badge variant="outline" className="text-xs">{statut}</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Listing Clients</h1>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Actualiser
        </Button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b">
        {STATUS_FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              statusFilter === tab.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom, numéro, ville, quartier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Commercial */}
        <Select value={commercialFilter} onValueChange={setCommercialFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Commercial" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tout</SelectItem>
            {COMMERCIAUX.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Segment */}
        <Select value={segmentFilter} onValueChange={setSegmentFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Segment" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tout</SelectItem>
            <SelectItem value="SPP">Particulier</SelectItem>
            <SelectItem value="SPE">Entreprise</SelectItem>
          </SelectContent>
        </Select>

        {/* Service */}
        <Select value={serviceFilter} onValueChange={setServiceFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Services" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tout</SelectItem>
            {uniqueServices.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Date from */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs", !dateFrom && "text-muted-foreground")}>
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Du"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>

        {/* Date to */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs", !dateTo && "text-muted-foreground")}>
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateTo ? format(dateTo, "dd/MM/yyyy") : "Au"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateTo} onSelect={setDateTo} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>

        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
            Réinitialiser dates
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Actions</TableHead>
              <TableHead>Statut besoin</TableHead>
              <TableHead>Segment</TableHead>
              <TableHead>Commercial</TableHead>
              <TableHead>Nom client</TableHead>
              <TableHead>Quartier / Ville</TableHead>
              <TableHead>Fidélité</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Chargement...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Aucun client trouvé</TableCell></TableRow>
            ) : filtered.map((d) => {
              const rowColor = STATUS_ROW_COLORS[d.statut] || "";
              const count = clientCountMap[d.nom?.trim().toLowerCase()] || 0;

              return (
                <TableRow key={d.id} className={cn(rowColor, "hover:brightness-95 transition-all")}>
                  {/* Actions */}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1">
                          <Settings className="h-3.5 w-3.5" /> Actions
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => openCompteClient(d)}>
                          <UserCheck className="h-4 w-4 mr-2" /> Compte client
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSelectedDemande(d); setEditBesoinOpen(true); }}>
                          <Pencil className="h-4 w-4 mr-2" /> Éditer le besoin
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openNote(d, "commercial")}>
                          <MessageSquare className="h-4 w-4 mr-2" /> Avis commercial
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openNote(d, "operationnel")}>
                          <MessageSquare className="h-4 w-4 mr-2" /> Avis opérationnel
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => { setSelectedDemande(d); setAffectationCommercial(""); setAffectationOpen(true); }}>
                          <Users className="h-4 w-4 mr-2" /> Affectation
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSelectedDemande(d); setGesteMotif(""); setGesteOpen(true); }}>
                          <Ban className="h-4 w-4 mr-2" /> Geste commercial
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => updateMutation.mutate({ id: d.id, updates: { statut: "annulee" } })}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>

                  {/* Statut */}
                  <TableCell>{renderStatusBadge(d.statut)}</TableCell>

                  {/* Segment */}
                  <TableCell>
                    <Badge className={d.type_service === "SPP" ? "bg-primary text-primary-foreground" : "bg-spe text-spe-foreground"}>
                      {d.type_service === "SPP" ? "Particulier" : "Entreprise"}
                    </Badge>
                  </TableCell>

                  {/* Commercial */}
                  <TableCell className="text-sm">—</TableCell>

                  {/* Nom client */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{d.nom}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">#{d.num_demande}</span>
                    </div>
                  </TableCell>

                  {/* Quartier / Ville */}
                  <TableCell>
                    <div className="text-sm leading-tight">
                      {d.quartier && <span className="font-medium">{d.quartier}</span>}
                      {d.quartier && <br />}
                      <span className="text-muted-foreground text-xs">{d.ville}</span>
                    </div>
                  </TableCell>

                  {/* Fidélité */}
                  <TableCell>
                    {count > 1 ? (
                      <Badge variant="outline" className="text-xs border-primary/30 text-primary font-semibold">
                        {count} demandes
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Nouveau</span>
                    )}
                  </TableCell>

                  {/* Quick menu */}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openCompteClient(d)}>
                            <UserCheck className="h-4 w-4 mr-2" /> Voir le compte
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setSelectedDemande(d); setEditBesoinOpen(true); }}>
                            <Pencil className="h-4 w-4 mr-2" /> Éditer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteClientId(d.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Note Modal */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{noteType === "commercial" ? "Avis Commercial" : "Avis Opérationnel"} — #{selectedDemande?.num_demande}</DialogTitle>
          </DialogHeader>
          <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={4} placeholder="Saisir une note..." />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNoteOpen(false)}>Annuler</Button>
            <Button onClick={saveNote}>Enregistrer</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Affectation Modal */}
      <Dialog open={affectationOpen} onOpenChange={setAffectationOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Affectation — #{selectedDemande?.num_demande}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Affecter ce client à un commercial :</p>
          <Select value={affectationCommercial} onValueChange={setAffectationCommercial}>
            <SelectTrigger><SelectValue placeholder="Choisir un commercial" /></SelectTrigger>
            <SelectContent>
              {COMMERCIAUX.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAffectationOpen(false)}>Annuler</Button>
            <Button
              disabled={!affectationCommercial}
              onClick={() => {
                if (!selectedDemande) return;
                updateMutation.mutate({
                  id: selectedDemande.id,
                  updates: { note_commercial: `[Affecté à ${affectationCommercial}] ${selectedDemande.note_commercial || ""}` },
                });
                toast({ title: "Client affecté", description: `Affecté à ${affectationCommercial}` });
              }}
            >
              Affecter
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Geste Commercial Modal */}
      <Dialog open={gesteOpen} onOpenChange={setGesteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Geste commercial — #{selectedDemande?.num_demande}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Annuler la facturation pour ce client et indiquer la raison :</p>
          <Textarea
            value={gesteMotif}
            onChange={(e) => setGesteMotif(e.target.value)}
            rows={3}
            placeholder="Raison de l'annulation de la facturation..."
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setGesteOpen(false)}>Annuler</Button>
            <Button
              disabled={!gesteMotif}
              onClick={() => {
                if (!selectedDemande) return;
                updateMutation.mutate({
                  id: selectedDemande.id,
                  updates: {
                    note_commercial: `[Geste commercial: ${gesteMotif}] ${selectedDemande.note_commercial || ""}`,
                  },
                });
                toast({ title: "Geste commercial enregistré" });
              }}
            >
              Confirmer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteClientId} onOpenChange={(o) => !o && setDeleteClientId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Êtes-vous sûr de vouloir supprimer cette demande ? Cette action est irréversible.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteClientId(null)}>Annuler</Button>
            <Button variant="destructive" onClick={() => deleteClientId && deleteClientMutation.mutate(deleteClientId)}>Supprimer</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Besoin Modal */}
      {selectedDemande && (
        <EditBesoinModal
          demande={selectedDemande}
          open={editBesoinOpen}
          onOpenChange={setEditBesoinOpen}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
