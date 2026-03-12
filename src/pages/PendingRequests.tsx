import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Search, CalendarIcon, ChevronDown, Save, Download } from "lucide-react";
import {
  TYPES_PRESTATION, TYPES_PRESTATION_PARTICULIER, TYPES_PRESTATION_ENTREPRISE,
  TYPES_BIEN, FREQUENCES, QUARTIERS_CASABLANCA,
  MODES_PAIEMENT_COMMERCIAL, STATUTS_PAIEMENT_COMMERCIAL,
} from "@/lib/constants";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ServiceFormFields } from "@/components/dashboard/ServiceFormFields";
import { NewDemandeDropdown } from "@/components/pending/NewDemandeDropdown";
import { RejectModal } from "@/components/pending/RejectModal";
import { DevisPreviewModal } from "@/components/pending/DevisPreviewModal";
import { DocumentHistory } from "@/components/pending/DocumentHistory";
import { isDevisType } from "@/lib/devis-generator";

type Demande = Tables<"demandes">;

// Extended form state for dynamic forms
interface FormState {
  nom: string;
  telephone_direct: string;
  telephone_whatsapp: string;
  type_service: string;
  type_prestation: string;
  type_bien: string;
  frequence: string;
  duree_heures: string;
  nombre_intervenants: string;
  date_prestation: string;
  heure_prestation: string;
  quartier: string;
  adresse: string;
  ville: string;
  montant_total: string;
  notes_client: string;
  superficie_m2: string;
  etat_logement: string;
  type_salissure: string;
  nature_intervention: string;
  description_intervention: string;
  preference_horaire: string;
  nom_entreprise: string;
  contact_entreprise: string;
  email: string;
  avec_produit: boolean;
  avec_torchons: boolean;
  mode_paiement: string;
  statut_paiement_commercial: string;
  montant_verse_client: string;
}

const emptyForm: FormState = {
  nom: "", telephone_direct: "+212", telephone_whatsapp: "+212",
  type_service: "SPP", type_prestation: "", type_bien: "",
  frequence: "ponctuel", duree_heures: "", nombre_intervenants: "1",
  date_prestation: "", heure_prestation: "", quartier: "", adresse: "", ville: "Casablanca",
  montant_total: "", notes_client: "", superficie_m2: "", etat_logement: "",
  type_salissure: "", nature_intervention: "", description_intervention: "",
  preference_horaire: "", nom_entreprise: "", contact_entreprise: "", email: "",
  avec_produit: false, avec_torchons: false,
  mode_paiement: "", statut_paiement_commercial: "non_paye", montant_verse_client: "",
};

// Track generated documents per demande (in-memory for now)
const documentStore: Record<string, Array<{ type: string; name: string; date: string }>> = {};

export default function PendingRequests() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterService, setFilterService] = useState("all");
  const [filterPrestation, setFilterPrestation] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  // New demande dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingDemande, setEditingDemande] = useState<Demande | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);

  // Reject modal
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectingDemande, setRejectingDemande] = useState<Demande | null>(null);

  // Devis preview
  const [devisOpen, setDevisOpen] = useState(false);
  const [devisDemande, setDevisDemande] = useState<Demande | null>(null);

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
        ville: form.ville || "Casablanca",
        montant_total: form.montant_total ? Number(form.montant_total) : null,
        
        notes_client: form.notes_client || null,
        superficie_m2: form.superficie_m2 ? Number(form.superficie_m2) : null,
        etat_logement: form.etat_logement || null,
        type_salissure: form.type_salissure || null,
        nature_intervention: form.nature_intervention || null,
        description_intervention: form.description_intervention || null,
        preference_horaire: form.preference_horaire || null,
        nom_entreprise: form.nom_entreprise || null,
        contact_entreprise: form.contact_entreprise || null,
        email: form.email || null,
        avec_produit: form.avec_produit,
        mode_paiement: form.mode_paiement || null,
        statut_paiement_commercial: form.statut_paiement_commercial || "non_paye",
        montant_verse_client: form.montant_verse_client ? Number(form.montant_verse_client) : null,
        services_optionnels: JSON.stringify(
          [form.avec_produit && "produit", form.avec_torchons && "torchons"].filter(Boolean)
        ),
      } as any);
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
    mutationFn: async ({ id, statut, motif }: { id: string; statut: string; motif?: string }) => {
      const updates: Record<string, unknown> = { statut };
      if (statut === "confirmee") {
        updates.statut = "en_cours";
        updates.confirmed_at = new Date().toISOString();
      }
      if (motif) updates.motif_annulation = motif;
      const { error } = await supabase.from("demandes").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { statut }) => {
      queryClient.invalidateQueries({ queryKey: ["demandes"] });
      const labels: Record<string, string> = {
        confirmee: "Demande confirmée — transférée au tableau de bord",
        rejetee: "Demande rejetée — archivée dans le listing client",
        nrp: "Marquée NRP",
      };
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
        ville: editForm.ville || "Casablanca",
        montant_total: editForm.montant_total ? Number(editForm.montant_total) : null,
        
        notes_client: editForm.notes_client || null,
        superficie_m2: editForm.superficie_m2 ? Number(editForm.superficie_m2) : null,
        etat_logement: editForm.etat_logement || null,
        type_salissure: editForm.type_salissure || null,
        nature_intervention: editForm.nature_intervention || null,
        description_intervention: editForm.description_intervention || null,
        preference_horaire: editForm.preference_horaire || null,
        nom_entreprise: editForm.nom_entreprise || null,
        contact_entreprise: editForm.contact_entreprise || null,
        email: editForm.email || null,
        avec_produit: editForm.avec_produit,
        mode_paiement: editForm.mode_paiement || null,
        statut_paiement_commercial: editForm.statut_paiement_commercial || "non_paye",
        montant_verse_client: editForm.montant_verse_client ? Number(editForm.montant_verse_client) : null,
        services_optionnels: JSON.stringify(
          [editForm.avec_produit && "produit", editForm.avec_torchons && "torchons"].filter(Boolean)
        ),
      } as any).eq("id", editingDemande.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demandes"] });
      setEditDialogOpen(false);
      toast({ title: "Demande modifiée" });
    },
    onError: (e) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const handleNewDemande = (segment: "SPP" | "SPE", typePrestation: string) => {
    setForm({
      ...emptyForm,
      type_service: segment,
      type_prestation: typePrestation,
    });
    setDialogOpen(true);
  };

  const openEdit = (d: Demande) => {
    setEditingDemande(d);
    setEditForm({
      nom: d.nom,
      telephone_direct: d.telephone_direct || "+212",
      telephone_whatsapp: d.telephone_whatsapp || "+212",
      type_service: d.type_service,
      type_prestation: d.type_prestation,
      type_bien: d.type_bien || "",
      frequence: d.frequence,
      duree_heures: d.duree_heures ? String(d.duree_heures) : "",
      nombre_intervenants: String(d.nombre_intervenants || 1),
      date_prestation: d.date_prestation || "",
      heure_prestation: d.heure_prestation || "",
      quartier: d.quartier || "",
      adresse: d.adresse || "",
      ville: d.ville || "Casablanca",
      montant_total: d.montant_total ? String(d.montant_total) : "",
      notes_client: d.notes_client || "",
      superficie_m2: d.superficie_m2 ? String(d.superficie_m2) : "",
      etat_logement: d.etat_logement || "",
      type_salissure: d.type_salissure || "",
      nature_intervention: d.nature_intervention || "",
      description_intervention: d.description_intervention || "",
      preference_horaire: d.preference_horaire || "",
      nom_entreprise: d.nom_entreprise || "",
      contact_entreprise: d.contact_entreprise || "",
      email: d.email || "",
      avec_produit: d.avec_produit || false,
      avec_torchons: false,
      mode_paiement: d.mode_paiement || "",
      statut_paiement_commercial: (d as any).statut_paiement_commercial || "non_paye",
      montant_verse_client: (d as any).montant_verse_client ? String((d as any).montant_verse_client) : "",
    });
    setEditDialogOpen(true);
  };

  const handleReject = (d: Demande) => {
    setRejectingDemande(d);
    setRejectOpen(true);
  };

  const confirmReject = (motif: string) => {
    if (!rejectingDemande) return;
    statusMutation.mutate({ id: rejectingDemande.id, statut: "rejetee", motif });
  };

  const openDevisPreview = (d: Demande) => {
    setDevisDemande(d);
    setDevisOpen(true);
  };

  const handleDocumentGenerated = (docType: string, docName: string) => {
    if (!devisDemande && !editingDemande) return;
    const id = (devisDemande || editingDemande)!.id;
    if (!documentStore[id]) documentStore[id] = [];
    documentStore[id].push({
      type: docType,
      name: docName,
      date: format(new Date(), "dd/MM/yyyy HH:mm"),
    });
  };

  const filtered = useMemo(() => {
    return demandes.filter((d) => {
      const q = search.toLowerCase();
      const matchSearch = !search || d.nom.toLowerCase().includes(q) || String(d.num_demande).includes(q) || d.telephone_direct?.includes(q);
      const matchService = filterService === "all" || d.type_service === filterService;
      const matchPrestation = filterPrestation === "all" || d.type_prestation === filterPrestation;
      let matchDate = true;
      if (dateFrom && d.date_prestation) matchDate = new Date(d.date_prestation) >= dateFrom;
      if (dateTo && d.date_prestation && matchDate) matchDate = new Date(d.date_prestation) <= dateTo;
      return matchSearch && matchService && matchPrestation && matchDate;
    });
  }, [demandes, search, filterService, filterPrestation, dateFrom, dateTo]);

  // Build service fields adapter for ServiceFormFields component
  const buildServiceFields = (currentForm: FormState, updater: (key: string, val: any) => void) => ({
    typeBien: currentForm.type_bien,
    setTypeBien: (v: string) => updater("type_bien", v),
    superficie: currentForm.superficie_m2,
    setSuperficie: (v: string) => updater("superficie_m2", v),
    etatLogement: currentForm.etat_logement,
    setEtatLogement: (v: string) => updater("etat_logement", v),
    typeSalissure: currentForm.type_salissure,
    setTypeSalissure: (v: string) => updater("type_salissure", v),
    natureIntervention: currentForm.nature_intervention,
    setNatureIntervention: (v: string) => updater("nature_intervention", v),
    descriptionIntervention: currentForm.description_intervention,
    setDescriptionIntervention: (v: string) => updater("description_intervention", v),
    duree: currentForm.duree_heures,
    setDuree: (v: string) => updater("duree_heures", v),
    nbIntervenants: currentForm.nombre_intervenants,
    setNbIntervenants: (v: string) => updater("nombre_intervenants", v),
    frequence: currentForm.frequence,
    setFrequence: (v: string) => updater("frequence", v),
    avecProduit: currentForm.avec_produit,
    setAvecProduit: (v: boolean) => updater("avec_produit", v),
    avecTorchons: currentForm.avec_torchons,
    setAvecTorchons: (v: boolean) => updater("avec_torchons", v),
    datePrestation: currentForm.date_prestation,
    setDatePrestation: (v: string) => updater("date_prestation", v),
    heurePrestation: currentForm.heure_prestation,
    setHeurePrestation: (v: string) => updater("heure_prestation", v),
    preferenceHoraire: currentForm.preference_horaire,
    setPreferenceHoraire: (v: string) => updater("preference_horaire", v),
    nomEntreprise: currentForm.nom_entreprise,
    setNomEntreprise: (v: string) => updater("nom_entreprise", v),
    contactEntreprise: currentForm.contact_entreprise,
    setContactEntreprise: (v: string) => updater("contact_entreprise", v),
    email: currentForm.email,
    setEmail: (v: string) => updater("email", v),
  });

  const updateForm = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));
  const updateEditForm = (key: string, val: any) => setEditForm((f) => ({ ...f, [key]: val }));

  const segment = (f: FormState) => f.type_service === "SPE" ? "entreprise" : "particulier";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Les demandes en attente</h1>
          <p className="text-muted-foreground text-sm">
            {filtered.length} demande(s) en attente de traitement
          </p>
        </div>
        <NewDemandeDropdown onSelect={handleNewDemande} />
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
            <SelectItem value="all">Tous segments</SelectItem>
            <SelectItem value="SPP">Particulier</SelectItem>
            <SelectItem value="SPE">Entreprise</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPrestation} onValueChange={setFilterPrestation}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous services</SelectItem>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((d) => (
            <Card key={d.id} className="overflow-hidden">
              <CardContent className="p-5 space-y-1">
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className={d.type_service === "SPP" ? "bg-primary text-primary-foreground" : "bg-spe text-spe-foreground"}>
                      {d.type_service}
                    </Badge>
                    <span className="text-xs text-muted-foreground">#{d.num_demande}</span>
                    {d.statut === "nrp" && <Badge variant="destructive" className="text-[10px]">NRP</Badge>}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(d.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                  </span>
                </div>

                {/* Client info */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <p><span className="font-semibold">Nom :</span> {d.nom}</p>
                  <p><span className="font-semibold">Téléphone :</span> {d.telephone_direct || "—"}</p>
                  <p></p>
                  <p><span className="font-semibold">WhatsApp :</span> {d.telephone_whatsapp || "—"}</p>
                </div>

                {/* Détails de la prestation */}
                <Collapsible defaultOpen>
                  <CollapsibleTrigger className="flex items-center justify-between w-full bg-primary text-primary-foreground rounded px-3 py-1.5 text-sm font-medium mt-2">
                    Détails de la prestation
                    <ChevronDown className="h-4 w-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-1 pt-2 pb-1">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                      <p><span className="font-semibold">Service :</span> {d.type_prestation}</p>
                      <p><span className="font-semibold">Type de bien :</span> {d.type_bien || "—"}</p>
                      <p><span className="font-semibold">Fréquence :</span> {FREQUENCES.find(f => f.value === d.frequence)?.label || d.frequence}</p>
                      <p><span className="font-semibold">Durée :</span> {d.duree_heures ? `${d.duree_heures}h` : "—"}</p>
                      <p><span className="font-semibold">Intervenants :</span> {d.nombre_intervenants || 1}</p>
                      {d.superficie_m2 && <p><span className="font-semibold">Superficie :</span> {d.superficie_m2} m²</p>}
                      <p><span className="font-semibold">Services opt. :</span> {d.avec_produit ? "Produit" : "—"}</p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Lieux */}
                <Collapsible defaultOpen>
                  <CollapsibleTrigger className="flex items-center justify-between w-full bg-primary text-primary-foreground rounded px-3 py-1.5 text-sm font-medium">
                    Lieux
                    <ChevronDown className="h-4 w-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-1 pt-2 pb-1">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                      <p><span className="font-semibold">Date :</span> {d.date_prestation || "—"}</p>
                      <p><span className="font-semibold">Heure :</span> {d.heure_prestation || "—"}</p>
                      <p><span className="font-semibold">Ville :</span> {d.ville}</p>
                      <p><span className="font-semibold">Quartier :</span> {d.quartier || "—"}</p>
                      <p className="col-span-2"><span className="font-semibold">Adresse :</span> {d.adresse || "—"}</p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Notes */}
                <Collapsible defaultOpen>
                  <CollapsibleTrigger className="flex items-center justify-between w-full bg-primary text-primary-foreground rounded px-3 py-1.5 text-sm font-medium">
                    Notes et précision
                    <ChevronDown className="h-4 w-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-1 pt-2 pb-1">
                    <p className="text-sm text-muted-foreground">{d.notes_client || "Aucune note"}</p>
                  </CollapsibleContent>
                </Collapsible>

                {/* Tarification */}
                {d.montant_total && (
                  <div className="bg-muted/30 rounded-lg px-3 py-2 text-sm space-y-1">
                    <div>
                      <span className="font-semibold">Montant : </span>
                      <span className="font-bold text-primary">{d.montant_total} MAD</span>
                      <span className="text-muted-foreground ml-2 text-xs">
                        ({isDevisType(d.type_prestation) ? "Devis" : "Réservation"})
                      </span>
                    </div>
                    {d.mode_paiement && (
                      <div className="text-xs"><span className="font-semibold">Mode : </span>{d.mode_paiement}</div>
                    )}
                    {(d as any).statut_paiement_commercial && (d as any).statut_paiement_commercial !== "non_paye" && (
                      <div className="text-xs">
                        <span className="font-semibold">Paiement : </span>
                        {STATUTS_PAIEMENT_COMMERCIAL.find(s => s.value === (d as any).statut_paiement_commercial)?.label}
                        {(d as any).montant_verse_client ? ` — ${(d as any).montant_verse_client} MAD versés` : ""}
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-3">
                  <Button
                    size="sm"
                    className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    onClick={() => statusMutation.mutate({ id: d.id, statut: "nrp" })}
                    disabled={d.statut === "nrp"}
                  >
                    NRP
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-destructive text-destructive hover:bg-destructive/10"
                    onClick={() => handleReject(d)}
                  >
                    Annulé
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                    onClick={() => statusMutation.mutate({ id: d.id, statut: "confirmee" })}
                  >
                    Confirmer
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => openEdit(d)}
                  >
                    Modifier
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Demande Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Ajouter une demande — {form.type_prestation}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({form.type_service === "SPE" ? "Entreprise" : "Particulier"})
              </span>
            </DialogTitle>
          </DialogHeader>

          {/* Client info */}
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div><Label>Nom *</Label><Input value={form.nom} onChange={(e) => updateForm("nom", e.target.value)} /></div>
            <div><Label>Tél. direct</Label><Input value={form.telephone_direct} onChange={(e) => updateForm("telephone_direct", e.target.value)} /></div>
            <div><Label>Tél. WhatsApp</Label><Input value={form.telephone_whatsapp} onChange={(e) => updateForm("telephone_whatsapp", e.target.value)} /></div>
            <div><Label>Ville</Label><Input value={form.ville} onChange={(e) => updateForm("ville", e.target.value)} /></div>
            <div>
              <Label>Quartier</Label>
              <Select value={form.quartier} onValueChange={(v) => updateForm("quartier", v)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>{QUARTIERS_CASABLANCA.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Adresse</Label><Input value={form.adresse} onChange={(e) => updateForm("adresse", e.target.value)} /></div>
          </div>

          {/* Dynamic form fields */}
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2 border-t pt-3">
              <p className="text-sm font-semibold text-muted-foreground mb-2">Détails du service</p>
            </div>
            <ServiceFormFields
              typePrestation={form.type_prestation}
              segment={segment(form)}
              fields={buildServiceFields(form, updateForm)}
            />
          </div>

          {/* Tarification & Paiement */}
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2 border-t pt-3">
              <p className="text-sm font-semibold text-muted-foreground mb-2">Tarification & Paiement</p>
            </div>
            <div>
              <Label>Montant total (MAD)</Label>
              <Input type="number" value={form.montant_total} onChange={(e) => updateForm("montant_total", e.target.value)} />
              {form.montant_total && (
                <p className="text-xs text-muted-foreground mt-1">Candidat : {(Number(form.montant_total) / 2).toFixed(0)} MAD</p>
              )}
            </div>
            <div>
              <Label>Mode de paiement</Label>
              <Select value={form.mode_paiement} onValueChange={(v) => updateForm("mode_paiement", v)}>
                <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>
                  {MODES_PAIEMENT_COMMERCIAL.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Statut de paiement</Label>
              <Select value={form.statut_paiement_commercial} onValueChange={(v) => updateForm("statut_paiement_commercial", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUTS_PAIEMENT_COMMERCIAL.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(form.statut_paiement_commercial === "acompte_verse" || form.statut_paiement_commercial === "paiement_partiel") && (
              <div>
                <Label>Montant versé par le client (MAD)</Label>
                <Input type="number" value={form.montant_verse_client} onChange={(e) => updateForm("montant_verse_client", e.target.value)} />
                {form.montant_total && form.montant_verse_client && (
                  <p className="text-xs text-destructive mt-1">
                    Reste à payer : {(Number(form.montant_total) - Number(form.montant_verse_client)).toFixed(0)} MAD
                  </p>
                )}
              </div>
            )}
            <div className="col-span-2">
              <Label>Notes client</Label>
              <Textarea value={form.notes_client} onChange={(e) => updateForm("notes_client", e.target.value)} rows={3} />
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <Button onClick={() => addMutation.mutate()} disabled={!form.nom || !form.type_prestation || addMutation.isPending}>
              {addMutation.isPending ? "Ajout..." : "Ajouter la demande"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Modifier la demande #{editingDemande?.num_demande}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                — {editForm.type_prestation}
              </span>
            </DialogTitle>
          </DialogHeader>

          {/* Client info */}
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div><Label>Nom *</Label><Input value={editForm.nom} onChange={(e) => updateEditForm("nom", e.target.value)} /></div>
            <div><Label>Tél. direct</Label><Input value={editForm.telephone_direct} onChange={(e) => updateEditForm("telephone_direct", e.target.value)} /></div>
            <div><Label>Tél. WhatsApp</Label><Input value={editForm.telephone_whatsapp} onChange={(e) => updateEditForm("telephone_whatsapp", e.target.value)} /></div>
            <div><Label>Ville</Label><Input value={editForm.ville} onChange={(e) => updateEditForm("ville", e.target.value)} /></div>
            <div>
              <Label>Quartier</Label>
              <Select value={editForm.quartier} onValueChange={(v) => updateEditForm("quartier", v)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>{QUARTIERS_CASABLANCA.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Adresse</Label><Input value={editForm.adresse} onChange={(e) => updateEditForm("adresse", e.target.value)} /></div>
          </div>

          {/* Dynamic form fields */}
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2 border-t pt-3">
              <p className="text-sm font-semibold text-muted-foreground mb-2">Détails du service</p>
            </div>
            <ServiceFormFields
              typePrestation={editForm.type_prestation}
              segment={segment(editForm)}
              fields={buildServiceFields(editForm, updateEditForm)}
            />
          </div>

          {/* Tarification & Paiement */}
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2 border-t pt-3">
              <p className="text-sm font-semibold text-muted-foreground mb-2">Tarification & Paiement</p>
            </div>
            <div>
              <Label>Montant total (MAD)</Label>
              <Input type="number" value={editForm.montant_total} onChange={(e) => updateEditForm("montant_total", e.target.value)} />
              {editForm.montant_total && (
                <p className="text-xs text-muted-foreground mt-1">Candidat : {(Number(editForm.montant_total) / 2).toFixed(0)} MAD</p>
              )}
            </div>
            <div>
              <Label>Mode de paiement</Label>
              <Select value={editForm.mode_paiement} onValueChange={(v) => updateEditForm("mode_paiement", v)}>
                <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>
                  {MODES_PAIEMENT_COMMERCIAL.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Statut de paiement</Label>
              <Select value={editForm.statut_paiement_commercial} onValueChange={(v) => updateEditForm("statut_paiement_commercial", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUTS_PAIEMENT_COMMERCIAL.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(editForm.statut_paiement_commercial === "acompte_verse" || editForm.statut_paiement_commercial === "paiement_partiel") && (
              <div>
                <Label>Montant versé par le client (MAD)</Label>
                <Input type="number" value={editForm.montant_verse_client} onChange={(e) => updateEditForm("montant_verse_client", e.target.value)} />
                {editForm.montant_total && editForm.montant_verse_client && (
                  <p className="text-xs text-destructive mt-1">
                    Reste à payer : {(Number(editForm.montant_total) - Number(editForm.montant_verse_client)).toFixed(0)} MAD
                  </p>
                )}
              </div>
            )}
            <div className="col-span-2">
              <Label>Notes client</Label>
              <Textarea value={editForm.notes_client} onChange={(e) => updateEditForm("notes_client", e.target.value)} rows={3} />
            </div>
          </div>

          {/* Document History */}
          <div className="border-t pt-4 mt-2">
            <p className="text-sm font-semibold text-muted-foreground mb-3">Historique des documents</p>
            <DocumentHistory
              documents={editingDemande ? (documentStore[editingDemande.id] || []) : []}
              onView={(doc) => toast({ title: "Aperçu", description: doc.name })}
              onDownload={(doc) => toast({ title: "Téléchargement", description: doc.name })}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-4 border-t pt-4">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Annuler</Button>
            <Button
              variant="secondary"
              onClick={() => {
                if (editingDemande) openDevisPreview(editingDemande);
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              {editingDemande && isDevisType(editingDemande.type_prestation) ? "Générer devis" : "Télécharger PNG"}
            </Button>
            <Button onClick={() => editMutation.mutate()} disabled={!editForm.nom || !editForm.type_prestation || editMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />Enregistrer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <RejectModal
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        onConfirm={confirmReject}
        numDemande={rejectingDemande?.num_demande}
      />

      {/* Devis Preview Modal */}
      <DevisPreviewModal
        demande={devisDemande}
        open={devisOpen}
        onOpenChange={setDevisOpen}
        onDocumentGenerated={handleDocumentGenerated}
      />
    </div>
  );
}
