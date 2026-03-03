import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "@/hooks/use-toast";
import { Plus, Search, Check, X, PhoneOff, Pencil, CalendarIcon, Phone, MapPin, Clock, User, Banknote, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TYPES_PRESTATION, TYPES_PRESTATION_PARTICULIER, TYPES_PRESTATION_ENTREPRISE, TYPES_BIEN, FREQUENCES, QUARTIERS_CASABLANCA, STATUTS } from "@/lib/constants";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

type Demande = Tables<"demandes">;

const emptyForm = {
  nom: "", telephone_direct: "+212", telephone_whatsapp: "+212",
  type_service: "SPP" as string, type_prestation: "" as string, type_bien: "" as string,
  frequence: "ponctuel", duree_heures: "" as string, nombre_intervenants: "1",
  date_prestation: "", heure_prestation: "", quartier: "", adresse: "",
  montant_total: "", notes_client: "",
};

export default function PendingRequests() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterService, setFilterService] = useState("all");
  const [filterPrestation, setFilterPrestation] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingDemande, setEditingDemande] = useState<Demande | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);

  const { data: demandes = [], isLoading } = useQuery({
    queryKey: ["demandes", "en_attente"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandes")
        .select("*")
        .in("statut", ["en_attente", "nrp"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Demande[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("demandes").insert({
        nom: form.nom,
        telephone_direct: form.telephone_direct,
        telephone_whatsapp: form.telephone_whatsapp,
        type_service: form.type_service,
        type_prestation: form.type_prestation,
        type_bien: form.type_bien || null,
        frequence: form.frequence,
        duree_heures: form.duree_heures ? Number(form.duree_heures) : null,
        nombre_intervenants: Number(form.nombre_intervenants) || 1,
        date_prestation: form.date_prestation || null,
        heure_prestation: form.heure_prestation || null,
        quartier: form.quartier || null,
        adresse: form.adresse || null,
        montant_total: form.montant_total ? Number(form.montant_total) : null,
        notes_client: form.notes_client || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demandes"] });
      setForm(emptyForm);
      setDialogOpen(false);
      toast({ title: "Demande ajoutée avec succès" });
    },
    onError: (e) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, statut }: { id: string; statut: string }) => {
      const updates: Record<string, unknown> = { statut };
      if (statut === "confirmee") updates.confirmed_at = new Date().toISOString();
      const { error } = await supabase.from("demandes").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { statut }) => {
      queryClient.invalidateQueries({ queryKey: ["demandes"] });
      const labels: Record<string, string> = { confirmee: "Demande confirmée", rejetee: "Demande rejetée", nrp: "Marquée NRP" };
      toast({ title: labels[statut] || "Statut mis à jour" });
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingDemande) return;
      const { error } = await supabase.from("demandes").update({
        nom: editForm.nom,
        telephone_direct: editForm.telephone_direct,
        telephone_whatsapp: editForm.telephone_whatsapp,
        type_service: editForm.type_service,
        type_prestation: editForm.type_prestation,
        type_bien: editForm.type_bien || null,
        frequence: editForm.frequence,
        duree_heures: editForm.duree_heures ? Number(editForm.duree_heures) : null,
        nombre_intervenants: Number(editForm.nombre_intervenants) || 1,
        date_prestation: editForm.date_prestation || null,
        heure_prestation: editForm.heure_prestation || null,
        quartier: editForm.quartier || null,
        adresse: editForm.adresse || null,
        montant_total: editForm.montant_total ? Number(editForm.montant_total) : null,
        notes_client: editForm.notes_client || null,
      }).eq("id", editingDemande.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demandes"] });
      setEditDialogOpen(false);
      toast({ title: "Demande modifiée" });
    },
    onError: (e) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const openEdit = (d: Demande) => {
    setEditingDemande(d);
    setEditForm({
      nom: d.nom, telephone_direct: d.telephone_direct || "+212", telephone_whatsapp: d.telephone_whatsapp || "+212",
      type_service: d.type_service, type_prestation: d.type_prestation, type_bien: d.type_bien || "",
      frequence: d.frequence, duree_heures: d.duree_heures ? String(d.duree_heures) : "",
      nombre_intervenants: String(d.nombre_intervenants || 1),
      date_prestation: d.date_prestation || "", heure_prestation: d.heure_prestation || "",
      quartier: d.quartier || "", adresse: d.adresse || "",
      montant_total: d.montant_total ? String(d.montant_total) : "", notes_client: d.notes_client || "",
    });
    setEditDialogOpen(true);
  };

  const filtered = demandes.filter((d) => {
    const q = search.toLowerCase();
    const matchSearch = !search || d.nom.toLowerCase().includes(q) || String(d.num_demande).includes(q) || d.telephone_direct?.includes(q);
    const matchService = filterService === "all" || d.type_service === filterService;
    const matchPrestation = filterPrestation === "all" || d.type_prestation === filterPrestation;
    let matchDate = true;
    if (dateFrom && d.date_prestation) matchDate = new Date(d.date_prestation) >= dateFrom;
    if (dateTo && d.date_prestation && matchDate) matchDate = new Date(d.date_prestation) <= dateTo;
    return matchSearch && matchService && matchPrestation && matchDate;
  });

  const updateField = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const updateEditField = (key: string, value: string) => setEditForm((f) => ({ ...f, [key]: value }));

  const renderFormFields = (currentForm: typeof emptyForm, updater: (key: string, val: string) => void) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      <div><Label>Nom *</Label><Input value={currentForm.nom} onChange={(e) => updater("nom", e.target.value)} /></div>
      <div><Label>Tél. direct</Label><Input value={currentForm.telephone_direct} onChange={(e) => updater("telephone_direct", e.target.value)} /></div>
      <div><Label>Tél. WhatsApp</Label><Input value={currentForm.telephone_whatsapp} onChange={(e) => updater("telephone_whatsapp", e.target.value)} /></div>
      <div>
        <Label>Type de service *</Label>
        <Select value={currentForm.type_service} onValueChange={(v) => updater("type_service", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="SPP">Service pour Particuliers (SPP)</SelectItem>
            <SelectItem value="SPE">Service pour Entreprises (SPE)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Type de prestation *</Label>
        <Select value={currentForm.type_prestation} onValueChange={(v) => updater("type_prestation", v)}>
          <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
          <SelectContent>{TYPES_PRESTATION.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <Label>Type de bien</Label>
        <Select value={currentForm.type_bien} onValueChange={(v) => updater("type_bien", v)}>
          <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
          <SelectContent>{TYPES_BIEN.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <Label>Fréquence</Label>
        <Select value={currentForm.frequence} onValueChange={(v) => updater("frequence", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{FREQUENCES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div><Label>Durée (heures)</Label><Input type="number" value={currentForm.duree_heures} onChange={(e) => updater("duree_heures", e.target.value)} /></div>
      <div><Label>Nb intervenants</Label><Input type="number" value={currentForm.nombre_intervenants} onChange={(e) => updater("nombre_intervenants", e.target.value)} /></div>
      <div><Label>Date prestation</Label><Input type="date" value={currentForm.date_prestation} onChange={(e) => updater("date_prestation", e.target.value)} /></div>
      <div><Label>Heure</Label><Input type="time" value={currentForm.heure_prestation} onChange={(e) => updater("heure_prestation", e.target.value)} /></div>
      <div>
        <Label>Quartier</Label>
        <Select value={currentForm.quartier} onValueChange={(v) => updater("quartier", v)}>
          <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
          <SelectContent>{QUARTIERS_CASABLANCA.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div><Label>Adresse</Label><Input value={currentForm.adresse} onChange={(e) => updater("adresse", e.target.value)} /></div>
      <div>
        <Label>Montant total (MAD)</Label>
        <Input type="number" value={currentForm.montant_total} onChange={(e) => updater("montant_total", e.target.value)} />
        {currentForm.montant_total && (
          <p className="text-xs text-muted-foreground mt-1">Montant candidat : {(Number(currentForm.montant_total) / 2).toFixed(2)} MAD</p>
        )}
      </div>
      <div className="md:col-span-2"><Label>Notes client</Label><Textarea value={currentForm.notes_client} onChange={(e) => updater("notes_client", e.target.value)} /></div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Les demandes en attente</h1>
          <p className="text-muted-foreground text-sm">{filtered.length} demande(s) en attente de traitement</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Nouvelle réservation dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nouvelle réservation</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {TYPES_PRESTATION_PARTICULIER.filter(t => !["Ménage post-sinistre", "Ménage fin de chantier"].includes(t)).map((t) => (
                <DropdownMenuItem key={t} onClick={() => {
                  setForm({ ...emptyForm, type_prestation: t, type_service: "SPP" });
                  setDialogOpen(true);
                }}>{t}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Nouveau devis dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nouveau devis</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {["Ménage post-sinistre", "Ménage fin de chantier", "Nettoyage post-déménagement"].map((t) => (
                <DropdownMenuItem key={t} onClick={() => {
                  setForm({ ...emptyForm, type_prestation: t, type_service: "SPP" });
                  setDialogOpen(true);
                }}>{t}</DropdownMenuItem>
              ))}
              {["Ménage Bureaux", "Placement & gestion"].map((t) => (
                <DropdownMenuItem key={t} onClick={() => {
                  setForm({ ...emptyForm, type_prestation: t, type_service: "SPE" });
                  setDialogOpen(true);
                }}>{t}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Dialog for adding demande */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Ajouter une demande — {form.type_prestation}</DialogTitle></DialogHeader>
            {renderFormFields(form, updateField)}
            <div className="flex justify-end mt-4">
              <Button onClick={() => addMutation.mutate()} disabled={!form.nom || !form.type_prestation || addMutation.isPending}>
                {addMutation.isPending ? "Ajout..." : "Ajouter la demande"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher par nom, numéro..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              {dateFrom ? format(dateFrom, "dd/MM", { locale: fr }) : "Du"} — {dateTo ? format(dateTo, "dd/MM", { locale: fr }) : "Au"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 flex" align="start">
            <div className="p-2">
              <p className="text-xs text-muted-foreground mb-1 px-3">Du</p>
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className="pointer-events-auto" locale={fr} />
            </div>
            <div className="p-2 border-l">
              <p className="text-xs text-muted-foreground mb-1 px-3">Au</p>
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} className="pointer-events-auto" locale={fr} />
            </div>
          </PopoverContent>
        </Popover>
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>Effacer dates</Button>
        )}
      </div>

      {/* Cards */}
      {isLoading ? (
        <p className="text-muted-foreground">Chargement...</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">Aucune demande en attente</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((d) => (
            <Card key={d.id} className="relative overflow-hidden border-l-4" style={{ borderLeftColor: d.statut === "nrp" ? "hsl(var(--destructive))" : "hsl(var(--primary))" }}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {d.nom}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">Demande #{d.num_demande} • {format(new Date(d.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge className={d.type_service === "SPP" ? "bg-primary text-primary-foreground" : "bg-spe text-spe-foreground"}>
                      {d.type_service}
                    </Badge>
                    {d.statut === "nrp" && (
                      <Badge variant="outline" className="bg-orange-100 text-orange-800">NRP</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm pb-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{d.telephone_direct || "—"}</p>
                  <p className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-muted-foreground" />{d.date_prestation ? format(new Date(d.date_prestation), "dd/MM/yyyy") : "—"} {d.heure_prestation || ""}</p>
                  <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{d.quartier || d.ville}</p>
                  <p className="flex items-center gap-1.5"><Banknote className="h-3.5 w-3.5 text-muted-foreground" />{d.montant_total ? `${d.montant_total} MAD` : "—"}</p>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge variant="secondary">{d.type_prestation}</Badge>
                  {d.type_bien && <Badge variant="outline">{d.type_bien}</Badge>}
                  {d.frequence !== "ponctuel" && <Badge variant="outline">{FREQUENCES.find(f => f.value === d.frequence)?.label}</Badge>}
                </div>
                {d.notes_client && (
                  <p className="text-xs text-muted-foreground bg-muted rounded p-2 mt-2 line-clamp-2">💬 {d.notes_client}</p>
                )}
              </CardContent>
              {/* Action buttons */}
              <div className="border-t px-4 py-3 flex items-center gap-2">
                <Button size="sm" variant="outline" className="flex-1 text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700" onClick={() => statusMutation.mutate({ id: d.id, statut: "nrp" })} disabled={d.statut === "nrp"}>
                  <PhoneOff className="h-3.5 w-3.5 mr-1" />NRP
                </Button>
                <Button size="sm" variant="outline" className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => statusMutation.mutate({ id: d.id, statut: "rejetee" })}>
                  <X className="h-3.5 w-3.5 mr-1" />Rejeter
                </Button>
                <Button size="sm" className="flex-1" onClick={() => statusMutation.mutate({ id: d.id, statut: "confirmee" })}>
                  <Check className="h-3.5 w-3.5 mr-1" />Confirmer
                </Button>
                <Button size="sm" variant="secondary" className="flex-1" onClick={() => openEdit(d)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" />Modifier
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Modifier la demande #{editingDemande?.num_demande}</DialogTitle></DialogHeader>
          {renderFormFields(editForm, updateEditField)}
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => editMutation.mutate()} disabled={!editForm.nom || !editForm.type_prestation || editMutation.isPending}>
              Confirmer la modification
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
