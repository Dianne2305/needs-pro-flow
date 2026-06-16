/**
 * SuiviCommerciaux.tsx
 * Tableau de bord de suivi des commerciaux : KPIs équipe, classement du mois,
 * détail par commercial et graphique CA vs Objectif.
 * Données calculées depuis la table `facturation` (champ `commercial`).
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Facturation, partAgence } from "@/lib/finance-types";
import { Users, Wallet, Target, Percent, BadgePercent, Trophy, Table as TableIcon, TrendingUp, TrendingDown, Clock, PlayCircle, CheckCircle2, Archive } from "lucide-react";
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

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function SuiviCommerciaux() {
  const now = new Date();
  const currentMonth = monthKey(now);
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = monthKey(prev);

  const { data: factus = [], isLoading } = useQuery({
    queryKey: ["facturation-suivi-commerciaux"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("facturation")
        .select("commercial, montant_total, commission_pourcentage, date_intervention, created_at, demande_id");
      if (error) throw error;
      return (data ?? []) as unknown as Facturation[];
    },
  });

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
    for (const f of factus) {
      const name = (f.commercial || "").trim();
      if (!name) continue;
      const d = new Date(f.date_intervention || f.created_at);
      const mk = monthKey(d);
      if (mk !== currentMonth && mk !== prevMonth) continue;
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
      if (mk === currentMonth) {
        row.caMois += ca;
        row.dossiersMois += 1;
        row.commissionMois += partAg * (COMMISSION_COMMERCIAL_PCT / 100);
      } else {
        row.caPrev += ca;
        row.dossiersPrev += 1;
      }
    }
    const rows = Array.from(map.values()).map((r) => {
      const taux = OBJECTIF_PAR_COMMERCIAL > 0 ? (r.caMois / OBJECTIF_PAR_COMMERCIAL) * 100 : 0;
      // Conversion = dossiers réalisés / objectif dossiers (proxy : objectif = 15 dossiers)
      const conversion = Math.min(100, Math.round((r.dossiersMois / 15) * 100));
      const tendance = r.caPrev > 0 ? Math.round(((r.caMois - r.caPrev) / r.caPrev) * 100) : r.caMois > 0 ? 100 : 0;
      return { ...r, taux, conversion, tendance };
    });
    rows.sort((a, b) => b.caMois - a.caMois);
    return rows;
  }, [factus, currentMonth, prevMonth]);

  const totals = useMemo(() => {
    const caTotal = agg.reduce((s, r) => s + r.caMois, 0);
    const objectifTotal = agg.length * OBJECTIF_PAR_COMMERCIAL;
    const commissionTotal = agg.reduce((s, r) => s + r.commissionMois, 0);
    const realisationMoy = objectifTotal > 0 ? Math.round((caTotal / objectifTotal) * 100) : 0;
    return { caTotal, objectifTotal, commissionTotal, realisationMoy };
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
      {/* KPIs globaux */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard icon={<Users className="h-4 w-4" />} label="Commerciaux actifs" value={String(agg.length)} />
        <KpiCard icon={<Wallet className="h-4 w-4" />} label="CA total équipe" value={fmt(totals.caTotal)} color="text-emerald-600" />
        <KpiCard icon={<Target className="h-4 w-4" />} label="Objectif équipe" value={fmt(totals.objectifTotal)} />
        <KpiCard icon={<Percent className="h-4 w-4" />} label="Réalisation moy." value={`${totals.realisationMoy}%`} color={totals.realisationMoy >= 100 ? "text-emerald-600" : totals.realisationMoy >= 80 ? "text-amber-600" : "text-rose-600"} />
        <KpiCard icon={<BadgePercent className="h-4 w-4" />} label="Commissions totales" value={fmt(totals.commissionTotal)} color="text-emerald-600" />
      </div>

      {/* KPIs par statut de demande */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BadgePercent className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-wider">KPIs par statut de demande</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatutKpiCard icon={<Clock className="h-6 w-6" />} label="En attente" value={statutKpis.enAttente} gradient="from-amber-500 to-orange-500" />
          <StatutKpiCard icon={<PlayCircle className="h-6 w-6" />} label="En cours" value={statutKpis.enCours} gradient="from-sky-500 to-blue-600" />
          <StatutKpiCard icon={<CheckCircle2 className="h-6 w-6" />} label="Confirmée" value={statutKpis.confirmee} gradient="from-emerald-500 to-teal-600" />
          <StatutKpiCard icon={<Archive className="h-6 w-6" />} label="Clôturée" value={statutKpis.cloturee} gradient="from-slate-500 to-slate-700" />
        </div>
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
                      {Math.round(r.taux)}%
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
                <th className="text-right px-3 py-2">Objectif</th>
                <th className="text-right px-3 py-2">CA réalisé</th>
                <th className="text-center px-3 py-2">Taux</th>
                <th className="text-right px-3 py-2">Dossiers</th>
                <th className="text-right px-3 py-2">Conversion</th>
                <th className="text-right px-3 py-2">Commission</th>
                <th className="text-right px-3 py-2">Tendance</th>
              </tr>
            </thead>
            <tbody>
              {agg.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">Aucune donnée</td></tr>
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
                  <td className="text-right px-3 py-2 tabular-nums">{fmt(OBJECTIF_PAR_COMMERCIAL)}</td>
                  <td className="text-right px-3 py-2 tabular-nums font-semibold">{fmt(r.caMois)}</td>
                  <td className="text-center px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${tauxBadge(r.taux)}`}>
                      {Math.round(r.taux)}%
                    </span>
                  </td>
                  <td className="text-right px-3 py-2 tabular-nums">{r.dossiersMois}</td>
                  <td className="text-right px-3 py-2 tabular-nums">{r.conversion}%</td>
                  <td className="text-right px-3 py-2 tabular-nums text-emerald-600 font-semibold">{fmt(r.commissionMois)}</td>
                  <td className="text-right px-3 py-2">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${r.tendance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {r.tendance >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {r.tendance >= 0 ? "+" : ""}{r.tendance}%
                    </span>
                  </td>
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
