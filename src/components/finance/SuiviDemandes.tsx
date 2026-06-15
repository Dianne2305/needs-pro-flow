/**
 * SuiviDemandes.tsx
 * Onglet Suivi des demandes : vue tableau orientée demande/prestation.
 */
import { useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Search, CalendarIcon, X, Download, Check, Minus, Pencil, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Facturation, partAgence, partProfil } from "@/lib/finance-types";

const ENCAISSEMENT_OPTIONS = [
  { value: "en_attente", label: "Paiement en attente", color: "bg-amber-100 text-amber-800" },
  { value: "agence_payee_client", label: "Agence payée/client", color: "bg-sky-100 text-sky-800" },
  { value: "profil_paye_client", label: "Profil payé/client", color: "bg-violet-100 text-violet-800" },
  { value: "partiel", label: "Paiement partiel", color: "bg-orange-100 text-orange-800" },
  { value: "paye", label: "Payé", color: "bg-emerald-100 text-emerald-800" },
  { value: "annulee", label: "Facturation annulée", color: "bg-gray-200 text-gray-700" },
] as const;

type DemandeRow = {
  id: string;
  date_prestation: string | null;
  nom: string | null;
  ville: string | null;
  quartier: string | null;
  type_service: string | null;
  duree_heures: number | null;
  montant_total: number | null;
  montant_verse_client: number | null;
  mode_paiement: string | null;
  commercial: string | null;
  avec_produit: boolean | null;
  services_optionnels: any;
  note_operationnel: string | null;
  note_commercial: string | null;
  candidat_nom: string | null;
  confirmation_ope: string | null;
};

export default function SuiviDemandes() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [editRow, setEditRow] = useState<{ demande: DemandeRow; fact: Facturation | null } | null>(null);
  const [editForm, setEditForm] = useState({ statut_paiement: "en_attente", commentaire: "" });

  const openEdit = (d: DemandeRow, f: Facturation | null) => {
    setEditRow({ demande: d, fact: f });
    setEditForm({
      statut_paiement: f?.statut_paiement || "en_attente",
      commentaire: f?.commentaire || "",
    });
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editRow?.fact) throw new Error("Aucune facturation liée à cette demande");
      const { error } = await supabase
        .from("facturation")
        .update({
          statut_paiement: editForm.statut_paiement,
          commentaire: editForm.commentaire || null,
        })
        .eq("id", editRow.fact.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["facturation"] });
      toast({ title: "Statut mis à jour" });
      setEditRow(null);
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const { data: demandes = [] } = useQuery({
    queryKey: ["demandes", "suivi_demandes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandes")
        .select("id, date_prestation, nom, ville, quartier, type_service, duree_heures, montant_total, montant_verse_client, mode_paiement, commercial, avec_produit, services_optionnels, note_operationnel, note_commercial, candidat_nom, confirmation_ope")
        .order("date_prestation", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data || []) as DemandeRow[];
    },
  });

  const { data: facts = [] } = useQuery({
    queryKey: ["facturation", "suivi_demandes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("facturation")
        .select("*");
      if (error) throw error;
      return (data || []) as unknown as Facturation[];
    },
  });

  const factByDemande = useMemo(() => {
    const m: Record<string, Facturation> = {};
    facts.forEach((f) => { m[f.demande_id] = f; });
    return m;
  }, [facts]);

  const filtered = useMemo(() => {
    return demandes.filter((d) => {
      const f = factByDemande[d.id];
      if (filterStatut !== "all") {
        const s = f?.statut_paiement || "debiteur";
        if (s !== filterStatut) return false;
      }
      if (dateFrom && d.date_prestation) {
        if (parseISO(d.date_prestation) < dateFrom) return false;
      }
      if (dateTo && d.date_prestation) {
        const end = new Date(dateTo); end.setHours(23, 59, 59, 999);
        if (parseISO(d.date_prestation) > end) return false;
      }
      if ((dateFrom || dateTo) && !d.date_prestation) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          d.nom?.toLowerCase().includes(s) ||
          d.ville?.toLowerCase().includes(s) ||
          d.type_service?.toLowerCase().includes(s) ||
          d.candidat_nom?.toLowerCase().includes(s) ||
          d.commercial?.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [demandes, factByDemande, filterStatut, dateFrom, dateTo, search]);

  const fmt = (n: number) => n.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " DH";

  const totals = useMemo(() => {
    let total = 0, acompte = 0, profil = 0, agence = 0;
    filtered.forEach((d) => {
      const f = factByDemande[d.id];
      total += d.montant_total || 0;
      acompte += d.montant_verse_client || 0;
      if (f) { profil += partProfil(f); agence += partAgence(f); }
    });
    return { total, acompte, profil, agence };
  }, [filtered, factByDemande]);

  const hasTorchons = (so: any): boolean => {
    if (!so) return false;
    try {
      const s = JSON.stringify(so).toLowerCase();
      return s.includes("torchon");
    } catch { return false; }
  };

  const getStatutBadge = (s: string) => {
    const opt = ENCAISSEMENT_OPTIONS.find((o) => o.value === s);
    return <Badge className={opt?.color || "bg-gray-100 text-gray-800"}>{opt?.label || "Débiteur"}</Badge>;
  };

  const handleExport = () => {
    const headers = ["Date", "Client", "Ville", "Service", "Nbre heures", "Montant total", "Acompte reçu", "Part Profil", "Part Agence", "Mode paiement", "Commercial", "Statut encaissement", "Option produit", "Option torchons", "Chargé opération", "Profil assigné", "Note"];
    const rows = filtered.map((d) => {
      const f = factByDemande[d.id];
      return [
        d.date_prestation ? format(new Date(d.date_prestation), "dd/MM/yyyy") : "—",
        d.nom || "—",
        [d.ville, d.quartier].filter(Boolean).join(" / "),
        d.type_service || "—",
        d.duree_heures ? String(d.duree_heures) : "—",
        (d.montant_total || 0).toFixed(2),
        (d.montant_verse_client || 0).toFixed(2),
        f ? partProfil(f).toFixed(2) : "—",
        f ? partAgence(f).toFixed(2) : "—",
        d.mode_paiement || "—",
        d.commercial || "—",
        ENCAISSEMENT_OPTIONS.find((o) => o.value === (f?.statut_paiement || "debiteur"))?.label || "Débiteur",
        d.avec_produit ? "Oui" : "Non",
        hasTorchons(d.services_optionnels) ? "Oui" : "Non",
        d.confirmation_ope || "—",
        d.candidat_nom || "—",
        (d.note_operationnel || d.note_commercial || "").replace(/\n/g, " "),
      ];
    });
    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `suivi-demandes-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-t-lg px-6 py-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Suivi des demandes</h2>
          <p className="text-sm text-white/80">Vue détaillée par demande / prestation</p>
        </div>
        <Button onClick={handleExport} variant="outline" className="bg-transparent border-white/40 text-white hover:bg-white/10 gap-1.5">
          <Download className="h-4 w-4" /> Exporter CSV
        </Button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0">
        <div className="bg-amber-700 text-white px-5 py-4">
          <p className="text-2xl font-bold">{fmt(totals.total)}</p>
          <p className="text-xs text-white/80">Montant total</p>
        </div>
        <div className="bg-amber-800 text-white px-5 py-4">
          <p className="text-2xl font-bold">{fmt(totals.acompte)}</p>
          <p className="text-xs text-white/80">Acomptes reçus</p>
        </div>
        <div className="bg-emerald-700 text-white px-5 py-4">
          <p className="text-2xl font-bold">{fmt(totals.profil)}</p>
          <p className="text-xs text-white/80">Total part profil</p>
        </div>
        <div className="bg-sky-700 text-white px-5 py-4 rounded-tr-lg">
          <p className="text-2xl font-bold">{fmt(totals.agence)}</p>
          <p className="text-xs text-white/80">Total part agence</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 px-1 py-5">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher client, ville, profil, commercial..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
              <TableHead className="uppercase text-[11px] tracking-wider font-semibold">Date</TableHead>
              <TableHead className="uppercase text-[11px] tracking-wider font-semibold">Client / Ville</TableHead>
              <TableHead className="uppercase text-[11px] tracking-wider font-semibold">Service</TableHead>
              <TableHead className="uppercase text-[11px] tracking-wider font-semibold text-right">Nbre h</TableHead>
              <TableHead className="uppercase text-[11px] tracking-wider font-semibold text-right">Montant total</TableHead>
              <TableHead className="uppercase text-[11px] tracking-wider font-semibold text-right">Acompte reçu</TableHead>
              <TableHead className="uppercase text-[11px] tracking-wider font-semibold text-right">Part Profil</TableHead>
              <TableHead className="uppercase text-[11px] tracking-wider font-semibold text-right">Part Agence</TableHead>
              <TableHead className="uppercase text-[11px] tracking-wider font-semibold">Mode paiement</TableHead>
              <TableHead className="uppercase text-[11px] tracking-wider font-semibold">Commercial</TableHead>
              <TableHead className="uppercase text-[11px] tracking-wider font-semibold">Statut paiem.</TableHead>
              <TableHead className="uppercase text-[11px] tracking-wider font-semibold text-center">Produit</TableHead>
              <TableHead className="uppercase text-[11px] tracking-wider font-semibold text-center">Torchons</TableHead>
              <TableHead className="uppercase text-[11px] tracking-wider font-semibold">Chargé opé.</TableHead>
              <TableHead className="uppercase text-[11px] tracking-wider font-semibold">Profil assigné</TableHead>
              <TableHead className="uppercase text-[11px] tracking-wider font-semibold">Note</TableHead>
              <TableHead className="uppercase text-[11px] tracking-wider font-semibold text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={17} className="text-center text-muted-foreground py-10">Aucune demande</TableCell>
              </TableRow>
            ) : filtered.map((d) => {
              const f = factByDemande[d.id];
              const note = d.note_operationnel || d.note_commercial || "";
              return (
                <TableRow key={d.id} className="hover:bg-muted/30">
                  <TableCell className="text-sm whitespace-nowrap">
                    {d.date_prestation ? format(new Date(d.date_prestation), "dd/MM/yyyy") : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-sm">{d.nom || "—"}</div>
                    <div className="text-xs text-muted-foreground">{[d.ville, d.quartier].filter(Boolean).join(" / ")}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{d.type_service || "—"}</TableCell>
                  <TableCell className="text-sm text-right">{d.duree_heures || "—"}</TableCell>
                  <TableCell className="text-sm text-right font-bold">{fmt(d.montant_total || 0)}</TableCell>
                  <TableCell className="text-sm text-right text-amber-700 font-semibold">{fmt(d.montant_verse_client || 0)}</TableCell>
                  <TableCell className="text-sm text-right font-semibold text-emerald-700">{f ? fmt(partProfil(f)) : "—"}</TableCell>
                  <TableCell className="text-sm text-right font-semibold text-sky-700">{f ? fmt(partAgence(f)) : "—"}</TableCell>
                  <TableCell className="text-sm">{d.mode_paiement || "—"}</TableCell>
                  <TableCell className="text-sm">{d.commercial || "—"}</TableCell>
                  <TableCell>{getStatutBadge(f?.statut_paiement || "debiteur")}</TableCell>
                  <TableCell className="text-center">
                    {d.avec_produit
                      ? <Check className="h-4 w-4 text-emerald-600 inline" />
                      : <Minus className="h-4 w-4 text-muted-foreground inline" />}
                  </TableCell>
                  <TableCell className="text-center">
                    {hasTorchons(d.services_optionnels)
                      ? <Check className="h-4 w-4 text-emerald-600 inline" />
                      : <Minus className="h-4 w-4 text-muted-foreground inline" />}
                  </TableCell>
                  <TableCell className="text-sm">{d.confirmation_ope || "—"}</TableCell>
                  <TableCell className="text-sm font-medium">{d.candidat_nom || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={note}>{note || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => openEdit(d, f || null)}
                      title={f ? "Modifier le statut paiement" : "Aucune facturation liée"}
                      disabled={!f}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier le statut de paiement</DialogTitle>
          </DialogHeader>
          {editRow && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {editRow.demande.nom || "—"} · {editRow.demande.type_service || "—"} · {editRow.demande.date_prestation ? format(new Date(editRow.demande.date_prestation), "dd/MM/yyyy") : ""}
              </div>
              <div className="space-y-2">
                <Label>Statut paiement</Label>
                <Select value={editForm.statut_paiement} onValueChange={(v) => setEditForm((f) => ({ ...f, statut_paiement: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENCAISSEMENT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Remarque</Label>
                <Textarea rows={3} value={editForm.commentaire} onChange={(e) => setEditForm((f) => ({ ...f, commentaire: e.target.value }))} placeholder="Note interne…" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Annuler</Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
