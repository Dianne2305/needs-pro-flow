/**
 * SuiviDusProfils.tsx
 * Onglet Suivi des dus Agence-Profils : tableau détaillé par mission (FDM)
 * avec taux horaire, parts, statut d'encaissement et règlement FDM.
 */
import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Search, CalendarIcon, X, Download, Wallet, Pencil, Eye } from "lucide-react";
import { Facturation, partAgence, partProfil } from "@/lib/finance-types";
import { useNavigate } from "react-router-dom";

const getEncaissementDC = (m: Facturation): { label: string; className: string } | null => {
  if (m.part_profil_versee) return null;
  const s = m.statut_paiement;
  if (s === "agence_payee_client" || s === "paye") {
    return { label: "Débiteur", className: "bg-rose-100 text-rose-800" };
  }
  if (s === "profil_paye_client") {
    return { label: "Créditeur", className: "bg-emerald-100 text-emerald-800" };
  }
  return null;
};

const getTauxStandard = (typeService: string | null | undefined, heures: number): { value: number | null; forfait: boolean } => {
  const t = (typeService || "").toLowerCase();
  if (t.includes("auxiliaire") || t.includes("placement")) return { value: null, forfait: true };
  if (t.includes("airbnb")) return { value: heures > 2 ? 30 : 40, forfait: false };
  if (t.includes("standard") || t.includes("bureau")) return { value: 30, forfait: false };
  if (t.includes("grand") || t.includes("chantier") || t.includes("sinistre")) return { value: 40, forfait: false };
  return { value: null, forfait: false };
};

const ENCAISSEMENT_OPTIONS = [
  { value: "en_attente", label: "Paiement en attente", color: "bg-amber-100 text-amber-800" },
  { value: "agence_payee_client", label: "Agence payée/client", color: "bg-sky-100 text-sky-800" },
  { value: "profil_paye_client", label: "Profil payé/client", color: "bg-violet-100 text-violet-800" },
  { value: "partiel", label: "Paiement partiel", color: "bg-orange-100 text-orange-800" },
  { value: "paye", label: "Payé", color: "bg-emerald-100 text-emerald-800" },
  { value: "annulee", label: "Facturation annulée", color: "bg-gray-200 text-gray-700" },
] as const;
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

const FREQ_LABEL: Record<string, string> = {
  "ponctuel": "Ponctuel",
  "hebdomadaire": "Hebdomadaire",
  "bi-hebdomadaire": "Bi-hebdomadaire",
  "mensuel": "Mensuel",
  "abonnement": "Abonnement",
};

export default function SuiviDusProfils() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("all");
  const [filterReglement, setFilterReglement] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [editMission, setEditMission] = useState<Facturation | null>(null);
  const [viewMission, setViewMission] = useState<Facturation | null>(null);
  const [editForm, setEditForm] = useState({
    statut_paiement: "",
    part_profil_versee: false,
    date_versement_profil: "" as string | "",
    commentaire: "",
  });

  useEffect(() => {
    if (editMission) {
      setEditForm({
        statut_paiement: editMission.statut_paiement || "debiteur",
        part_profil_versee: !!editMission.part_profil_versee,
        date_versement_profil: editMission.date_versement_profil || "",
        commentaire: editMission.commentaire || "",
      });
    }
  }, [editMission]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editMission) return;
      const { error } = await supabase
        .from("facturation")
        .update({
          statut_paiement: editForm.statut_paiement,
          part_profil_versee: editForm.part_profil_versee,
          date_versement_profil: editForm.part_profil_versee
            ? (editForm.date_versement_profil || new Date().toISOString().slice(0, 10))
            : null,
          commentaire: editForm.commentaire || null,
        })
        .eq("id", editMission.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["facturation"] });
      toast({ title: "Mission mise à jour" });
      setEditMission(null);
    },
    onError: () => toast({ title: "Erreur lors de la mise à jour", variant: "destructive" }),
  });

  const { data: missions = [] } = useQuery({
    queryKey: ["facturation", "dus_profils"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("facturation")
        .select("*")
        .order("date_intervention", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Facturation[];
    },
  });

  const { data: demandesMap = {} } = useQuery({
    queryKey: ["demandes", "for_dus_profils"],
    queryFn: async () => {
      const { data } = await supabase
        .from("demandes")
        .select("id, duree_heures, frequence, nombre_intervenants");
      const map: Record<string, { duree_heures: number | null; frequence: string | null; nombre_intervenants: number | null }> = {};
      (data || []).forEach((d: any) => {
        map[d.id] = { duree_heures: d.duree_heures, frequence: d.frequence, nombre_intervenants: d.nombre_intervenants };
      });
      return map;
    },
  });

  // Only Femme de ménage (FDM)
  const fdmMissions = useMemo(() => {
    return missions.filter((m) => {
      const t = (m as any).profil_type || m.type_service || "";
      const ts = (m.type_service || "").toLowerCase();
      // Heuristique : exclure explicitement garde malade/auxiliaire
      if (ts.includes("garde") || ts.includes("auxiliaire")) return false;
      return true;
    });
  }, [missions]);

  const filtered = useMemo(() => {
    return fdmMissions.filter((m) => {
      if (filterStatut !== "all" && m.statut_paiement !== filterStatut) return false;
      if (filterReglement === "regle" && !m.part_profil_versee) return false;
      if (filterReglement === "non_regle" && m.part_profil_versee) return false;
      if (dateFrom && m.date_intervention) {
        if (parseISO(m.date_intervention) < dateFrom) return false;
      }
      if (dateTo && m.date_intervention) {
        const end = new Date(dateTo); end.setHours(23, 59, 59, 999);
        if (parseISO(m.date_intervention) > end) return false;
      }
      if ((dateFrom || dateTo) && !m.date_intervention) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          m.profil_nom?.toLowerCase().includes(s) ||
          m.nom_client?.toLowerCase().includes(s) ||
          m.ville?.toLowerCase().includes(s) ||
          m.type_service?.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [fdmMissions, filterStatut, filterReglement, dateFrom, dateTo, search]);

  const fmt = (n: number) => n.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " DH";

  const totals = useMemo(() => {
    let ca = 0, profil = 0, agence = 0, reglé = 0, dû = 0;
    filtered.forEach((m) => {
      const pa = partAgence(m); const pp = partProfil(m);
      ca += m.montant_total || 0;
      profil += pp;
      agence += pa;
      if (m.part_profil_versee) reglé += pp;
      else dû += pp;
    });
    return { ca, profil, agence, reglé, dû };
  }, [filtered]);

  const getStatutBadge = (s: string) => {
    const opt = ENCAISSEMENT_OPTIONS.find((o) => o.value === s);
    return <Badge className={opt?.color || "bg-gray-100 text-gray-800"}>{opt?.label || s}</Badge>;
  };

  const handleExport = () => {
    const headers = ["Date prestation", "Profil (FDM)", "Client", "Ville", "Type service", "Nbre heures", "Taux horaire", "Part profil", "Statut encaissement", "Règlement FDM", "Part agence", "CA", "Remarque", "Fréquence"];
    const rows = filtered.map((m) => {
      const dem = demandesMap[m.demande_id];
      const heures = dem?.duree_heures || 0;
      const taux = heures > 0 ? m.montant_total / heures : 0;
      return [
        m.date_intervention ? format(new Date(m.date_intervention), "dd/MM/yyyy") : "—",
        m.profil_nom || "—",
        m.nom_client || "—",
        m.ville || "—",
        m.type_service || "—",
        heures ? String(heures) : "—",
        taux.toFixed(2),
        partProfil(m).toFixed(2),
        ENCAISSEMENT_OPTIONS.find((o) => o.value === m.statut_paiement)?.label || m.statut_paiement,
        m.part_profil_versee ? "Réglé" : "Non réglé",
        partAgence(m).toFixed(2),
        (m.montant_total || 0).toFixed(2),
        m.commentaire || "",
        dem?.frequence ? (FREQ_LABEL[dem.frequence] || dem.frequence) : "—",
      ];
    });
    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `suivi-dus-profils-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="bg-[hsl(220,40%,20%)] text-white rounded-t-lg px-6 py-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Suivi des dus Agence ↔ Profils</h2>
          <p className="text-sm text-white/70">Détail par mission FDM : parts, encaissement et règlement</p>
        </div>
        <Button onClick={handleExport} variant="outline" className="bg-transparent border-white/30 text-white hover:bg-white/10 gap-1.5">
          <Download className="h-4 w-4" /> Exporter CSV
        </Button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-0">
        <div className="bg-[hsl(220,35%,28%)] text-white px-5 py-4">
          <p className="text-2xl font-bold">{fmt(totals.ca)}</p>
          <p className="text-xs text-white/60">CA total</p>
        </div>
        <div className="bg-[hsl(220,35%,26%)] text-white px-5 py-4">
          <p className="text-2xl font-bold">{fmt(totals.agence)}</p>
          <p className="text-xs text-white/60">Part agence</p>
        </div>
        <div className="bg-[hsl(220,35%,24%)] text-white px-5 py-4">
          <p className="text-2xl font-bold">{fmt(totals.profil)}</p>
          <p className="text-xs text-white/60">Part profils</p>
        </div>
        <div className="bg-emerald-700 text-white px-5 py-4">
          <p className="text-2xl font-bold">{fmt(totals.reglé)}</p>
          <p className="text-xs text-white/80">Réglé aux profils</p>
        </div>
        <div className="bg-rose-700 text-white px-5 py-4 rounded-tr-lg">
          <p className="text-2xl font-bold">{fmt(totals.dû)}</p>
          <p className="text-xs text-white/80">Dû aux profils</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 px-1 py-5">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher profil, client, ville..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <Select value={filterStatut} onValueChange={setFilterStatut}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Statut encaissement" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {ENCAISSEMENT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterReglement} onValueChange={setFilterReglement}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Règlement FDM" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="regle">Réglé</SelectItem>
                <SelectItem value="non_regle">Non réglé</SelectItem>
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
      <div className="rounded-b-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b-2">
              <TableHead className="uppercase text-[11px] tracking-wider font-semibold">Date prestation</TableHead>
              <TableHead className="uppercase text-[11px] tracking-wider font-semibold">Profil (FDM)</TableHead>
              <TableHead className="uppercase text-[11px] tracking-wider font-semibold">Client / Ville</TableHead>
              <TableHead className="uppercase text-[11px] tracking-wider font-semibold">Type de service</TableHead>
              <TableHead className="uppercase text-[11px] tracking-wider font-semibold text-right">Nbre h</TableHead>
              <TableHead className="uppercase text-[11px] tracking-wider font-semibold text-right">Taux horaire</TableHead>
              <TableHead className="uppercase text-[11px] tracking-wider font-semibold text-right">Part profil</TableHead>
              <TableHead className="uppercase text-[11px] tracking-wider font-semibold text-right">Part agence</TableHead>
              <TableHead className="uppercase text-[11px] tracking-wider font-semibold text-right">CA</TableHead>
              <TableHead className="uppercase text-[11px] tracking-wider font-semibold">Statut paiem.</TableHead>
              <TableHead className="uppercase text-[11px] tracking-wider font-semibold">Statut encais.</TableHead>
              <TableHead className="uppercase text-[11px] tracking-wider font-semibold">Règlement FDM</TableHead>
              <TableHead className="uppercase text-[11px] tracking-wider font-semibold">Remarque</TableHead>
              <TableHead className="uppercase text-[11px] tracking-wider font-semibold">Fréquence</TableHead>
              <TableHead className="uppercase text-[11px] tracking-wider font-semibold text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={15} className="text-center text-muted-foreground py-10">Aucune mission</TableCell>
              </TableRow>
            ) : filtered.map((m) => {
              const dem = demandesMap[m.demande_id];
              const heures = dem?.duree_heures || 0;
              const taux = heures > 0 ? m.montant_total / heures : 0;
              const pp = partProfil(m);
              const pa = partAgence(m);
              return (
                <TableRow key={m.id} className="hover:bg-muted/30">
                  <TableCell className="text-sm whitespace-nowrap">
                    {m.date_intervention ? format(new Date(m.date_intervention), "dd/MM/yyyy") : "—"}
                  </TableCell>
                  <TableCell className="text-sm font-medium">{m.profil_nom || "—"}</TableCell>
                  <TableCell>
                    <div className="font-semibold text-sm">{m.nom_client}</div>
                    <div className="text-xs text-muted-foreground">{m.ville || ""}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.type_service || "—"}</TableCell>
                  <TableCell className="text-sm text-right">{heures || "—"}</TableCell>
                  <TableCell className="text-sm text-right">
                    {(() => {
                      const std = getTauxStandard(m.type_service, heures);
                      if (std.forfait) return <span className="text-xs text-muted-foreground italic">Forfait</span>;
                      if (std.value != null) return `${std.value} DH/h`;
                      return taux > 0 ? fmt(taux) : "—";
                    })()}
                  </TableCell>
                  <TableCell className="text-sm text-right font-semibold text-emerald-700">{fmt(pp)}</TableCell>
                  <TableCell className="text-sm text-right font-semibold text-sky-700">{fmt(pa)}</TableCell>
                  <TableCell className="text-sm text-right font-bold">{fmt(m.montant_total || 0)}</TableCell>
                  <TableCell>{getStatutBadge(m.statut_paiement)}</TableCell>
                  <TableCell>
                    {(() => {
                      const dc = getEncaissementDC(m);
                      return dc ? <Badge className={dc.className}>{dc.label}</Badge> : <span className="text-xs text-muted-foreground">—</span>;
                    })()}
                  </TableCell>
                  <TableCell>
                    {m.part_profil_versee ? (
                      <Badge className="bg-emerald-100 text-emerald-800 gap-1"><Wallet className="h-3 w-3" /> Réglé{m.date_versement_profil ? ` · ${format(new Date(m.date_versement_profil), "dd/MM")}` : ""}</Badge>
                    ) : (
                      <Badge className="bg-rose-100 text-rose-800">Non réglé</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate" title={m.commentaire || ""}>{m.commentaire || "—"}</TableCell>
                  <TableCell className="text-sm">
                    {dem?.frequence ? (
                      <Badge variant="outline" className="text-xs">{FREQ_LABEL[dem.frequence] || dem.frequence}</Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setEditMission(m)} title="Modifier">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => navigate(`/compte-client?id=${m.demande_id}&from=/gestion-financiere/suivi-dus`)}
                        title="Voir le compte client"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Edit modal */}
      <Dialog open={!!editMission} onOpenChange={(o) => !o && setEditMission(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier la mission</DialogTitle>
          </DialogHeader>
          {editMission && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {editMission.profil_nom || "—"} · {editMission.nom_client} · {editMission.date_intervention ? format(new Date(editMission.date_intervention), "dd/MM/yyyy") : ""}
              </div>


              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label className="text-sm font-medium">Règlement FDM</Label>
                  <p className="text-xs text-muted-foreground">Part profil versée à la FDM</p>
                </div>
                <Switch checked={editForm.part_profil_versee} onCheckedChange={(c) => setEditForm((f) => ({ ...f, part_profil_versee: c }))} />
              </div>

              {editForm.part_profil_versee && (
                <div className="space-y-2">
                  <Label>Date de règlement</Label>
                  <Input type="date" value={editForm.date_versement_profil || ""} onChange={(e) => setEditForm((f) => ({ ...f, date_versement_profil: e.target.value }))} />
                </div>
              )}

              <div className="space-y-2">
                <Label>Remarque</Label>
                <Textarea rows={3} value={editForm.commentaire} onChange={(e) => setEditForm((f) => ({ ...f, commentaire: e.target.value }))} placeholder="Note interne…" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMission(null)}>Annuler</Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
