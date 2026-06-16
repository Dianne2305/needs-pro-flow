/**
 * TresorerieTab.tsx
 * Onglet Trésorerie : tableau unifié (entrées auto depuis facturation payée + entrées/sorties manuelles).
 */
import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Pencil, Trash2, Check, X, Search, FileDown, FileSpreadsheet, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Facturation, partAgence } from "@/lib/finance-types";
import { LineChart, Line, ResponsiveContainer, Tooltip as RTooltip } from "recharts";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const TRESORERIE_CATEGORIES = [
  { value: "encaissement_client", label: "Encaissement client (auto)", type: "entree" as const, auto: true },
  { value: "remise_fm", label: "Remise FM — espèces", type: "entree" as const },
  { value: "depot_commercial", label: "Dépôt commercial — espèces", type: "entree" as const },
  { value: "virement_client", label: "Virement client reçu", type: "entree" as const },
  { value: "autre_entree", label: "Autre entrée", type: "entree" as const },
  { value: "salaires_agence", label: "Salaires (équipe agence)", type: "sortie" as const },
  { value: "paiement_fdm", label: "Paiement femmes de ménage", type: "sortie" as const },
  { value: "achat_produits", label: "Achat produits ménagers", type: "sortie" as const },
  { value: "achat_materiel", label: "Achat matériel / équipement", type: "sortie" as const },
  { value: "loyer_charges", label: "Loyer & charges bureaux", type: "sortie" as const },
  { value: "publicite_marketing", label: "Publicité & Marketing", type: "sortie" as const },
];

const catLabel = (v: string) => TRESORERIE_CATEGORIES.find((c) => c.value === v)?.label || v;

const fmt = (n: number) => (n || 0).toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " DH";

interface Row {
  id: string;
  date: string;
  libelle: string;
  categorie: string;
  montant: number;
  type: "entree" | "sortie";
  saisi_par: string | null;
  notes: string | null;
  auto: boolean;
}

export default function TresorerieTab() {
  const qc = useQueryClient();
  const [editSolde, setEditSolde] = useState(false);
  const [soldeInput, setSoldeInput] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "entree" | "sortie">("all");
  const [saisiParFilter, setSaisiParFilter] = useState<string>("all");
  const [form, setForm] = useState({
    date_operation: format(new Date(), "yyyy-MM-dd"),
    libelle: "",
    categorie: "",
    montant: "",
    type_operation: "entree" as "entree" | "sortie",
    utilisateur: "",
    notes: "",
  });

  const { data: config } = useQuery({
    queryKey: ["tresorerie_config"],
    queryFn: async () => {
      const { data } = await supabase.from("tresorerie_config" as any).select("*").eq("id", 1).maybeSingle();
      return (data as any) || { solde_initial: 0 };
    },
  });

  const { data: ops = [] } = useQuery({
    queryKey: ["operations_caisse", "tresorerie"],
    queryFn: async () => {
      const { data } = await supabase.from("operations_caisse").select("*").order("date_operation", { ascending: true });
      return data || [];
    },
  });

  const { data: missionsAll = [] } = useQuery({
    queryKey: ["facturation", "tresorerie_all"],
    queryFn: async () => {
      const { data } = await supabase.from("facturation").select("*");
      return (data || []) as unknown as Facturation[];
    },
  });

  const encaissementsAuto = useMemo(
    () => missionsAll.filter((m: any) => m.statut_paiement === "paye" && Number(m.montant_paye_client) > 0),
    [missionsAll]
  );

  const caTotals = useMemo(() => {
    let ca = 0, partAg = 0;
    missionsAll.forEach((m) => {
      if ((m as any).statut_mission === "facturation_annulee") return;
      ca += Number((m as any).montant_total) || 0;
      partAg += partAgence(m);
    });
    return { ca, partAg };
  }, [missionsAll]);

  const rows: Row[] = useMemo(() => {
    const manual: Row[] = (ops as any[]).map((o) => ({
      id: o.id,
      date: o.date_operation,
      libelle: o.libelle,
      categorie: o.categorie || "",
      montant: Number(o.montant) || 0,
      type: o.type_operation,
      saisi_par: o.utilisateur,
      notes: o.notes,
      auto: false,
    }));
    const auto: Row[] = (encaissementsAuto as any[]).map((f) => ({
      id: `auto-${f.id}`,
      date: f.date_intervention || new Date().toISOString().slice(0, 10),
      libelle: `Encaissement — ${f.nom_client || "Client"}`,
      categorie: "encaissement_client",
      montant: Number(f.montant_paye_client) || 0,
      type: "entree",
      saisi_par: "Système",
      notes: "Auto depuis Suivi des demandes",
      auto: true,
    }));
    return [...auto, ...manual].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }, [ops, encaissementsAuto]);

  const saisiParOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => { if (r.saisi_par) set.add(r.saisi_par); });
    return Array.from(set).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (saisiParFilter !== "all" && (r.saisi_par || "") !== saisiParFilter) return false;
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;
      if (q) {
        const hay = `${r.libelle} ${catLabel(r.categorie)} ${r.saisi_par || ""} ${r.notes || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, typeFilter, saisiParFilter, dateFrom, dateTo]);

  const totals = useMemo(() => {
    let entrees = 0, sorties = 0;
    filteredRows.forEach((r) => (r.type === "entree" ? (entrees += r.montant) : (sorties += r.montant)));
    const solde = (Number(config?.solde_initial) || 0) + entrees - sorties;
    return { entrees, sorties, solde };
  }, [filteredRows, config]);

  const soldeSeries = useMemo(() => {
    let running = Number(config?.solde_initial) || 0;
    const byDate = new Map<string, number>();
    filteredRows.forEach((r) => {
      running += r.type === "entree" ? r.montant : -r.montant;
      byDate.set(r.date, running);
    });
    return Array.from(byDate.entries()).map(([date, solde]) => ({ date, solde }));
  }, [filteredRows, config]);

  const exportExcel = () => {
    const data = filteredRows.map((r, i) => ({
      "N°": i + 1,
      Date: r.date ? format(new Date(r.date), "dd/MM/yyyy") : "",
      Catégorie: catLabel(r.categorie),
      "Montant (DH)": (r.type === "entree" ? 1 : -1) * r.montant,
      Type: r.type === "entree" ? "Entrée" : "Sortie",
      "Saisi par": r.saisi_par || "",
      Notes: r.notes || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Trésorerie");
    XLSX.writeFile(wb, `tresorerie_${format(new Date(), "yyyyMMdd")}.xlsx`);
    toast.success("Export Excel généré");
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Trésorerie — Mouvements", 14, 14);
    doc.setFontSize(9);
    doc.text(`Entrées: ${fmt(totals.entrees)}  |  Sorties: ${fmt(totals.sorties)}  |  Solde: ${fmt(totals.solde)}`, 14, 21);
    autoTable(doc, {
      startY: 26,
      head: [["N°", "Date", "Catégorie", "Montant", "Type", "Saisi par", "Notes"]],
      body: filteredRows.map((r, i) => [
        i + 1,
        r.date ? format(new Date(r.date), "dd/MM/yyyy") : "",
        catLabel(r.categorie),
        (r.type === "entree" ? "+" : "−") + fmt(r.montant),
        r.type === "entree" ? "Entrée" : "Sortie",
        r.saisi_par || "",
        r.notes || "",
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 50, 80] },
    });
    doc.save(`tresorerie_${format(new Date(), "yyyyMMdd")}.pdf`);
    toast.success("Export PDF généré");
  };

  const soldeMutation = useMutation({
    mutationFn: async (val: number) => {
      const { error } = await supabase
        .from("tresorerie_config" as any)
        .update({ solde_initial: val, date_solde_initial: new Date().toISOString().slice(0, 10), updated_at: new Date().toISOString() })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tresorerie_config"] });
      toast.success("Solde initial enregistré");
      setEditSolde(false);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        date_operation: form.date_operation,
        libelle: form.libelle,
        categorie: form.categorie,
        montant: Number(form.montant) || 0,
        type_operation: form.type_operation,
        mode_paiement: "especes",
        utilisateur: form.utilisateur || null,
        notes: form.notes || null,
      };
      if (editing) {
        const { error } = await supabase.from("operations_caisse").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("operations_caisse").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operations_caisse"] });
      toast.success(editing ? "Mouvement modifié" : "Mouvement ajouté");
      setModalOpen(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("operations_caisse").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operations_caisse"] });
      toast.success("Mouvement supprimé");
    },
  });

  const openAdd = () => {
    setEditing(null);
    setForm({
      date_operation: format(new Date(), "yyyy-MM-dd"),
      libelle: "",
      categorie: "",
      montant: "",
      type_operation: "entree",
      utilisateur: "",
      notes: "",
    });
    setModalOpen(true);
  };

  const openEdit = (r: Row) => {
    if (r.auto) return;
    const op = (ops as any[]).find((o) => o.id === r.id);
    if (!op) return;
    setEditing(op);
    setForm({
      date_operation: op.date_operation,
      libelle: op.libelle || "",
      categorie: op.categorie || "",
      montant: String(op.montant || ""),
      type_operation: op.type_operation,
      utilisateur: op.utilisateur || "",
      notes: op.notes || "",
    });
    setModalOpen(true);
  };

  const handleCategorieChange = (v: string) => {
    const cat = TRESORERIE_CATEGORIES.find((c) => c.value === v);
    setForm((f) => ({ ...f, categorie: v, type_operation: cat?.type || f.type_operation }));
  };

  useEffect(() => {
    if (editSolde) setSoldeInput(String(config?.solde_initial || 0));
  }, [editSolde, config]);

  return (
    <div className="space-y-4">
      {/* KPI bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="rounded-lg border bg-cyan-50 p-4">
          <p className="text-xs uppercase tracking-wider text-cyan-700">CA total</p>
          <p className="text-xl font-bold mt-1 text-cyan-800">{fmt(caTotals.ca)}</p>
        </div>
        <div className="rounded-lg border bg-amber-50 p-4">
          <p className="text-xs uppercase tracking-wider text-amber-700">Part de l'agence</p>
          <p className="text-xl font-bold mt-1 text-amber-800">{fmt(caTotals.partAg)}</p>
        </div>
        <div className="rounded-lg border bg-emerald-50 p-4">
          <p className="text-xs uppercase tracking-wider text-emerald-700">Total entrées</p>
          <p className="text-xl font-bold mt-1 text-emerald-700">{fmt(totals.entrees)}</p>
        </div>
        <div className="rounded-lg border bg-rose-50 p-4">
          <p className="text-xs uppercase tracking-wider text-rose-700">Total sorties</p>
          <p className="text-xl font-bold mt-1 text-rose-700">{fmt(totals.sorties)}</p>
        </div>
        <div className="rounded-lg border bg-[hsl(220,40%,20%)] text-white p-4 relative overflow-hidden">
          <p className="text-xs uppercase tracking-wider text-white/70">Solde net</p>
          <p className={`text-xl font-bold mt-1 ${totals.solde >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{fmt(totals.solde)}</p>
          {soldeSeries.length > 1 && (
            <div className="h-10 mt-1 -mx-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={soldeSeries}>
                  <Line
                    type="monotone"
                    dataKey="solde"
                    stroke={totals.solde >= 0 ? "#6ee7b7" : "#fda4af"}
                    strokeWidth={1.8}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <RTooltip
                    contentStyle={{ background: "#0f172a", border: "1px solid #334155", fontSize: 11, color: "#fff" }}
                    labelFormatter={(l) => (l ? format(new Date(l as string), "dd/MM/yyyy") : "")}
                    formatter={(v: any) => [fmt(Number(v)), "Solde"]}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        <div className="space-y-1">
          <Label className="text-xs">Du</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-[150px]" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Au</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-[150px]" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select value={typeFilter} onValueChange={(v: "all" | "entree" | "sortie") => setTypeFilter(v)}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="entree">Entrée</SelectItem>
              <SelectItem value="sortie">Sortie</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Saisi par</Label>
          <Select value={saisiParFilter} onValueChange={setSaisiParFilter}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              {saisiParOptions.map((u) => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex-1 min-w-[200px]">
          <Label className="text-xs">Recherche</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Libellé, catégorie, notes…"
              className="h-9 pl-8"
            />
          </div>
        </div>
        {(dateFrom || dateTo || search || typeFilter !== "all" || saisiParFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setDateFrom(""); setDateTo(""); setSearch(""); setTypeFilter("all"); setSaisiParFilter("all"); }}
          >
            <X className="h-3.5 w-3.5 mr-1" /> Réinitialiser
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={exportExcel} className="gap-1.5 h-9">
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF} className="gap-1.5 h-9">
            <FileDown className="h-4 w-4" /> PDF
          </Button>
          <Button onClick={openAdd} className="gap-1.5 h-9">
            <Plus className="h-4 w-4" /> Ajouter un mouvement
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-[hsl(220,40%,20%)] hover:bg-[hsl(220,40%,20%)]">
              <TableHead className="text-white uppercase text-[11px]">N°</TableHead>
              <TableHead className="text-white uppercase text-[11px]">Date</TableHead>
              <TableHead className="text-white uppercase text-[11px]">Catégorie</TableHead>
              <TableHead className="text-white uppercase text-[11px] text-right">Montant (DH)</TableHead>
              <TableHead className="text-white uppercase text-[11px]">Type</TableHead>
              <TableHead className="text-white uppercase text-[11px]">Saisi par</TableHead>
              <TableHead className="text-white uppercase text-[11px]">Notes</TableHead>
              <TableHead className="text-white uppercase text-[11px] text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Aucun mouvement</TableCell>
              </TableRow>
            ) : filteredRows.map((r, i) => (
              <TableRow key={r.id} className={r.auto ? "bg-sky-50/40" : ""}>
                <TableCell className="text-sm tabular-nums">{i + 1}</TableCell>
                <TableCell className="text-sm whitespace-nowrap">{r.date ? format(new Date(r.date), "dd/MM/yyyy") : "—"}</TableCell>
                <TableCell className="text-sm">{catLabel(r.categorie)}</TableCell>
                <TableCell className={`text-sm text-right font-semibold tabular-nums ${r.type === "entree" ? "text-emerald-700" : "text-rose-700"}`}>
                  {r.type === "entree" ? "+" : "−"}{fmt(r.montant)}
                </TableCell>
                <TableCell>
                  <Badge className={r.type === "entree" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}>
                    {r.type === "entree" ? "Entrée" : "Sortie"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.saisi_par || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate" title={r.notes || ""}>{r.notes || "—"}</TableCell>
                <TableCell className="text-right">
                  {r.auto ? (
                    <Badge variant="outline" className="text-[10px]">Auto</Badge>
                  ) : (
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => {
                          if (confirm("Supprimer ce mouvement ?")) deleteMutation.mutate(r.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le mouvement" : "Ajouter un mouvement"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={form.date_operation} onChange={(e) => setForm((f) => ({ ...f, date_operation: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Montant (DH)</Label>
                <Input type="number" value={form.montant} onChange={(e) => setForm((f) => ({ ...f, montant: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type de mouvement</Label>
                <Select value={form.type_operation} onValueChange={(v: "entree" | "sortie") => setForm((f) => ({ ...f, type_operation: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entree">Entrée</SelectItem>
                    <SelectItem value="sortie">Sortie</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Catégorie</Label>
                <Select value={form.categorie} onValueChange={handleCategorieChange}>
                  <SelectTrigger><SelectValue placeholder="Choisir une catégorie" /></SelectTrigger>
                  <SelectContent>
                    {TRESORERIE_CATEGORIES.filter((c) => !c.auto && c.type === form.type_operation).map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Libellé / Description</Label>
              <Input value={form.libelle} onChange={(e) => setForm((f) => ({ ...f, libelle: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Saisi par</Label>
              <Input value={form.utilisateur} onChange={(e) => setForm((f) => ({ ...f, utilisateur: e.target.value }))} placeholder="Nom de l'utilisateur" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.libelle || !form.categorie || !form.montant || saveMutation.isPending}>
              {saveMutation.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
