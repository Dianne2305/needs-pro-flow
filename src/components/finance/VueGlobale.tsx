import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, TrendingUp, Clock, Users, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Facturation, partAgence, partProfil, soldeProfil, MODE_PAIEMENT_OPTIONS, STATUT_PAIEMENT_OPTIONS } from "@/lib/finance-types";
import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";

export default function VueGlobale() {
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [filterProfil, setFilterProfil] = useState("all");
  const [filterModePaiement, setFilterModePaiement] = useState("all");
  const [filterStatutPaiement, setFilterStatutPaiement] = useState("all");

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

  const filtered = useMemo(() => {
    return missions.filter((m) => {
      if (dateFrom && m.date_intervention && m.date_intervention < dateFrom) return false;
      if (dateTo && m.date_intervention && m.date_intervention > dateTo) return false;
      if (filterProfil !== "all" && m.profil_id !== filterProfil) return false;
      if (filterModePaiement !== "all" && m.mode_paiement_reel !== filterModePaiement) return false;
      if (filterStatutPaiement !== "all" && m.statut_paiement !== filterStatutPaiement) return false;
      return true;
    });
  }, [missions, dateFrom, dateTo, filterProfil, filterModePaiement, filterStatutPaiement]);

  const totalCA = filtered.reduce((s, m) => s + (m.montant_total || 0), 0);
  const totalCommissions = filtered.reduce((s, m) => s + partAgence(m), 0);
  const totalEnAttente = filtered.filter((m) => m.statut_paiement !== "paye").reduce((s, m) => s + (m.montant_total - (m.montant_paye_client || 0)), 0);
  const totalMissions = filtered.length;

  // Profils avec solde
  const profilSoldes = useMemo(() => {
    const map: Record<string, { nom: string; missions: Facturation[] }> = {};
    missions.forEach((m) => {
      if (!m.profil_id) return;
      if (!map[m.profil_id]) map[m.profil_id] = { nom: m.profil_nom || "Inconnu", missions: [] };
      map[m.profil_id].missions.push(m);
    });
    return Object.entries(map).map(([id, { nom, missions: ms }]) => ({
      id, nom, solde: soldeProfil(ms),
    }));
  }, [missions]);

  const debiteurs = profilSoldes.filter((p) => p.solde > 0);
  const crediteurs = profilSoldes.filter((p) => p.solde < 0);

  return (
    <div className="space-y-6">
      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">Du</label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">Au</label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
        </div>
        <Select value={filterProfil} onValueChange={setFilterProfil}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Profil" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les profils</SelectItem>
            {profils.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.prenom} {p.nom}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterModePaiement} onValueChange={setFilterModePaiement}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Mode paiement" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            {MODE_PAIEMENT_OPTIONS.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatutPaiement} onValueChange={setFilterStatutPaiement}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Statut paiement" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            {STATUT_PAIEMENT_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Missions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalMissions}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Chiffre d'affaires</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalCA.toLocaleString("fr-MA")} DH</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Commissions agence</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-emerald-600">{totalCommissions.toLocaleString("fr-MA")} DH</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Montants en attente</CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-amber-600">{totalEnAttente.toLocaleString("fr-MA")} DH</div></CardContent>
        </Card>
      </div>

      {/* Soldes profils */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-red-500" /> Profils débiteurs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {debiteurs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun profil débiteur</p>
            ) : (
              <div className="space-y-2">
                {debiteurs.map((p) => (
                  <div key={p.id} className="flex justify-between items-center">
                    <span className="text-sm">{p.nom}</span>
                    <Badge variant="destructive">{p.solde.toLocaleString("fr-MA")} DH</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowDownRight className="h-4 w-4 text-blue-500" /> Profils créditeurs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {crediteurs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun profil créditeur</p>
            ) : (
              <div className="space-y-2">
                {crediteurs.map((p) => (
                  <div key={p.id} className="flex justify-between items-center">
                    <span className="text-sm">{p.nom}</span>
                    <Badge className="bg-blue-100 text-blue-800">{Math.abs(p.solde).toLocaleString("fr-MA")} DH</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
