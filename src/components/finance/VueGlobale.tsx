import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, TrendingUp, TrendingDown, Clock, ArrowDownLeft, ArrowUpRight, AlertTriangle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Facturation, partAgence, partProfil, soldeProfil, MODE_PAIEMENT_OPTIONS, STATUT_PAIEMENT_OPTIONS } from "@/lib/finance-types";
import { useState, useMemo } from "react";
import { format, startOfYear, subMonths } from "date-fns";
import { fr } from "date-fns/locale";

const MONTH_OPTIONS = [
  { value: "all", label: "Tous les mois" },
  ...Array.from({ length: 12 }, (_, i) => ({
    value: String(i),
    label: format(new Date(2024, i, 1), "MMMM", { locale: fr }),
  })),
];

export default function VueGlobale() {
  const [filterMonth, setFilterMonth] = useState("all");
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
      if (filterMonth !== "all" && m.date_intervention) {
        const month = new Date(m.date_intervention).getMonth();
        if (month !== Number(filterMonth)) return false;
      }
      if (filterProfil !== "all" && m.profil_id !== filterProfil) return false;
      if (filterModePaiement !== "all" && m.mode_paiement_reel !== filterModePaiement) return false;
      if (filterStatutPaiement !== "all" && m.statut_paiement !== filterStatutPaiement) return false;
      return true;
    });
  }, [missions, filterMonth, filterProfil, filterModePaiement, filterStatutPaiement]);

  const totalCA = filtered.reduce((s, m) => s + (m.montant_total || 0), 0);
  const totalCommissions = filtered.reduce((s, m) => s + partAgence(m), 0);
  const totalEnAttente = filtered.filter((m) => m.statut_paiement !== "paye").reduce((s, m) => s + (m.montant_total - (m.montant_paye_client || 0)), 0);
  const enCours = filtered.filter((m) => m.statut_mission === "confirmee").length;
  const totalMissions = filtered.length;

  // Règlements internes non soldés
  const agenceNonPayee = filtered.filter((m) => m.encaisse_par === "profil" && !m.part_agence_reversee);
  const profilNonPaye = filtered.filter((m) => m.encaisse_par !== "profil" && !m.part_profil_versee);
  const montantAgenceNonPayee = agenceNonPayee.reduce((s, m) => s + partAgence(m), 0);
  const montantProfilNonPaye = profilNonPaye.reduce((s, m) => s + partProfil(m), 0);

  // Récapitulatif par profil
  const recapProfils = useMemo(() => {
    const map: Record<string, { nom: string; missions: Facturation[] }> = {};
    filtered.forEach((m) => {
      // Match by profil_id or fallback to profil_nom
      let key = m.profil_id;
      if (!key && m.profil_nom) {
        // Use profil_nom as key when profil_id is null
        const matchedProfil = profils.find((p) => {
          const fullName = `${p.prenom} ${p.nom}`.toLowerCase();
          const reverseName = `${p.nom} ${p.prenom}`.toLowerCase();
          const nom = m.profil_nom?.toLowerCase() || "";
          return nom === fullName || nom === reverseName || nom.includes(p.nom.toLowerCase());
        });
        key = matchedProfil?.id || `nom_${m.profil_nom}`;
      }
      if (!key) return;
      if (!map[key]) map[key] = { nom: m.profil_nom || "Inconnu", missions: [] };
      map[key].missions.push(m);
    });
    return Object.entries(map).map(([id, { nom, missions: ms }]) => {
      const ca = ms.reduce((s, m) => s + (m.montant_total || 0), 0);
      const commAgence = ms.reduce((s, m) => s + partAgence(m), 0);
      const aVerser = ms.reduce((s, m) => s + partProfil(m), 0);
      const paiementsRecus = ms.reduce((s, m) => s + (m.montant_paye_client || 0), 0);
      const enAttente = ms.filter((m) => m.statut_paiement !== "paye").reduce((s, m) => s + (m.montant_total - (m.montant_paye_client || 0)), 0);
      const solde = soldeProfil(ms);
      return { id, nom, count: ms.length, ca, commAgence, aVerser, paiementsRecus, enAttente, solde };
    });
  }, [filtered]);

  const totals = recapProfils.reduce(
    (acc, p) => ({
      count: acc.count + p.count,
      ca: acc.ca + p.ca,
      commAgence: acc.commAgence + p.commAgence,
      aVerser: acc.aVerser + p.aVerser,
      paiementsRecus: acc.paiementsRecus + p.paiementsRecus,
      enAttente: acc.enAttente + p.enAttente,
    }),
    { count: 0, ca: 0, commAgence: 0, aVerser: 0, paiementsRecus: 0, enAttente: 0 }
  );

  const debiteurs = recapProfils.filter((p) => p.solde > 0);
  const crediteurs = recapProfils.filter((p) => p.solde < 0);

  const fmt = (n: number) => n.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " DH";

  return (
    <div className="space-y-6">
      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Tous les mois" /></SelectTrigger>
          <SelectContent>
            {MONTH_OPTIONS.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterProfil} onValueChange={setFilterProfil}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Tous les profils" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les profils</SelectItem>
            {profils.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.prenom} {p.nom}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterModePaiement} onValueChange={setFilterModePaiement}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Tous les modes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les modes</SelectItem>
            {MODE_PAIEMENT_OPTIONS.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatutPaiement} onValueChange={setFilterStatutPaiement}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Tous les statuts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {STATUT_PAIEMENT_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-muted-foreground">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Missions (filtre)</p>
                <p className="text-3xl font-bold mt-1">{totalMissions}</p>
                <p className="text-xs text-muted-foreground mt-1">interventions</p>
              </div>
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary bg-primary/5">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Chiffre d'affaires</p>
                <p className="text-3xl font-bold mt-1">{fmt(totalCA)}</p>
                <p className="text-xs text-muted-foreground mt-1">HT missions</p>
              </div>
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-600">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Commissions agence</p>
                <p className="text-3xl font-bold mt-1">{fmt(totalCommissions)}</p>
                <p className="text-xs text-muted-foreground mt-1">total gagné</p>
              </div>
              <TrendingDown className="h-5 w-5 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Montants en attente</p>
                <p className="text-3xl font-bold mt-1">{fmt(totalEnAttente)}</p>
                <p className="text-xs text-muted-foreground mt-1">non encaissé</p>
              </div>
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Règlements internes non soldés */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-red-600">Agence non payée</p>
                <p className="text-3xl font-bold mt-1">{fmt(montantAgenceNonPayee)}</p>
                <p className="text-xs text-muted-foreground mt-1">{agenceNonPayee.length} mission(s) — encaissé par profil, part agence non reversée</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Profil non payé</p>
                <p className="text-3xl font-bold mt-1">{fmt(montantProfilNonPaye)}</p>
                <p className="text-xs text-muted-foreground mt-1">{profilNonPaye.length} mission(s) — encaissé par agence, part profil non versée</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Soldes profils - débiteurs / créditeurs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-red-200">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="h-4 w-4 text-red-500" />
                <span className="font-semibold text-sm text-red-700">Profils débiteurs</span>
              </div>
              <Badge variant="secondary" className="rounded-full bg-red-100 text-red-700">{debiteurs.length}</Badge>
            </div>
            {debiteurs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun profil débiteur</p>
            ) : (
              <div className="space-y-2">
                {debiteurs.map((p) => (
                  <div key={p.id} className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium">{p.nom}</span>
                    <span className="text-sm font-bold text-red-600">{fmt(p.solde)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="border-blue-200">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-blue-500" />
                <span className="font-semibold text-sm text-blue-700">Agence doit au profil</span>
              </div>
              <Badge variant="secondary" className="rounded-full bg-blue-100 text-blue-700">{crediteurs.length}</Badge>
            </div>
            {crediteurs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun profil créditeur</p>
            ) : (
              <div className="space-y-2">
                {crediteurs.map((p) => (
                  <div key={p.id} className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium">{p.nom}</span>
                    <span className="text-sm font-bold text-blue-600">{fmt(Math.abs(p.solde))}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Récapitulatif missions filtrées */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold">Récapitulatif missions filtrées</h3>
            <span className="text-sm text-muted-foreground">{recapProfils.length} résultat(s)</span>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="uppercase text-xs tracking-wider">Profil</TableHead>
                  <TableHead className="uppercase text-xs tracking-wider">Missions</TableHead>
                  <TableHead className="uppercase text-xs tracking-wider">CA total</TableHead>
                  <TableHead className="uppercase text-xs tracking-wider">Commission agence</TableHead>
                  <TableHead className="uppercase text-xs tracking-wider">À verser profils</TableHead>
                  <TableHead className="uppercase text-xs tracking-wider">Paiement reçu du client</TableHead>
                  <TableHead className="uppercase text-xs tracking-wider">En attente du client</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recapProfils.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucune donnée</TableCell>
                  </TableRow>
                ) : (
                  <>
                    {recapProfils.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.nom}</TableCell>
                        <TableCell>{p.count}</TableCell>
                        <TableCell className="font-semibold">{fmt(p.ca)}</TableCell>
                        <TableCell>{fmt(p.commAgence)}</TableCell>
                        <TableCell className="text-emerald-700 font-medium">{fmt(p.aVerser)}</TableCell>
                        <TableCell>{fmt(p.paiementsRecus)}</TableCell>
                        <TableCell className={p.enAttente > 0 ? "text-red-600 font-medium" : ""}>{fmt(p.enAttente)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>TOTAL</TableCell>
                      <TableCell>{totals.count}</TableCell>
                      <TableCell>{fmt(totals.ca)}</TableCell>
                      <TableCell>{fmt(totals.commAgence)}</TableCell>
                      <TableCell className="text-emerald-700">{fmt(totals.aVerser)}</TableCell>
                      <TableCell>{fmt(totals.paiementsRecus)}</TableCell>
                      <TableCell className="text-red-600">{fmt(totals.enAttente)}</TableCell>
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
