/**
 * ComptesProfils.tsx
 * Onglet Comptes Profils : cartes/tableau des soldes profils + total perte (facturations annulées).
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, Eye, TrendingUp, Building2, Users, CheckCircle, AlertCircle, LayoutGrid, List, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Facturation, partAgence, partProfil, soldeProfil, STATUT_PAIEMENT_OPTIONS } from "@/lib/finance-types";
import { format } from "date-fns";

/**
 * Données financières agrégées d'un profil intervenant.
 * Construite côté front en croisant `profils` et `facturation`.
 */
interface ProfilFinance {
  id: string;
  nom: string;
  prenom: string;
  telephone: string | null;
  ville: string | null;
  quartier: string | null;
  /** Toutes les missions liées au profil. */
  missions: Facturation[];
  /** Missions où le profil a été payé par le client → il doit reverser la part agence. */
  missionsProfilDoit: Facturation[];
  /** Missions où l'agence a encaissé → elle doit verser la part profil. */
  missionsAgenceDoit: Facturation[];
  totalMissions: number;
  totalCA: number;
  totalPartAgence: number;
  totalPartProfil: number;
  totalVerseAuProfil: number;
  totalRecuDuProfil: number;
  /** Montant total que le profil doit à l'agence. */
  montantProfilDoit: number;
  /** Montant total que l'agence doit au profil. */
  montantAgenceDoit: number;
  /** Solde net (positif = agence doit au profil, négatif = inverse). */
  solde: number;
  /** Total des paiements client encore en attente. */
  enAttente: number;
  /** Somme des montants des facturations annulées (perte). */
  totalFactAnnulee: number;
}

/**
 * Onglet "Comptes Profils" de la Gestion Financière.
 * Affiche soit en cartes soit en tableau les soldes financiers de chaque profil
 * (CA, parts agence/profil, dettes croisées, en attente, total perte).
 */
export default function ComptesProfils() {
  const [search, setSearch] = useState("");
  const [selectedProfil, setSelectedProfil] = useState<ProfilFinance | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  const { data: profils = [] } = useQuery({
    queryKey: ["profils", "all_finance"],
    queryFn: async () => {
      const { data } = await supabase.from("profils").select("id, nom, prenom, telephone, ville, quartier");
      return data || [];
    },
  });

  const { data: missions = [] } = useQuery({
    queryKey: ["facturation", "all"],
    queryFn: async () => {
      const { data } = await supabase.from("facturation").select("*").order("created_at", { ascending: false });
      return (data || []) as unknown as Facturation[];
    },
  });

  const fmt = (n: number) => n.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " DH";

  const profilFinances: ProfilFinance[] = useMemo(() => {
    return profils.map((p) => {
      const fullName = `${p.prenom} ${p.nom}`.toLowerCase();
      const reverseName = `${p.nom} ${p.prenom}`.toLowerCase();
      const ms = missions.filter((m) => 
        m.profil_id === p.id || 
        (!m.profil_id && m.profil_nom && (
          m.profil_nom.toLowerCase() === fullName ||
          m.profil_nom.toLowerCase() === reverseName ||
          m.profil_nom.toLowerCase().includes(p.nom.toLowerCase())
        ))
      );
      const totalFactAnnulee = ms
        .filter((m) => (m as any).statut_mission === "facturation_annulee")
        .reduce((s, m) => s + (Number(m.montant_total) || 0), 0);
      const totalCA = ms.reduce((s, m) => s + (m.montant_total || 0), 0);
      const totalPA = ms.reduce((s, m) => s + partAgence(m), 0);
      const totalPP = ms.reduce((s, m) => s + partProfil(m), 0);
      const totalVerse = ms.filter((m) => m.encaisse_par === "agence" && m.part_profil_versee).reduce((s, m) => s + partProfil(m), 0);
      const totalRecu = ms.filter((m) => m.encaisse_par === "profil" && m.part_agence_reversee).reduce((s, m) => s + partAgence(m), 0);

      // Profile owes the agency: profile collected and hasn't reversed agency share
      const missionsProfilDoit = ms.filter((m) => m.encaisse_par === "profil" && !m.part_agence_reversee);
      const montantProfilDoit = missionsProfilDoit.reduce((s, m) => s + partAgence(m), 0);

      // Agency owes the profile: agency collected and hasn't paid profile share
      const missionsAgenceDoit = ms.filter((m) => m.encaisse_par === "agence" && !m.part_profil_versee);
      const montantAgenceDoit = missionsAgenceDoit.reduce((s, m) => s + partProfil(m), 0);

      const solde = soldeProfil(ms);
      const enAttente = Math.abs(solde);

      return {
        id: p.id, nom: p.nom, prenom: p.prenom, telephone: p.telephone,
        ville: (p as any).ville || null, quartier: (p as any).quartier || null,
        missions: ms, missionsProfilDoit, missionsAgenceDoit,
        totalMissions: ms.length, totalCA, totalPartAgence: totalPA,
        totalPartProfil: totalPP, totalVerseAuProfil: totalVerse, totalRecuDuProfil: totalRecu,
        montantProfilDoit, montantAgenceDoit,
        solde, enAttente, totalFactAnnulee,
      };
    }).filter((p) => p.totalMissions > 0 || search);
  }, [profils, missions, search]);

  const filtered = profilFinances.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return p.nom.toLowerCase().includes(s) || p.prenom.toLowerCase().includes(s) || p.telephone?.includes(s);
  });

  return (
    <div className="space-y-0">
      {/* Dark Header */}
      <div className="bg-[hsl(220,40%,20%)] text-white rounded-t-lg px-6 py-5">
        <h2 className="text-xl font-bold">Comptes Financiers des Profils</h2>
        <p className="text-sm text-white/70">Suivi des soldes et répartitions par femme de ménage</p>
      </div>

      {/* Search + View Toggle */}
      <div className="flex flex-wrap gap-3 items-center justify-between px-1 py-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher un profil..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1 border rounded-md p-0.5">
          <Button variant={viewMode === "cards" ? "default" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setViewMode("cards")}>
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button variant={viewMode === "table" ? "default" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setViewMode("table")}>
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">Aucun profil avec missions</div>
      ) : viewMode === "cards" ? (
        /* ===== CARDS VIEW ===== */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((p) => (
            <ProfilCard key={p.id} profil={p} fmt={fmt} onView={() => setSelectedProfil(p)} />
          ))}
        </div>
      ) : (
        /* ===== TABLE VIEW ===== */
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-b-2">
                <TableHead className="uppercase text-xs tracking-wider font-semibold">Profil</TableHead>
                <TableHead className="uppercase text-xs tracking-wider font-semibold">Missions</TableHead>
                <TableHead className="uppercase text-xs tracking-wider font-semibold">CA généré</TableHead>
                <TableHead className="uppercase text-xs tracking-wider font-semibold">Part agence</TableHead>
                <TableHead className="uppercase text-xs tracking-wider font-semibold">Part profil</TableHead>
                <TableHead className="uppercase text-xs tracking-wider font-semibold">Solde</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id} className="hover:bg-muted/30">
                  <TableCell>
                    <div className="font-semibold">{p.prenom} {p.nom}</div>
                    <div className="text-xs text-muted-foreground">{p.ville || ""} {p.telephone ? `– ${p.telephone}` : ""}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="font-bold">{p.totalMissions}</Badge></TableCell>
                  <TableCell className="font-medium">{fmt(p.totalCA)}</TableCell>
                  <TableCell className="text-emerald-700 font-medium">{fmt(p.totalPartAgence)}</TableCell>
                  <TableCell className="text-sky-700 font-medium">{fmt(p.totalPartProfil)}</TableCell>
                  <TableCell>
                    <SoldeBadge solde={p.solde} fmt={fmt} />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedProfil(p)}><Eye className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Modal */}
      {selectedProfil && (
        <Dialog open onOpenChange={() => setSelectedProfil(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Compte financier — {selectedProfil.prenom} {selectedProfil.nom}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Missions</p><p className="text-xl font-bold">{selectedProfil.totalMissions}</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">CA généré</p><p className="text-xl font-bold">{fmt(selectedProfil.totalCA)}</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Part agence</p><p className="text-xl font-bold text-emerald-700">{fmt(selectedProfil.totalPartAgence)}</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Part profil</p><p className="text-xl font-bold text-sky-700">{fmt(selectedProfil.totalPartProfil)}</p></CardContent></Card>
              </div>
              <Card className={selectedProfil.solde > 0 ? "border-red-200 bg-red-50" : selectedProfil.solde < 0 ? "border-blue-200 bg-blue-50" : "border-green-200 bg-green-50"}>
                <CardContent className="pt-4 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium">Solde actuel</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedProfil.solde > 0 ? "Le profil doit de l'argent à l'agence" : selectedProfil.solde < 0 ? "L'agence doit de l'argent au profil" : "Situation équilibrée"}
                    </p>
                  </div>
                  <p className="text-2xl font-bold">{fmt(Math.abs(selectedProfil.solde))}</p>
                </CardContent>
              </Card>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N°</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Encaissé par</TableHead>
                      <TableHead>Paiement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedProfil.missions.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono text-xs">M-{m.num_mission}</TableCell>
                        <TableCell>{m.date_intervention ? format(new Date(m.date_intervention), "dd/MM/yyyy") : "—"}</TableCell>
                        <TableCell>{m.nom_client}</TableCell>
                        <TableCell className="font-semibold">{fmt(m.montant_total)}</TableCell>
                        <TableCell><Badge variant="outline">{m.encaisse_par === "profil" ? "Profil" : "Agence"}</Badge></TableCell>
                        <TableCell>
                          <Badge className={STATUT_PAIEMENT_OPTIONS.find((s) => s.value === m.statut_paiement)?.color || ""}>
                            {STATUT_PAIEMENT_OPTIONS.find((s) => s.value === m.statut_paiement)?.label || m.statut_paiement}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/* ===== PROFIL CARD ===== */
function ProfilCard({ profil, fmt, onView }: { profil: ProfilFinance; fmt: (n: number) => string; onView: () => void }) {
  const { montantProfilDoit, montantAgenceDoit } = profil;
  const hasDebt = montantProfilDoit > 0 || montantAgenceDoit > 0;
  const borderColor = hasDebt ? "border-l-orange-500" : "border-l-green-500";
  const localisation = [profil.ville, profil.quartier].filter(Boolean).join(" / ") || "—";

  return (
    <Card className={`border-l-4 ${borderColor} overflow-hidden shadow-sm hover:shadow-md transition-shadow`}>
      {/* Header */}
      <div className="bg-[hsl(220,40%,20%)] text-white px-5 py-4 flex items-center justify-between">
        <div className="min-w-0">
          <Link
            to={`/compte-profil?id=${profil.id}`}
            className="font-bold text-lg hover:underline block truncate"
            onClick={(e) => e.stopPropagation()}
          >
            {profil.prenom} {profil.nom}
          </Link>
          <p className="text-sm text-white/70 truncate">{localisation}</p>
        </div>
        <div className="bg-white/20 rounded-md px-3 py-1.5 text-center shrink-0 ml-2">
          <p className="text-[10px] uppercase tracking-wider text-white/80">Missions</p>
          <p className="text-xl font-bold">{profil.totalMissions}</p>
        </div>
      </div>

      <CardContent className="pt-4 pb-5 space-y-4">
        {/* Dettes en orange avec popover */}
        <div className="grid grid-cols-2 gap-3">
          <DebtItem
            label="Profil doit à l'agence"
            amount={montantProfilDoit}
            onClick={onView}
            fmt={fmt}
          />
          <DebtItem
            label="Agence doit au profil"
            amount={montantAgenceDoit}
            onClick={onView}
            fmt={fmt}
          />
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          <MetricItem icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />} label="CA total généré" value={fmt(profil.totalCA)} />
          <MetricItem icon={<Building2 className="h-4 w-4 text-muted-foreground" />} label="Part agence cumulée" value={fmt(profil.totalPartAgence)} />
          <MetricItem icon={<Users className="h-4 w-4 text-muted-foreground" />} label="Part profil cumulée" value={fmt(profil.totalPartProfil)} />
          <button
            type="button"
            onClick={onView}
            className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 flex items-start gap-2 text-left hover:bg-red-100 hover:border-red-300 transition-colors"
          >
            <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-red-700 font-medium leading-tight uppercase tracking-wide">Total fact. annulée</p>
              <p className="font-bold text-sm text-red-700">{fmt(profil.totalFactAnnulee)}</p>
            </div>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ===== DEBT ITEM (clickable, opens detail modal) ===== */
function DebtItem({
  label, amount, onClick, fmt,
}: {
  label: string;
  amount: number;
  onClick: () => void;
  fmt: (n: number) => string;
}) {
  const isZero = amount === 0;

  return (
    <button
      type="button"
      onClick={isZero ? undefined : onClick}
      disabled={isZero}
      className={`bg-orange-50 border border-orange-200 rounded-lg px-3 py-2.5 w-full text-left ${
        !isZero ? "cursor-pointer hover:bg-orange-100 hover:border-orange-300 transition-colors" : "cursor-default"
      }`}
      aria-label={isZero ? label : `${label} : voir les demandes liées`}
    >
      <p className="text-[11px] text-orange-700 font-medium leading-tight uppercase tracking-wide">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        {!isZero && <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0" />}
        <p className={`font-bold text-lg ${isZero ? "text-muted-foreground" : "text-orange-700"}`}>
          {isZero ? "—" : fmt(amount)}
        </p>
      </div>
    </button>
  );
}

function MetricItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded-lg px-3 py-2.5 flex items-start gap-2">
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
        <p className="font-semibold text-sm">{value}</p>
      </div>
    </div>
  );
}

function SoldeBadge({ solde, fmt }: { solde: number; fmt: (n: number) => string }) {
  if (solde === 0) return <Badge className="bg-green-100 text-green-800">Équilibré</Badge>;
  if (solde > 0) return <Badge className="bg-red-100 text-red-800">Doit {fmt(solde)}</Badge>;
  return <Badge className="bg-blue-100 text-blue-800">À verser {fmt(Math.abs(solde))}</Badge>;
}
