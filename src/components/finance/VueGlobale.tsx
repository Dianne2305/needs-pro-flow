/**
 * VueGlobale.tsx
 * Sous-composant Vue globale (KPI + graphiques recharts) utilisé dans VueGlobalePage.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { FileText, TrendingUp, Building2, AlertTriangle, CalendarIcon, X, Search } from "lucide-react";
import { Facturation, partAgence, partProfil } from "@/lib/finance-types";
import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const PIE_COLORS = ["#3b82f6", "#8b5cf6"];
const BAR_RED = "#ef4444";
const BAR_BLUE = "#3b82f6";

export default function VueGlobale() {
  const now = new Date();
  const [dateFrom, setDateFrom] = useState<Date | undefined>(startOfMonth(now));
  const [dateTo, setDateTo] = useState<Date | undefined>(endOfMonth(now));
  const [search, setSearch] = useState("");

  const { data: missions = [] } = useQuery({
    queryKey: ["facturation", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("facturation").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Facturation[];
    },
  });

  const { data: profils = [] } = useQuery({
    queryKey: ["profils", "list_finance"],
    queryFn: async () => {
      const { data } = await supabase.from("profils").select("id, nom, prenom");
      return data || [];
    },
  });

  const { data: caisseOps = [] } = useQuery({
    queryKey: ["operations_caisse", "all"],
    queryFn: async () => {
      const { data } = await supabase.from("operations_caisse").select("type_operation, montant");
      return (data || []) as { type_operation: string; montant: number }[];
    },
  });

  const soldeCaisse = caisseOps.reduce((s, o) => s + (o.type_operation === "entree" ? o.montant : -o.montant), 0);

  const filtered = useMemo(() => {
    return missions.filter((m) => {
      if (dateFrom && m.date_intervention) {
        if (parseISO(m.date_intervention) < dateFrom) return false;
      }
      if (dateTo && m.date_intervention) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (parseISO(m.date_intervention) > end) return false;
      }
      if ((dateFrom || dateTo) && !m.date_intervention) return false;
      if (search) {
        const s = search.toLowerCase();
        return (m.nom_client?.toLowerCase().includes(s) || m.profil_nom?.toLowerCase().includes(s));
      }
      return true;
    });
  }, [missions, dateFrom, dateTo, search]);

  // KPIs
  const nbMissions = missions.filter((m) => m.statut_mission === "confirmee" || m.statut_mission === "terminee").length;
  const ca = filtered.reduce((s, m) => {
    if (m.statut_mission === "facturation_annulee") return s;
    return s + (m.montant_paye_client || 0);
  }, 0);
  const commissionAgenceBrut = filtered.reduce((s, m) => {
    if (m.statut_mission === "facturation_annulee") return s;
    if (m.statut_paiement === "paye" || m.statut_paiement === "agence_payee_client" || m.statut_paiement === "paiement_partiel") {
      return s + partAgence(m);
    }
    return s;
  }, 0);
  const commissionAgence = commissionAgenceBrut - soldeCaisse;
  const factAnnulee = filtered.filter((m) => m.statut_mission === "facturation_annulee").reduce((s, m) => s + (m.montant_total || 0), 0);

  // Pie chart: particuliers vs entreprises
  const nbParticuliers = missions.filter((m) => (m as any).segment !== "entreprise" && (m.statut_mission === "confirmee" || m.statut_mission === "terminee" || m.statut_mission === "paye")).length;
  const nbEntreprises = missions.filter((m) => (m as any).segment === "entreprise" && (m.statut_mission === "confirmee" || m.statut_mission === "terminee" || m.statut_mission === "paye")).length;
  const pieData = [
    { name: "Particuliers", value: nbParticuliers },
    { name: "Entreprises", value: nbEntreprises },
  ];

  // Agence non payée (profil payé par client, part agence non reversée) - grouped by profil
  const agenceNonPayee = useMemo(() => {
    const map: Record<string, { nom: string; montant: number }> = {};
    missions.forEach((m) => {
      if (m.statut_paiement === "profil_paye_client" && !m.part_agence_reversee) {
        const key = m.profil_nom || "Inconnu";
        if (!map[key]) map[key] = { nom: key, montant: 0 };
        map[key].montant += (m.montant_profil_doit != null ? m.montant_profil_doit : partAgence(m));
      }
    });
    return Object.values(map).filter((v) => v.montant > 0);
  }, [missions]);

  // Profil non payé (agence payée par client, part profil non versée) - grouped by profil
  const profilNonPaye = useMemo(() => {
    const map: Record<string, { nom: string; montant: number }> = {};
    missions.forEach((m) => {
      if (m.statut_paiement === "agence_payee_client" && !m.part_profil_versee) {
        const key = m.profil_nom || "Inconnu";
        if (!map[key]) map[key] = { nom: key, montant: 0 };
        map[key].montant += (m.montant_agence_doit != null ? m.montant_agence_doit : partProfil(m));
      }
    });
    return Object.values(map).filter((v) => v.montant > 0);
  }, [missions]);

  const totalAgenceNonPayee = agenceNonPayee.reduce((s, v) => s + v.montant, 0);
  const totalProfilNonPaye = profilNonPaye.reduce((s, v) => s + v.montant, 0);

  // Debit/Credit table
  const debitCreditData = useMemo(() => {
    return filtered.map((m) => {
      const debit = m.statut_paiement === "profil_paye_client" && !m.part_agence_reversee
        ? (m.montant_profil_doit != null ? m.montant_profil_doit : partAgence(m))
        : 0;
      const credit = m.statut_paiement === "agence_payee_client" && !m.part_profil_versee
        ? (m.montant_agence_doit != null ? m.montant_agence_doit : partProfil(m))
        : 0;
      const commission = m.montant_profil_doit != null ? m.montant_profil_doit : partAgence(m);
      return { ...m, debit, credit, commission };
    }).filter((m) => m.debit > 0 || m.credit > 0);
  }, [filtered]);

  const totalDebit = debitCreditData.reduce((s, m) => s + m.debit, 0);
  const totalCredit = debitCreditData.reduce((s, m) => s + m.credit, 0);
  const totalCommTable = debitCreditData.reduce((s, m) => s + m.commission, 0);

  const fmt = (n: number) => n.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " DH";

  return (
    <div className="space-y-6">
      {/* Date Filter */}
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
          <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
            <X className="h-4 w-4 mr-1" /> Réinitialiser
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nombre de missions</p>
            <p className="text-3xl font-bold mt-1">{nbMissions}</p>
            <p className="text-xs text-muted-foreground mt-1">missions en cours (temps réel)</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Chiffre d'affaires</p>
            <p className="text-3xl font-bold mt-1">{fmt(ca)}</p>
            <p className="text-xs text-muted-foreground mt-1">paiements reçus des clients</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-600">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-green-700">Commission agence</p>
            <p className="text-3xl font-bold mt-1">{fmt(commissionAgence)}</p>
            <p className="text-xs text-muted-foreground mt-1">part agence (mensuelle)</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-red-600">Facturation annulée</p>
            <p className="text-3xl font-bold mt-1">{fmt(factAnnulee)}</p>
            <p className="text-xs text-muted-foreground mt-1">perte totale</p>
          </CardContent>
        </Card>
      </div>

      {/* Pie Chart */}
      <Card>
        <CardContent className="pt-5">
          <h3 className="text-base font-semibold mb-4">Répartition des missions</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Bar Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <h3 className="text-sm font-semibold text-red-700">Agence non payée</h3>
              <Badge className="ml-auto bg-red-100 text-red-800">{fmt(totalAgenceNonPayee)}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Ce que les profils doivent à l'agence</p>
            {agenceNonPayee.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Aucun débit en cours</p>
            ) : (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agenceNonPayee} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v) => `${v} DH`} />
                    <YAxis type="category" dataKey="nom" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="montant" fill={BAR_RED} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-blue-700">Profil non payé</h3>
              <Badge className="ml-auto bg-blue-100 text-blue-800">{fmt(totalProfilNonPaye)}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Ce que l'agence doit aux profils</p>
            {profilNonPaye.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Aucun crédit en cours</p>
            ) : (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={profilNonPaye} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v) => `${v} DH`} />
                    <YAxis type="category" dataKey="nom" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="montant" fill={BAR_BLUE} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Debit/Credit Table */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h3 className="text-base font-semibold">Tableau Débit / Crédit</h3>
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher par nom..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="uppercase text-xs">Date</TableHead>
                  <TableHead className="uppercase text-xs">Client</TableHead>
                  <TableHead className="uppercase text-xs">Profil</TableHead>
                  <TableHead className="uppercase text-xs text-red-600">Débit</TableHead>
                  <TableHead className="uppercase text-xs text-orange-600">Crédit</TableHead>
                  <TableHead className="uppercase text-xs text-green-600">Commission agence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debitCreditData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucune donnée</TableCell>
                  </TableRow>
                ) : (
                  <>
                    {debitCreditData.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-sm">{m.date_intervention ? format(new Date(m.date_intervention), "dd/MM/yyyy") : "—"}</TableCell>
                        <TableCell className="text-sm font-medium">{m.nom_client}</TableCell>
                        <TableCell className="text-sm">{m.profil_nom || "—"}</TableCell>
                        <TableCell className="font-semibold text-red-600">{m.debit > 0 ? fmt(m.debit) : "—"}</TableCell>
                        <TableCell className="font-semibold text-orange-600">{m.credit > 0 ? fmt(m.credit) : "—"}</TableCell>
                        <TableCell className="font-semibold text-green-600">{fmt(m.commission)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold border-t-2">
                      <TableCell colSpan={3} className="text-right font-bold">TOTAL</TableCell>
                      <TableCell className="text-red-600 font-bold">{fmt(totalDebit)}</TableCell>
                      <TableCell className="text-orange-600 font-bold">{fmt(totalCredit)}</TableCell>
                      <TableCell className="text-green-600 font-bold">{fmt(totalCommTable)}</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
