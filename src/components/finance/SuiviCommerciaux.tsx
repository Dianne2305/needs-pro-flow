/**
 * SuiviCommerciaux.tsx
 * Tableau de bord de suivi des commerciaux : KPIs équipe, classement,
 * détail par commercial. Données calculées depuis la table `facturation`.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Facturation, partAgence } from "@/lib/finance-types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Users, Wallet, BadgePercent, Trophy, Table as TableIcon, Filter, X, ArrowLeft, CalendarDays, Download, FileSpreadsheet, FileText } from "lucide-react";

const COMMISSION_COMMERCIAL_PCT = 10; // % de la part agence

const fmt = (n: number) =>
  n.toLocaleString("fr-MA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " DH";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function tauxColor(taux: number) {
  if (taux >= 100) return "bg-emerald-500";
  if (taux >= 80) return "bg-amber-500";
  return "bg-rose-500";
}

function tauxBadge(taux: number) {
  if (taux >= 100) return "bg-emerald-100 text-emerald-700";
  if (taux >= 80) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

type PeriodType = "mois" | "trimestre" | "annee" | "custom";

function getPeriodRange(period: PeriodType, customFrom: string, customTo: string) {
  const now = new Date();
  if (period === "mois") {
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0),
    };
  }
  if (period === "trimestre") {
    const q = Math.floor(now.getMonth() / 3);
    return {
      from: new Date(now.getFullYear(), q * 3, 1),
      to: new Date(now.getFullYear(), q * 3 + 3, 0),
    };
  }
  if (period === "annee") {
    return {
      from: new Date(now.getFullYear(), 0, 1),
      to: new Date(now.getFullYear(), 11, 31),
    };
  }
  return { from: new Date(customFrom), to: new Date(customTo) };
}

const MOIS_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

export default function SuiviCommerciaux() {
  const now = new Date();
  const defaultFrom = toISO(new Date(now.getFullYear(), now.getMonth(), 1));
  const defaultTo = toISO(now);

  const [period, setPeriod] = useState<PeriodType>("mois");
  const [dateFrom, setDateFrom] = useState<string>(defaultFrom);
  const [dateTo, setDateTo] = useState<string>(defaultTo);
  const [commercialFilter, setCommercialFilter] = useState<string>("all");
  const [selectedCommercial, setSelectedCommercial] = useState<string | null>(null);

  const { fromDate, toDate } = useMemo(() => {
    const { from, to } = getPeriodRange(period, dateFrom, dateTo);
    return { fromDate: from, toDate: to };
  }, [period, dateFrom, dateTo]);

  const { data: factus = [], isLoading } = useQuery({
    queryKey: ["facturation-suivi-commerciaux"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("facturation")
        .select("commercial, ville, montant_total, commission_pourcentage, date_intervention, created_at, demande_id");
      if (error) throw error;
      return (data ?? []) as unknown as Facturation[];
    },
  });

  const filterOptions = useMemo(() => {
    const commerciaux = new Set<string>();
    for (const f of factus) {
      const name = (f.commercial || "").trim();
      if (name) commerciaux.add(name);
    }
    return { commerciaux: Array.from(commerciaux).sort() };
  }, [factus]);

  const filteredFactus = useMemo(() => {
    return factus.filter((f) => {
      if (commercialFilter !== "all" && (f.commercial || "").trim() !== commercialFilter) return false;
      return true;
    });
  }, [factus, commercialFilter]);

  const hasActiveFilter =
    commercialFilter !== "all" || period !== "mois" || dateFrom !== defaultFrom || dateTo !== defaultTo;
  const resetFilters = () => {
    setPeriod("mois");
    setDateFrom(defaultFrom);
    setDateTo(defaultTo);
    setCommercialFilter("all");
    setSelectedCommercial(null);
  };

  const agg = useMemo(() => {
    type Row = {
      commercial: string;
      caMois: number;
      dossiersMois: number;
      commissionMois: number;
    };
    const map = new Map<string, Row>();
    const fromMs = fromDate.getTime();
    const toMs = toDate.getTime() + 24 * 60 * 60 * 1000 - 1;
    for (const f of filteredFactus) {
      const name = (f.commercial || "").trim();
      if (!name) continue;
      const d = new Date(f.date_intervention || f.created_at);
      const ts = d.getTime();
      if (ts < fromMs || ts > toMs) continue;
      if (!map.has(name)) {
        map.set(name, { commercial: name, caMois: 0, dossiersMois: 0, commissionMois: 0 });
      }
      const row = map.get(name)!;
      const ca = Number(f.montant_total || 0);
      row.caMois += ca;
      row.dossiersMois += 1;
      row.commissionMois += partAgence(f) * (COMMISSION_COMMERCIAL_PCT / 100);
    }
    const totalCa = Array.from(map.values()).reduce((s, r) => s + r.caMois, 0);
    const rows = Array.from(map.values()).map((r) => ({
      ...r,
      taux: totalCa > 0 ? (r.caMois / totalCa) * 100 : 0,
    }));
    rows.sort((a, b) => b.caMois - a.caMois);
    return rows;
  }, [filteredFactus, fromDate, toDate]);

  const totals = useMemo(() => ({
    caTotal: agg.reduce((s, r) => s + r.caMois, 0),
    commissionTotal: agg.reduce((s, r) => s + r.commissionMois, 0),
  }), [agg]);

  // Détail d'un commercial sélectionné
  const activeCommercial = selectedCommercial || (commercialFilter !== "all" ? commercialFilter : null);

  const detailCommercial = useMemo(() => {
    if (!activeCommercial) return null;
    const fromMs = fromDate.getTime();
    const toMs = toDate.getTime() + 24 * 60 * 60 * 1000 - 1;
    const items = factus.filter((f) => {
      if ((f.commercial || "").trim() !== activeCommercial) return false;
      const ts = new Date(f.date_intervention || f.created_at).getTime();
      return ts >= fromMs && ts <= toMs;
    });

    const byMonth = new Map<string, { key: string; label: string; ca: number; dossiers: number; commission: number; year: number; month: number }>();
    const byQuarter = new Map<string, { key: string; label: string; ca: number; dossiers: number; commission: number }>();
    const byYear = new Map<string, { key: string; label: string; ca: number; dossiers: number; commission: number }>();

    for (const f of items) {
      const d = new Date(f.date_intervention || f.created_at);
      const y = d.getFullYear();
      const m = d.getMonth();
      const q = Math.floor(m / 3) + 1;
      const ca = Number(f.montant_total || 0);
      const com = partAgence(f) * (COMMISSION_COMMERCIAL_PCT / 100);

      const mk = `${y}-${String(m + 1).padStart(2, "0")}`;
      if (!byMonth.has(mk)) byMonth.set(mk, { key: mk, label: `${MOIS_LABELS[m]} ${y}`, ca: 0, dossiers: 0, commission: 0, year: y, month: m });
      const mRow = byMonth.get(mk)!; mRow.ca += ca; mRow.dossiers += 1; mRow.commission += com;

      const qk = `${y}-T${q}`;
      if (!byQuarter.has(qk)) byQuarter.set(qk, { key: qk, label: `T${q} ${y}`, ca: 0, dossiers: 0, commission: 0 });
      const qRow = byQuarter.get(qk)!; qRow.ca += ca; qRow.dossiers += 1; qRow.commission += com;

      const yk = `${y}`;
      if (!byYear.has(yk)) byYear.set(yk, { key: yk, label: `${y}`, ca: 0, dossiers: 0, commission: 0 });
      const yRow = byYear.get(yk)!; yRow.ca += ca; yRow.dossiers += 1; yRow.commission += com;
    }

    const months = Array.from(byMonth.values()).sort((a, b) => a.key.localeCompare(b.key));
    const quarters = Array.from(byQuarter.values()).sort((a, b) => a.key.localeCompare(b.key));
    const years = Array.from(byYear.values()).sort((a, b) => a.key.localeCompare(b.key));

    const totalCa = items.reduce((s, f) => s + Number(f.montant_total || 0), 0);
    const totalDossiers = items.length;
    const totalCommission = items.reduce((s, f) => s + partAgence(f) * (COMMISSION_COMMERCIAL_PCT / 100), 0);
    const moisTravailles = months.length;
    const moyenneMensuelle = moisTravailles > 0 ? totalCa / moisTravailles : 0;

    return { months, quarters, years, totalCa, totalDossiers, totalCommission, moisTravailles, moyenneMensuelle };
  }, [activeCommercial, factus, fromDate, toDate]);

  const periodLabel = period === "mois" ? "Ce_mois" : period === "trimestre" ? "Ce_trimestre" : period === "annee" ? "Cette_annee" : `${dateFrom}_${dateTo}`;

  const exportData = (format: "xlsx" | "csv") => {
    const wb = XLSX.utils.book_new();
    const periodInfo = `${toISO(fromDate)} → ${toISO(toDate)}`;

    if (activeCommercial && detailCommercial) {
      const meta = [
        ["Commercial", activeCommercial],
        ["Période", periodInfo],
        ["Total réalisations (DH)", Math.round(detailCommercial.totalCa)],
        ["Mois travaillés", detailCommercial.moisTravailles],
        ["Moyenne / mois travaillé (DH)", Math.round(detailCommercial.moyenneMensuelle)],
        ["Dossiers", detailCommercial.totalDossiers],
        ["Commission agence (DH)", Math.round(detailCommercial.totalCommission)],
      ];
      const wsMeta = XLSX.utils.aoa_to_sheet(meta);
      XLSX.utils.book_append_sheet(wb, wsMeta, "Synthèse");

      const buildRows = (rows: { label: string; ca: number; dossiers: number; commission: number }[]) => [
        ["Période", "Réalisation (DH)", "Dossiers", "Commission agence (DH)"],
        ...rows.map((r) => [r.label, Math.round(r.ca), r.dossiers, Math.round(r.commission)]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildRows(detailCommercial.months)), "Par mois");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildRows(detailCommercial.quarters)), "Par trimestre");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildRows(detailCommercial.years)), "Par année");
    } else {
      const rows = [
        ["Période", periodInfo],
        [],
        ["Commercial", "CA réalisé (DH)", "Part (%)", "Dossiers", "Commission agence (DH)"],
        ...agg.map((r) => [r.commercial, Math.round(r.caMois), Number(r.taux.toFixed(2)), r.dossiersMois, Math.round(r.commissionMois)]),
        [],
        ["TOTAL", Math.round(totals.caTotal), "", agg.reduce((s, r) => s + r.dossiersMois, 0), Math.round(totals.commissionTotal)],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Commerciaux");
    }

    const baseName = activeCommercial
      ? `Realisations_${activeCommercial.replace(/\s+/g, "_")}_${periodLabel}`
      : `Suivi_Commerciaux_${periodLabel}`;

    if (format === "csv") {
      const ws = wb.Sheets[wb.SheetNames[0]];
      const csv = XLSX.utils.sheet_to_csv(ws, { FS: ";" });
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${baseName}.csv`; a.click();
      URL.revokeObjectURL(url);
    } else {
      XLSX.writeFile(wb, `${baseName}.xlsx`);
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground p-6">Chargement…</div>;
  }


  return (
    <div className="space-y-6">
      {/* Filtres */}
      <div className="flex flex-wrap items-end gap-3 p-4 border rounded-xl bg-card">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mr-2">
          <Filter className="h-4 w-4" /> Filtres
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Période</label>
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="mois">Ce mois</SelectItem>
              <SelectItem value="trimestre">Ce trimestre</SelectItem>
              <SelectItem value="annee">Cette année</SelectItem>
              <SelectItem value="custom">Personnalisé</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {period === "custom" && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Du</label>
              <input
                type="date"
                value={dateFrom}
                max={dateTo}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 px-3 rounded-md border border-input bg-background text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Au</label>
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 px-3 rounded-md border border-input bg-background text-sm"
              />
            </div>
          </>
        )}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Commercial</label>
          <Select value={commercialFilter} onValueChange={(v) => { setCommercialFilter(v); setSelectedCommercial(null); }}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="all">Tous les commerciaux</SelectItem>
              {filterOptions.commerciaux.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {hasActiveFilter && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-muted-foreground">
              <X className="h-4 w-4 mr-1" /> Réinitialiser
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-1" /> Exporter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover z-50">
              <DropdownMenuItem onClick={() => exportData("xlsx")}>
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportData("csv")}>
                <FileText className="h-4 w-4 mr-2" /> CSV (.csv)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {activeCommercial && detailCommercial ? (
        <CommercialDetail
          name={activeCommercial}
          detail={detailCommercial}
          onBack={() => { setSelectedCommercial(null); if (commercialFilter !== "all") setCommercialFilter("all"); }}
        />
      ) : (
        <>
          {/* KPIs globaux */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <KpiCard icon={<Users className="h-4 w-4" />} label="Commerciaux actifs" value={String(agg.length)} />
            <KpiCard icon={<Wallet className="h-4 w-4" />} label="CA total équipe" value={fmt(totals.caTotal)} color="text-emerald-600" />
            <KpiCard icon={<BadgePercent className="h-4 w-4" />} label="Commission agence" value={fmt(totals.commissionTotal)} color="text-emerald-600" />
          </div>

          {/* Classement */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-bold uppercase tracking-wider">Classement</h3>
            </div>
            {agg.length === 0 ? (
              <div className="text-sm text-muted-foreground border rounded-md p-6 text-center bg-card">
                Aucun commercial avec des facturations sur cette période.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {agg.map((r, i) => (
                  <button
                    key={r.commercial}
                    onClick={() => setSelectedCommercial(r.commercial)}
                    className="text-left border rounded-lg p-3 bg-card hover:shadow-md hover:border-primary/40 transition"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">
                          {initials(r.commercial)}
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{r.commercial}</div>
                          <div className="text-xs text-muted-foreground">Commercial</div>
                        </div>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted">
                        {i + 1}{i === 0 ? "er" : "e"}
                      </span>
                    </div>
                    <div className="mt-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Part du CA</span>
                        <span className={`font-bold ${r.taux >= 100 ? "text-emerald-600" : r.taux >= 80 ? "text-amber-600" : "text-rose-600"}`}>
                          {r.taux.toFixed(2).replace(".", ",")}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${tauxColor(r.taux)}`} style={{ width: `${Math.min(100, r.taux)}%` }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t text-xs">
                      <div>
                        <div className="text-muted-foreground">CA</div>
                        <div className="font-bold">{fmt(r.caMois)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Dossiers</div>
                        <div className="font-bold">{r.dossiersMois}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Commission</div>
                        <div className="font-bold text-emerald-600">{fmt(r.commissionMois)}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tableau détaillé */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TableIcon className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold uppercase tracking-wider">Détail par commercial</h3>
            </div>
            <div className="border rounded-lg overflow-x-auto bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-3 py-2">Commercial</th>
                    <th className="text-right px-3 py-2">CA réalisé</th>
                    <th className="text-center px-3 py-2">Taux</th>
                    <th className="text-right px-3 py-2">Dossiers</th>
                    <th className="text-right px-3 py-2">Commission agence</th>
                  </tr>
                </thead>
                <tbody>
                  {agg.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">Aucune donnée</td></tr>
                  ) : agg.map((r) => (
                    <tr key={r.commercial} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <button
                          onClick={() => setSelectedCommercial(r.commercial)}
                          className="flex items-center gap-2 hover:text-primary transition"
                        >
                          <div className="h-7 w-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px]">
                            {initials(r.commercial)}
                          </div>
                          <span className="font-medium underline-offset-2 hover:underline">{r.commercial}</span>
                        </button>
                      </td>
                      <td className="text-right px-3 py-2 tabular-nums font-semibold">{fmt(r.caMois)}</td>
                      <td className="text-center px-3 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${tauxBadge(r.taux)}`}>
                          {r.taux.toFixed(2).replace(".", ",")}%
                        </span>
                      </td>
                      <td className="text-right px-3 py-2 tabular-nums">{r.dossiersMois}</td>
                      <td className="text-right px-3 py-2 tabular-nums text-emerald-600 font-semibold">{fmt(r.commissionMois)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, color = "text-foreground" }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div className="border rounded-xl p-5 bg-card shadow-sm hover:shadow-md transition">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
        <span className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center [&>svg]:h-5 [&>svg]:w-5">
          {icon}
        </span>
        <span className="font-medium">{label}</span>
      </div>
      <div className={`text-3xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

type DetailData = {
  months: { key: string; label: string; ca: number; dossiers: number; commission: number }[];
  quarters: { key: string; label: string; ca: number; dossiers: number; commission: number }[];
  years: { key: string; label: string; ca: number; dossiers: number; commission: number }[];
  totalCa: number;
  totalDossiers: number;
  totalCommission: number;
  moisTravailles: number;
  moyenneMensuelle: number;
};

function CommercialDetail({ name, detail, onBack }: { name: string; detail: DetailData; onBack: () => void }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour
          </Button>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">
              {initials(name)}
            </div>
            <div>
              <div className="font-bold text-base">{name}</div>
              <div className="text-xs text-muted-foreground">Détail des réalisations</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <KpiCard icon={<Wallet className="h-4 w-4" />} label="Total réalisations" value={fmt(detail.totalCa)} color="text-emerald-600" />
        <KpiCard icon={<CalendarDays className="h-4 w-4" />} label="Mois travaillés" value={String(detail.moisTravailles)} />
        <KpiCard icon={<BadgePercent className="h-4 w-4" />} label="Moyenne / mois travaillé" value={fmt(detail.moyenneMensuelle)} color="text-emerald-600" />
        <KpiCard icon={<TableIcon className="h-4 w-4" />} label="Dossiers" value={String(detail.totalDossiers)} />
      </div>

      <DetailTable title="Par mois" rows={detail.months} />
      <DetailTable title="Par trimestre" rows={detail.quarters} />
      <DetailTable title="Par année" rows={detail.years} />
    </div>
  );
}

function DetailTable({ title, rows }: { title: string; rows: { key: string; label: string; ca: number; dossiers: number; commission: number }[] }) {
  const total = rows.reduce((s, r) => s + r.ca, 0);
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <CalendarDays className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold uppercase tracking-wider">{title}</h3>
      </div>
      <div className="border rounded-lg overflow-x-auto bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-3 py-2">Période</th>
              <th className="text-right px-3 py-2">Réalisation</th>
              <th className="text-right px-3 py-2">Dossiers</th>
              <th className="text-right px-3 py-2">Commission agence</th>
              <th className="text-right px-3 py-2">Part</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">Aucune donnée</td></tr>
            ) : rows.map((r) => {
              const part = total > 0 ? (r.ca / total) * 100 : 0;
              return (
                <tr key={r.key} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{r.label}</td>
                  <td className="text-right px-3 py-2 tabular-nums font-semibold">{fmt(r.ca)}</td>
                  <td className="text-right px-3 py-2 tabular-nums">{r.dossiers}</td>
                  <td className="text-right px-3 py-2 tabular-nums text-emerald-600 font-semibold">{fmt(r.commission)}</td>
                  <td className="text-right px-3 py-2 tabular-nums">{part.toFixed(2).replace(".", ",")}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
