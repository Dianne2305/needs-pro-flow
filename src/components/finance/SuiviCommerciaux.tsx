/**
 * SuiviCommerciaux.tsx
 * Tableau de bord de suivi des commerciaux : KPIs équipe, classement du mois,
 * détail par commercial et graphique CA vs Objectif.
 * Données calculées depuis la table `facturation` (champ `commercial`).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Facturation, partAgence } from "@/lib/finance-types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Users, Wallet, Target, Percent, BadgePercent, Trophy, Table as TableIcon, TrendingUp, TrendingDown, Filter, X } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const OBJECTIF_PAR_COMMERCIAL = 15000; // DH / mois
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
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default function SuiviCommerciaux() {
  const now = new Date();
  const defaultFrom = toISO(startOfMonth(now));
  const defaultTo = toISO(now);

  const [dateFrom, setDateFrom] = useState<string>(defaultFrom);
  const [dateTo, setDateTo] = useState<string>(defaultTo);
  const [commercialFilter, setCommercialFilter] = useState<string>("all");
  const [villeFilter, setVilleFilter] = useState<string>("all");

  // Période précédente de même durée pour calcul de tendance
  const { fromDate, toDate, prevFromDate, prevToDate } = useMemo(() => {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    const spanMs = to.getTime() - from.getTime();
    const prevTo = new Date(from.getTime() - 24 * 60 * 60 * 1000);
    const prevFrom = new Date(prevTo.getTime() - spanMs);
    return { fromDate: from, toDate: to, prevFromDate: prevFrom, prevToDate: prevTo };
  }, [dateFrom, dateTo]);

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
    const villes = new Set<string>();
    for (const f of factus) {
      const name = (f.commercial || "").trim();
      if (name) commerciaux.add(name);
      if (f.ville) villes.add(f.ville);
    }
    return {
      commerciaux: Array.from(commerciaux).sort(),
      villes: Array.from(villes).sort(),
    };
  }, [factus]);

  const filteredFactus = useMemo(() => {
    return factus.filter((f) => {
      if (commercialFilter !== "all" && (f.commercial || "").trim() !== commercialFilter) return false;
      if (villeFilter !== "all" && f.ville !== villeFilter) return false;
      return true;
    });
  }, [factus, commercialFilter, villeFilter]);

  const hasActiveFilter =
    commercialFilter !== "all" || villeFilter !== "all" || dateFrom !== defaultFrom || dateTo !== defaultTo;
  const resetFilters = () => {
    setDateFrom(defaultFrom);
    setDateTo(defaultTo);
    setCommercialFilter("all");
    setVilleFilter("all");
  };

  const { data: statutsCount } = useQuery({
    queryKey: ["demandes-statuts-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("demandes").select("statut");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const r of (data ?? []) as { statut: string | null }[]) {
        const k = (r.statut || "").toLowerCase();
        counts[k] = (counts[k] || 0) + 1;
      }
      return counts;
    },
  });

  const statutKpis = useMemo(() => {
    const c = statutsCount || {};
    const sum = (...keys: string[]) => keys.reduce((s, k) => s + (c[k] || 0), 0);
    return {
      enAttente: sum("en_attente"),
      enCours: sum("nouveau_besoin", "en_cours"),
      confirmee: sum("prestation_terminee", "confirmee"),
      cloturee: sum("paye", "cloturee", "annulee", "rejetee"),
    };
  }, [statutsCount]);

  const agg = useMemo(() => {
    type Row = {
      commercial: string;
      caMois: number;
      caPrev: number;
      dossiersMois: number;
      dossiersPrev: number;
      commissionMois: number;
    };
    const map = new Map<string, Row>();
    const fromMs = fromDate.getTime();
    const toMs = toDate.getTime() + 24 * 60 * 60 * 1000 - 1;
    const prevFromMs = prevFromDate.getTime();
    const prevToMs = prevToDate.getTime() + 24 * 60 * 60 * 1000 - 1;
    for (const f of filteredFactus) {
      const name = (f.commercial || "").trim();
      if (!name) continue;
      const d = new Date(f.date_intervention || f.created_at);
      const ts = d.getTime();
      const inCurrent = ts >= fromMs && ts <= toMs;
      const inPrev = ts >= prevFromMs && ts <= prevToMs;
      if (!inCurrent && !inPrev) continue;
      if (!map.has(name)) {
        map.set(name, {
          commercial: name,
          caMois: 0,
          caPrev: 0,
          dossiersMois: 0,
          dossiersPrev: 0,
          commissionMois: 0,
        });
      }
      const row = map.get(name)!;
      const ca = Number(f.montant_total || 0);
      const partAg = partAgence(f);
      if (inCurrent) {
        row.caMois += ca;
        row.dossiersMois += 1;
        row.commissionMois += partAg * (COMMISSION_COMMERCIAL_PCT / 100);
      } else {
        row.caPrev += ca;
        row.dossiersPrev += 1;
      }
    }
    const totalCa = Array.from(map.values()).reduce((s, r) => s + r.caMois, 0);
    const rows = Array.from(map.values()).map((r) => {
      const taux = totalCa > 0 ? (r.caMois / totalCa) * 100 : 0;
      const tendance = r.caPrev > 0 ? Math.round(((r.caMois - r.caPrev) / r.caPrev) * 100) : r.caMois > 0 ? 100 : 0;
      return { ...r, taux, tendance };
    });
    rows.sort((a, b) => b.caMois - a.caMois);
    return rows;
  }, [filteredFactus, fromDate, toDate, prevFromDate, prevToDate]);

  const totals = useMemo(() => {
    const caTotal = agg.reduce((s, r) => s + r.caMois, 0);
    const commissionTotal = agg.reduce((s, r) => s + r.commissionMois, 0);
    return { caTotal, commissionTotal };
  }, [agg]);

  const chartData = agg.map((r) => ({
    name: r.commercial,
    "CA réalisé": Math.round(r.caMois),
    "Objectif": OBJECTIF_PAR_COMMERCIAL,
  }));

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
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Commercial</label>
          <Select value={commercialFilter} onValueChange={setCommercialFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="all">Tous les commerciaux</SelectItem>
              {filterOptions.commerciaux.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Ville</label>
          <Select value={villeFilter} onValueChange={setVilleFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="all">Toutes les villes</SelectItem>
              {filterOptions.villes.map((v) => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {hasActiveFilter && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="ml-auto text-muted-foreground">
            <X className="h-4 w-4 mr-1" /> Réinitialiser
          </Button>
        )}
      </div>

      {/* KPIs globaux */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard icon={<Users className="h-4 w-4" />} label="Commerciaux actifs" value={String(agg.length)} />
        <KpiCard icon={<Wallet className="h-4 w-4" />} label="CA total équipe" value={fmt(totals.caTotal)} color="text-emerald-600" />
        <KpiCard icon={<BadgePercent className="h-4 w-4" />} label="Commission agence" value={fmt(totals.commissionTotal)} color="text-emerald-600" />
      </div>



      {/* Classement du mois */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-bold uppercase tracking-wider">Classement du mois</h3>
        </div>
        {agg.length === 0 ? (
          <div className="text-sm text-muted-foreground border rounded-md p-6 text-center bg-card">
            Aucun commercial avec des facturations ce mois-ci.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {agg.map((r, i) => (
              <div key={r.commercial} className="border rounded-lg p-3 bg-card hover:shadow-md transition">
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
                    <span className="text-muted-foreground">Réalisation</span>
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
                    <div className="text-muted-foreground">Commission agence</div>
                    <div className="font-bold text-emerald-600">{fmt(r.commissionMois)}</div>
                  </div>
                </div>
              </div>
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
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px]">
                        {initials(r.commercial)}
                      </div>
                      <span className="font-medium">{r.commercial}</span>
                    </div>
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

      {/* Graphique CA vs objectif */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BadgePercent className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-wider">CA réalisé vs Objectif</h3>
        </div>
        <div className="border rounded-lg bg-card p-4" style={{ height: 320 }}>
          {agg.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Aucune donnée</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Bar dataKey="Objectif" fill="hsl(var(--muted-foreground))" opacity={0.4} radius={[4, 4, 0, 0]} />
                <Bar dataKey="CA réalisé" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
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


function StatutKpiCard({ icon, label, value, gradient }: { icon: React.ReactNode; label: string; value: number; gradient: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br ${gradient} text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition`}>
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
      <div className="absolute -right-2 -bottom-8 h-20 w-20 rounded-full bg-white/5" />
      <div className="relative flex items-center justify-between mb-3">
        <span className="text-sm font-semibold uppercase tracking-wider opacity-90">{label}</span>
        <span className="h-11 w-11 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
          {icon}
        </span>
      </div>
      <div className="relative">
        <div className="text-5xl font-extrabold tabular-nums leading-none">{value}</div>
        <div className="text-xs opacity-80 mt-2">demande{value > 1 ? "s" : ""}</div>
      </div>
    </div>
  );
}
