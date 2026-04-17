import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Eye, FileText, TrendingUp, Clock, Users, X, Building2, CreditCard, UserCircle, Printer, CalendarIcon, Download, Trash2 } from "lucide-react";
import { Facturation, partAgence, partProfil, STATUT_MISSION_OPTIONS, STATUT_PAIEMENT_OPTIONS, MODE_PAIEMENT_OPTIONS, PROFIL_TYPE_OPTIONS } from "@/lib/finance-types";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

const STATUT_FACTURE_OPTIONS = [
  { value: "non_paye", label: "Paiement en attente", color: "bg-red-100 text-red-800" },
  { value: "agence_payee_client", label: "Agence payée / Client", color: "bg-blue-100 text-blue-800" },
  { value: "profil_paye_client", label: "Profil payé / Client", color: "bg-orange-100 text-orange-800" },
  { value: "paye", label: "Payé", color: "bg-green-100 text-green-800" },
  { value: "paiement_partiel", label: "Paiement partiel", color: "bg-amber-100 text-amber-800" },
  { value: "facturation_annulee", label: "Facturation annulée", color: "bg-rose-100 text-rose-800" },
] as const;

export default function HistoriqueMissions() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("all");
  const [filterSegment, setFilterSegment] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [viewMission, setViewMission] = useState<Facturation | null>(null);
  const [editMission, setEditMission] = useState<Facturation | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("facturation").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["facturation"] });
      toast({ title: "Facture supprimée" });
      setDeleteId(null);
    },
    onError: () => {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    },
  });

  const { data: missions = [] } = useQuery({
    queryKey: ["facturation", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("facturation").select("*").order("num_mission", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Facturation[];
    },
  });

  const { data: demandes = [] } = useQuery({
    queryKey: ["demandes", "for_facturation"],
    queryFn: async () => {
      const { data } = await supabase.from("demandes").select("id, num_demande, nom, ville, type_prestation, type_service, montant_total, date_prestation, mode_paiement, candidat_nom, telephone_direct")
        .in("statut", ["confirmee", "confirme", "confirme_intervention", "prestation_en_cours", "prestation_terminee", "paye", "facturation_annulee"]);
      return data || [];
    },
  });

  const { data: profils = [] } = useQuery({
    queryKey: ["profils", "list_finance"],
    queryFn: async () => {
      const { data } = await supabase.from("profils").select("id, nom, prenom");
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    return missions.filter((m) => {
      if (filterStatut !== "all" && m.statut_paiement !== filterStatut) return false;
      if (filterSegment !== "all" && (m as any).segment !== filterSegment) return false;
      if (dateFrom && m.date_intervention) {
        if (parseISO(m.date_intervention) < dateFrom) return false;
      }
      if (dateTo && m.date_intervention) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        if (parseISO(m.date_intervention) > endOfDay) return false;
      }
      if ((dateFrom || dateTo) && !m.date_intervention) return false;
      if (search) {
        const s = search.toLowerCase();
        return (m.nom_client?.toLowerCase().includes(s) || m.profil_nom?.toLowerCase().includes(s) || String(m.num_mission).includes(s) || m.ville?.toLowerCase().includes(s));
      }
      return true;
    });
  }, [missions, filterStatut, filterSegment, dateFrom, dateTo, search]);

  const totalMissions = filtered.length;
  const totalCA = filtered.reduce((s, m) => s + (m.montant_total || 0), 0);
  const commissionAgence = filtered.reduce((s, m) => s + partAgence(m), 0);
  const paiementsEnAttente = filtered.filter((m) => m.statut_paiement === "non_paye" || m.statut_paiement === "paiement_partiel").length;
  const fmt = (n: number) => n.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " DH";

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Facturation> & { id: string }) => {
      const { id, ...rest } = updates;
      const { error } = await supabase.from("facturation").update(rest as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["facturation"] });
      toast({ title: "Facture mise à jour" });
      setEditMission(null);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("facturation").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["facturation"] });
      toast({ title: "Facture créée" });
      setShowCreate(false);
    },
  });

  const getStatutBadge = (statut: string) => {
    const opt = STATUT_FACTURE_OPTIONS.find((o) => o.value === statut);
    if (opt) return <Badge className={opt.color}>{opt.label}</Badge>;
    return <Badge className="bg-red-100 text-red-800">Paiement en attente</Badge>;
  };

  const handleExportRapport = () => {
    const headers = ["Commercial", "N° Facture", "Date Prestation", "Client - Ville", "Service", "Segment", "Montant HT", "TVA", "Montant TTC", "Mode paiement", "Payé", "Reste à payer", "Statut", "Date paiement", "Commentaire"];
    const rows = filtered.map((m) => {
      const tva = (m.tva_pourcentage || 20);
      const montantHT = m.montant_total;
      const montantTVA = montantHT * tva / 100;
      const montantTTC = montantHT + montantTVA;
      const paye = m.montant_paye_client || 0;
      const reste = montantTTC - paye;
      const statutLabel = STATUT_FACTURE_OPTIONS.find((o) => o.value === m.statut_paiement)?.label || m.statut_paiement;
      return [
        m.commercial || "—",
        `FAC-${String(m.num_mission).padStart(6, "0")}`,
        m.date_intervention ? format(new Date(m.date_intervention), "dd/MM/yyyy") : "—",
        `${m.nom_client} - ${m.ville || ""}`,
        m.type_service || "—",
        (m as any).segment === "entreprise" ? "Entreprise" : "Particulier",
        montantHT.toFixed(2),
        montantTVA.toFixed(2),
        montantTTC.toFixed(2),
        m.mode_paiement_prevu || "—",
        paye.toFixed(2),
        reste.toFixed(2),
        statutLabel,
        m.date_paiement_client ? format(new Date(m.date_paiement_client), "dd/MM/yyyy") : "—",
        m.commentaire || "",
      ];
    });
    const csv = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport-facturation-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="bg-[hsl(220,40%,20%)] text-white rounded-t-lg px-6 py-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Suivi Facturation</h2>
          <p className="text-sm text-white/70">Suivi complet de toutes les factures</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportRapport} variant="outline" className="bg-transparent border-white/30 text-white hover:bg-white/10 gap-1.5">
            <Download className="h-4 w-4" /> Exporter Rapport
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0">
        <div className="bg-[hsl(220,35%,28%)] text-white px-5 py-4 flex items-center gap-3">
          <FileText className="h-8 w-8 text-white/60" />
          <div>
            <p className="text-2xl font-bold">{totalMissions}</p>
            <p className="text-xs text-white/60">Total factures</p>
          </div>
        </div>
        <div className="bg-[hsl(220,35%,25%)] text-white px-5 py-4 flex items-center gap-3">
          <TrendingUp className="h-8 w-8 text-white/60" />
          <div>
            <p className="text-2xl font-bold">{fmt(totalCA)}</p>
            <p className="text-xs text-white/60">Chiffre d'affaires</p>
          </div>
        </div>
        <div className="bg-[hsl(220,35%,22%)] text-white px-5 py-4 flex items-center gap-3">
          <Clock className="h-8 w-8 text-white/60" />
          <div>
            <p className="text-2xl font-bold">{fmt(commissionAgence)}</p>
            <p className="text-xs text-white/60">Commission Agence</p>
          </div>
        </div>
        <div className="bg-[hsl(220,35%,19%)] text-white px-5 py-4 flex items-center gap-3 rounded-tr-lg">
          <Users className="h-8 w-8 text-white/60" />
          <div>
            <p className="text-2xl font-bold">{paiementsEnAttente}</p>
            <p className="text-xs text-white/60">Paiements en attente</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 px-1 py-5">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher client, facture, ville..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <Select value={filterStatut} onValueChange={setFilterStatut}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {STATUT_FACTURE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterSegment} onValueChange={setFilterSegment}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Tous les segments" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les segments</SelectItem>
                <SelectItem value="particulier">Particulier</SelectItem>
                <SelectItem value="entreprise">Entreprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <span className="text-sm text-muted-foreground font-medium">Période :</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Du"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={fr} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground">→</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, "dd/MM/yyyy") : "Au"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={fr} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }} className="text-muted-foreground">
              <X className="h-4 w-4 mr-1" /> Réinitialiser
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-b-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-b-2">
              <TableHead className="uppercase text-xs tracking-wider font-semibold">Commercial</TableHead>
              <TableHead className="uppercase text-xs tracking-wider font-semibold">N° Facture</TableHead>
              <TableHead className="uppercase text-xs tracking-wider font-semibold">Date Prestation</TableHead>
              <TableHead className="uppercase text-xs tracking-wider font-semibold">Client - Ville</TableHead>
              <TableHead className="uppercase text-xs tracking-wider font-semibold">Service</TableHead>
              <TableHead className="uppercase text-xs tracking-wider font-semibold">Segment</TableHead>
              <TableHead className="uppercase text-xs tracking-wider font-semibold">Montant HT</TableHead>
              <TableHead className="uppercase text-xs tracking-wider font-semibold">TVA</TableHead>
              <TableHead className="uppercase text-xs tracking-wider font-semibold">Montant TTC</TableHead>
              <TableHead className="uppercase text-xs tracking-wider font-semibold">Mode paiement</TableHead>
              <TableHead className="uppercase text-xs tracking-wider font-semibold">Payé</TableHead>
              <TableHead className="uppercase text-xs tracking-wider font-semibold">Reste à payer</TableHead>
              <TableHead className="uppercase text-xs tracking-wider font-semibold">Statut</TableHead>
              <TableHead className="uppercase text-xs tracking-wider font-semibold">Date paiement</TableHead>
              <TableHead className="uppercase text-xs tracking-wider font-semibold">Commentaire</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={16} className="text-center text-muted-foreground py-8">Aucune facture</TableCell></TableRow>
            ) : filtered.map((m) => {
              const tva = m.tva_pourcentage || 20;
              const montantHT = m.montant_total;
              const montantTVA = montantHT * tva / 100;
              const montantTTC = montantHT + montantTVA;
              const paye = m.montant_paye_client || 0;
              const reste = montantTTC - paye;
              const isPayee = m.statut_paiement === "paye" || reste <= 0;

              return (
                <TableRow key={m.id} className="hover:bg-muted/30">
                  <TableCell className="text-sm">{m.commercial || "—"}</TableCell>
                  <TableCell className="font-mono text-xs font-semibold text-primary">FAC-{String(m.num_mission).padStart(6, "0")}</TableCell>
                  <TableCell className="text-sm">{m.date_intervention ? format(new Date(m.date_intervention), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell>
                    <div className="font-semibold text-sm">{m.nom_client}</div>
                    <div className="text-xs text-muted-foreground">{m.ville || ""}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.type_service || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={(m as any).segment === "entreprise" ? "border-violet-300 text-violet-700 bg-violet-50" : "border-sky-300 text-sky-700 bg-sky-50"}>
                      {(m as any).segment === "entreprise" ? "Entreprise" : "Particulier"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold">{fmt(montantHT)}</TableCell>
                  <TableCell className="text-sm">{fmt(montantTVA)}</TableCell>
                  <TableCell className="font-semibold">{fmt(montantTTC)}</TableCell>
                  <TableCell className="text-sm">{m.mode_paiement_prevu || "—"}</TableCell>
                  <TableCell className="text-emerald-700 font-medium">{fmt(paye)}</TableCell>
                  <TableCell className="text-amber-600 font-medium">{reste > 0 ? fmt(reste) : "0,00 DH"}</TableCell>
                  <TableCell>{getStatutBadge(m.statut_paiement)}</TableCell>
                  <TableCell className="text-sm">{m.date_paiement_client ? format(new Date(m.date_paiement_client), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{m.commentaire || "—"}</TableCell>
                  <TableCell className="flex gap-1">
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={() => setViewMission(m)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(m.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {filtered.length > 0 && (
          <div className="flex justify-between items-center px-4 py-3 border-t text-sm text-muted-foreground">
            <span className="text-primary font-medium">{filtered.length} facture(s) affichée(s)</span>
            <span>Total affiché : <strong className="text-foreground">{fmt(totalCA)}</strong></span>
          </div>
        )}
      </div>

      {viewMission && (
        <MissionViewModal
          mission={viewMission}
          onClose={() => setViewMission(null)}
          onEdit={() => { setEditMission(viewMission); setViewMission(null); }}
          fmt={fmt}
        />
      )}

      {editMission && (
        <MissionEditModal
          mission={editMission}
          onClose={() => setEditMission(null)}
          onSave={(updates) => updateMutation.mutate({ id: editMission.id, ...updates })}
        />
      )}

      {showCreate && (
        <MissionCreateModal
          demandes={demandes}
          profils={profils}
          onClose={() => setShowCreate(false)}
          onCreate={(data) => createMutation.mutate(data)}
        />
      )}

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <div className="space-y-4 py-2">
            <h3 className="text-lg font-semibold">Confirmer la suppression</h3>
            <p className="text-sm text-muted-foreground">Voulez-vous vraiment supprimer cette facture ? Cette action est irréversible.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteId(null)}>Annuler</Button>
              <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ===== VIEW MODAL ===== */
function MissionViewModal({ mission, onClose, onEdit, fmt }: { mission: Facturation; onClose: () => void; onEdit: () => void; fmt: (n: number) => string }) {
  const pa = partAgence(mission);
  const pp = partProfil(mission);
  const tva = mission.tva_pourcentage || 20;
  const montantTVA = mission.montant_total * tva / 100;
  const montantTTC = mission.montant_total + montantTVA;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <div className="bg-[hsl(220,40%,20%)] text-white px-6 py-4 relative">
          <div className="flex items-center gap-3 mb-1">
            <span className="font-mono text-sm text-white/70">FAC-{String(mission.num_mission).padStart(6, "0")}</span>
          </div>
          <h3 className="text-xl font-bold">{mission.nom_client}</h3>
          <div className="flex items-center gap-4 text-sm text-white/70 mt-1">
            <span>📅 {mission.date_intervention ? format(new Date(mission.date_intervention), "dd/MM/yyyy") : "—"}</span>
            <span>📍 {mission.ville || "—"}</span>
            <span>👤 {mission.profil_nom || "—"}</span>
          </div>
          <button onClick={onClose} className="absolute top-4 right-4 text-white/60 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 border-b">
          <div className="text-center py-4 border-r">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Montant HT</p>
            <p className="text-2xl font-bold mt-1">{fmt(mission.montant_total)}</p>
          </div>
          <div className="text-center py-4 border-r">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">TVA ({tva}%)</p>
            <p className="text-2xl font-bold mt-1">{fmt(montantTVA)}</p>
          </div>
          <div className="text-center py-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Montant TTC</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{fmt(montantTTC)}</p>
          </div>
        </div>

        <Tabs defaultValue="infos" className="px-6 pt-2 pb-4">
          <TabsList className="mb-4 bg-transparent border-b rounded-none w-full justify-start gap-0 h-auto p-0">
            <TabsTrigger value="infos" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2 text-sm">Informations</TabsTrigger>
            <TabsTrigger value="paiement" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2 text-sm">Paiement</TabsTrigger>
            <TabsTrigger value="repartition" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2 text-sm">Répartition</TabsTrigger>
          </TabsList>

          <TabsContent value="infos">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-lg p-4 flex items-start gap-3">
                <UserCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Commercial</p>
                  <p className="font-semibold text-sm">{mission.commercial || "—"}</p>
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 flex items-start gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Service</p>
                  <p className="font-semibold text-sm">{mission.type_service || "—"}</p>
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 flex items-start gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Segment</p>
                  <p className="font-semibold text-sm">{(mission as any).segment === "entreprise" ? "Entreprise" : "Particulier"}</p>
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 flex items-start gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Mode paiement</p>
                  <p className="font-semibold text-sm">{mission.mode_paiement_prevu || "—"}</p>
                </div>
              </div>
            </div>
            {mission.commentaire && (
              <div className="mt-4 bg-muted/30 rounded-lg p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-1">Commentaire</p>
                <p className="text-sm">{mission.commentaire}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="paiement">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground">Montant payé</p>
                  <p className="font-semibold text-lg">{fmt(mission.montant_paye_client || 0)}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground">Reste à payer</p>
                  <p className="font-semibold text-lg text-amber-600">{fmt(montantTTC - (mission.montant_paye_client || 0))}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground">Mode de paiement réel</p>
                  <p className="font-semibold text-sm">{mission.mode_paiement_reel || "—"}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground">Date de paiement</p>
                  <p className="font-semibold text-sm">{mission.date_paiement_client ? format(new Date(mission.date_paiement_client), "dd/MM/yyyy") : "—"}</p>
                </div>
              </div>
              {mission.justificatif_url && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Justificatif</p>
                  <a href={mission.justificatif_url} target="_blank" rel="noopener" className="text-primary underline text-sm">Voir le justificatif</a>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="repartition">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-4 border border-emerald-200 dark:border-emerald-800">
                  <p className="text-xs text-emerald-600">Part agence</p>
                  <p className="font-bold text-xl text-emerald-700">{fmt(pa)}</p>
                </div>
                <div className="bg-sky-50 dark:bg-sky-950/30 rounded-lg p-4 border border-sky-200 dark:border-sky-800">
                  <p className="text-xs text-sky-600">Part profil</p>
                  <p className="font-bold text-xl text-sky-700">{fmt(pp)}</p>
                </div>
              </div>

              {mission.encaisse_par === "profil" ? (
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-semibold">Encaissé par le profil</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Montant encaissé</p>
                      <p className="font-medium">{fmt(mission.montant_encaisse_profil || 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Part agence reversée</p>
                      <p className="font-medium">{mission.part_agence_reversee ? "✅ Oui" : "❌ Non"}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-semibold">Encaissé par l'agence</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Part profil versée</p>
                      <p className="font-medium">{mission.part_profil_versee ? "✅ Oui" : "❌ Non"}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between items-center px-6 py-3 border-t bg-muted/20">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onEdit}>
            <Printer className="h-4 w-4" /> Modifier
          </Button>
          <Button variant="outline" size="sm" onClick={onClose}>Fermer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ===== EDIT MODAL ===== */
function MissionEditModal({ mission, onClose, onSave }: { mission: Facturation; onClose: () => void; onSave: (u: any) => void }) {
  const [form, setForm] = useState({
    statut_paiement: mission.statut_paiement,
    montant_paye_client: mission.montant_paye_client || 0,
    mode_paiement_reel: mission.mode_paiement_reel || "",
    date_paiement_client: mission.date_paiement_client || "",
    encaisse_par: mission.encaisse_par || "agence",
    montant_encaisse_profil: mission.montant_encaisse_profil || 0,
    part_agence_reversee: mission.part_agence_reversee,
    date_remise_agence: mission.date_remise_agence || "",
    part_profil_versee: mission.part_profil_versee,
    date_versement_profil: mission.date_versement_profil || "",
    commission_pourcentage: mission.commission_pourcentage,
    commercial: mission.commercial || "",
    commentaire: mission.commentaire || "",
    tva_pourcentage: mission.tva_pourcentage || 20,
  });

  const tva = form.tva_pourcentage;
  const montantTVA = mission.montant_total * tva / 100;
  const montantTTC = mission.montant_total + montantTVA;
  const resteClient = montantTTC - form.montant_paye_client;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = `${mission.id}/${file.name}`;
    const { error } = await supabase.storage.from("justificatifs").upload(path, file, { upsert: true });
    if (!error) {
      const { data: urlData } = supabase.storage.from("justificatifs").getPublicUrl(path);
      onSave({ justificatif_url: urlData.publicUrl });
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-[hsl(220,40%,20%)] text-white px-6 py-4 -mx-6 -mt-6 rounded-t-lg mb-4">
          <h3 className="text-lg font-bold">Modifier — FAC-{String(mission.num_mission).padStart(6, "0")}</h3>
          <p className="text-sm text-white/70">{mission.nom_client}</p>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 text-sm bg-muted/50 p-4 rounded-lg">
            <div><span className="text-muted-foreground">Montant HT :</span> <strong>{mission.montant_total} DH</strong></div>
            <div><span className="text-muted-foreground">TVA ({tva}%) :</span> <strong>{montantTVA.toFixed(2)} DH</strong></div>
            <div><span className="text-muted-foreground">Montant TTC :</span> <strong>{montantTTC.toFixed(2)} DH</strong></div>
            <div><span className="text-muted-foreground">Commission :</span> <strong>{form.commission_pourcentage}%</strong></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Commercial</Label>
              <Input value={form.commercial} onChange={(e) => setForm({ ...form, commercial: e.target.value })} placeholder="Nom du commercial" />
            </div>
            <div className="space-y-1">
              <Label>TVA %</Label>
              <Input type="number" value={form.tva_pourcentage} onChange={(e) => setForm({ ...form, tva_pourcentage: Number(e.target.value) })} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Commentaire</Label>
            <Textarea value={form.commentaire} onChange={(e) => setForm({ ...form, commentaire: e.target.value })} placeholder="Commentaire sur la facture..." rows={3} />
          </div>

          <div className="border-t pt-4">
            <h4 className="font-semibold mb-3">💳 Paiement</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Montant payé</Label>
                <Input type="number" value={form.montant_paye_client} onChange={(e) => setForm({ ...form, montant_paye_client: Number(e.target.value) })} />
                {resteClient > 0 && <p className="text-xs text-amber-600">Reste : {resteClient.toFixed(2)} DH</p>}
              </div>
              <div className="space-y-1">
                <Label>Mode de paiement</Label>
                <Select value={form.mode_paiement_reel} onValueChange={(v) => setForm({ ...form, mode_paiement_reel: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>{MODE_PAIEMENT_OPTIONS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Date de paiement</Label>
                <Input type="date" value={form.date_paiement_client} onChange={(e) => setForm({ ...form, date_paiement_client: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Statut paiement</Label>
                <Select value={form.statut_paiement} onValueChange={(v) => setForm({ ...form, statut_paiement: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUT_PAIEMENT_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Justificatif</Label>
                <div className="flex gap-2 items-center">
                  <Input type="file" onChange={handleFileUpload} />
                  {mission.justificatif_url && <a href={mission.justificatif_url} target="_blank" rel="noopener" className="text-xs text-primary underline">Voir</a>}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-semibold mb-3">🔁 Répartition interne</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Encaissé par</Label>
                <Select value={form.encaisse_par} onValueChange={(v) => setForm({ ...form, encaisse_par: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agence">Agence</SelectItem>
                    <SelectItem value="profil">Profil</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.encaisse_par === "profil" ? (
                <>
                  <div className="space-y-1">
                    <Label>Montant encaissé par le profil</Label>
                    <Input type="number" value={form.montant_encaisse_profil} onChange={(e) => setForm({ ...form, montant_encaisse_profil: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Part agence reversée ?</Label>
                    <Select value={form.part_agence_reversee ? "oui" : "non"} onValueChange={(v) => setForm({ ...form, part_agence_reversee: v === "oui" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="oui">Oui</SelectItem><SelectItem value="non">Non</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Date remise à l'agence</Label>
                    <Input type="date" value={form.date_remise_agence} onChange={(e) => setForm({ ...form, date_remise_agence: e.target.value })} />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <Label>Part profil versée ?</Label>
                    <Select value={form.part_profil_versee ? "oui" : "non"} onValueChange={(v) => setForm({ ...form, part_profil_versee: v === "oui" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="oui">Oui</SelectItem><SelectItem value="non">Non</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Date versement au profil</Label>
                    <Input type="date" value={form.date_versement_profil} onChange={(e) => setForm({ ...form, date_versement_profil: e.target.value })} />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Annuler</Button>
            <Button onClick={() => {
              const cleaned = {
                ...form,
                commercial: form.commercial || null,
                commentaire: form.commentaire || null,
                mode_paiement_reel: form.mode_paiement_reel || null,
                date_paiement_client: form.date_paiement_client || null,
                date_remise_agence: form.date_remise_agence || null,
                date_versement_profil: form.date_versement_profil || null,
              };
              onSave(cleaned);
            }}>Enregistrer</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ===== CREATE MODAL ===== */
function MissionCreateModal({ demandes, profils, onClose, onCreate }: { demandes: any[]; profils: any[]; onClose: () => void; onCreate: (d: any) => void }) {
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [demandeId, setDemandeId] = useState("");
  const [dateIntervention, setDateIntervention] = useState("");
  const [profilType, setProfilType] = useState("");
  const [nomClient, setNomClient] = useState("");
  const [ville, setVille] = useState("Casablanca");
  const [typeService, setTypeService] = useState("");
  const [segment, setSegment] = useState("particulier");
  const [montantTotal, setMontantTotal] = useState(0);
  const [commission, setCommission] = useState(50);
  const [modePaiement, setModePaiement] = useState("");
  const [encaissePar, setEncaissePar] = useState("agence");
  const [profilId, setProfilId] = useState("");
  const [commercial, setCommercial] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [tvaPourcentage, setTvaPourcentage] = useState(20);

  const selectedDemande = demandes.find((d) => d.id === demandeId);
  const selectedProfil = profils.find((p) => p.id === profilId);

  const effectiveMontant = mode === "auto" && selectedDemande ? (selectedDemande.montant_total || 0) : montantTotal;
  const effectiveSegment = mode === "auto" && selectedDemande ? (selectedDemande.type_service === "SPE" ? "entreprise" : "particulier") : segment;

  const pa = effectiveMontant * commission / 100;
  const pp = effectiveMontant * (100 - commission) / 100;
  const fmtLocal = (n: number) => n.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " DH";

  const handleCreate = () => {
    if (mode === "auto") {
      if (!selectedDemande) return;
      onCreate({
        demande_id: demandeId,
        profil_id: profilId || null,
        profil_nom: selectedProfil ? `${selectedProfil.prenom} ${selectedProfil.nom}` : (selectedDemande.candidat_nom || null),
        nom_client: selectedDemande.nom,
        ville: selectedDemande.ville || "Casablanca",
        type_service: selectedDemande.type_prestation,
        segment: selectedDemande.type_service === "SPE" ? "entreprise" : "particulier",
        date_intervention: selectedDemande.date_prestation,
        montant_total: selectedDemande.montant_total || 0,
        commission_pourcentage: commission,
        mode_paiement_prevu: modePaiement || selectedDemande.mode_paiement,
        statut_mission: "confirmee",
        encaisse_par: encaissePar,
        commercial: commercial || null,
        commentaire: commentaire || null,
        tva_pourcentage: tvaPourcentage,
      });
    } else {
      if (!nomClient) return;
      onCreate({
        demande_id: demandeId || undefined,
        profil_id: profilId || null,
        profil_nom: selectedProfil ? `${selectedProfil.prenom} ${selectedProfil.nom}` : profilType || null,
        nom_client: nomClient,
        ville: ville,
        type_service: typeService,
        segment: segment,
        date_intervention: dateIntervention || null,
        montant_total: montantTotal,
        commission_pourcentage: commission,
        mode_paiement_prevu: modePaiement,
        statut_mission: "confirmee",
        encaisse_par: encaissePar,
        commercial: commercial || null,
        commentaire: commentaire || null,
        tva_pourcentage: tvaPourcentage,
      });
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-[hsl(220,40%,20%)] text-white px-6 py-4 -mx-6 -mt-6 rounded-t-lg mb-4">
          <h3 className="text-lg font-bold">Nouvelle Facture</h3>
          <p className="text-sm text-white/70">Remplissez les informations de la facture</p>
        </div>

        <div className="flex gap-2 mb-4">
          <Button variant={mode === "auto" ? "default" : "outline"} size="sm" onClick={() => setMode("auto")}>
            Depuis une demande
          </Button>
          <Button variant={mode === "manual" ? "default" : "outline"} size="sm" onClick={() => setMode("manual")}>
            Saisie manuelle
          </Button>
        </div>

        <div className="space-y-4">
          {mode === "auto" ? (
            <>
              <div className="space-y-1">
                <Label>Demande source</Label>
                <Select value={demandeId} onValueChange={setDemandeId}>
                  <SelectTrigger><SelectValue placeholder="Choisir une demande" /></SelectTrigger>
                  <SelectContent>
                    {demandes.map((d) => (
                      <SelectItem key={d.id} value={d.id}>#{d.num_demande} — {d.nom} ({d.ville})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedDemande && (
                <div className="text-sm p-3 bg-muted rounded-md space-y-1">
                  <p><strong>Client :</strong> {selectedDemande.nom}</p>
                  <p><strong>Montant :</strong> {selectedDemande.montant_total || 0} DH</p>
                  <p><strong>Date :</strong> {selectedDemande.date_prestation || "Non définie"}</p>
                  <p><strong>Service :</strong> {selectedDemande.type_prestation}</p>
                  <p><strong>Segment :</strong> {selectedDemande.type_service === "SPE" ? "Entreprise" : "Particulier"}</p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Date intervention</Label>
                  <Input type="date" value={dateIntervention} onChange={(e) => setDateIntervention(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Profil</Label>
                  <Select value={profilType} onValueChange={setProfilType}>
                    <SelectTrigger><SelectValue placeholder="Type de profil" /></SelectTrigger>
                    <SelectContent>
                      {PROFIL_TYPE_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Nom du client</Label>
                <Input value={nomClient} onChange={(e) => setNomClient(e.target.value)} placeholder="Nom complet du client" />
              </div>
              <div className="space-y-1">
                <Label>Ville</Label>
                <Input value={ville} onChange={(e) => setVille(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Type de service</Label>
                  <Input value={typeService} onChange={(e) => setTypeService(e.target.value)} placeholder="Ex: Ménage standard" />
                </div>
                <div className="space-y-1">
                  <Label>Segment</Label>
                  <Select value={segment} onValueChange={setSegment}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="particulier">Particulier</SelectItem>
                      <SelectItem value="entreprise">Entreprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Commercial</Label>
              <Input value={commercial} onChange={(e) => setCommercial(e.target.value)} placeholder="Nom du commercial" />
            </div>
            <div className="space-y-1">
              <Label>TVA %</Label>
              <Input type="number" value={tvaPourcentage} onChange={(e) => setTvaPourcentage(Number(e.target.value))} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Profil assigné</Label>
            <Select value={profilId} onValueChange={setProfilId}>
              <SelectTrigger><SelectValue placeholder="Choisir un profil (optionnel)" /></SelectTrigger>
              <SelectContent>
                {profils.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.prenom} {p.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {mode === "manual" && (
              <div className="space-y-1">
                <Label>Montant HT (MAD)</Label>
                <Input type="number" value={montantTotal} onChange={(e) => setMontantTotal(Number(e.target.value))} />
              </div>
            )}
            <div className="space-y-1">
              <Label>Commission agence (%)</Label>
              <Input type="number" value={commission} onChange={(e) => setCommission(Number(e.target.value))} />
            </div>
          </div>

          {effectiveMontant > 0 && (
            <div className="grid grid-cols-2 gap-4 bg-muted/50 p-4 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Part Agence</p>
                <p className="text-lg font-bold text-emerald-700">{fmtLocal(pa)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Part Profil</p>
                <p className="text-lg font-bold text-sky-700">{fmtLocal(pp)}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Mode de paiement prévu</Label>
              <Select value={modePaiement} onValueChange={setModePaiement}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>{MODE_PAIEMENT_OPTIONS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Encaissement par</Label>
              <Select value={encaissePar} onValueChange={setEncaissePar}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agence">L'Agence</SelectItem>
                  <SelectItem value="profil">Le Profil</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Commentaire</Label>
            <Textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder="Commentaire sur la facture..." rows={3} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Annuler</Button>
            <Button onClick={handleCreate} disabled={mode === "auto" ? !demandeId : !nomClient}>
              Créer la facture
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
