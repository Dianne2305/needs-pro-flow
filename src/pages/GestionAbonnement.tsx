/**
 * GestionAbonnement.tsx
 * Page "Gestion Abonnement" : vue centralisée des abonnements et interventions.
 * Onglets :
 *  - Abonnements actifs
 *  - Abonnements arrivant à échéance (≤ 7 jours)
 *  - Abonnements suspendus (paiement non reçu)
 *  - Interventions prévues aujourd'hui
 *  - Interventions prévues demain
 *  - Factures à générer
 *  - Factures impayées
 */
import { useMemo, useState } from "react";
import AbonnementActionsModal, { AbonnementAction } from "@/components/abonnement/AbonnementActionsModal";
import CalendrierAbonnementModal from "@/components/abonnement/CalendrierAbonnementModal";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, addDays, addMonths, parseISO, differenceInCalendarDays, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import {
  CalendarCheck, CalendarClock, PauseCircle, CalendarDays,
  Sun, Sunrise, FileText, FileWarning, Eye, Building2, User,
  Calendar as CalendarIcon, Pause, Search, X,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const FREQ_LABEL: Record<string, string> = {
  "1_fois_semaine": "1×/semaine", "2_fois_semaine": "2×/semaine", "3_fois_semaine": "3×/semaine",
  "4_fois_semaine": "4×/semaine", "5_fois_semaine": "5×/semaine", "6_fois_semaine": "6×/semaine",
  "quotidien": "Quotidien",
  "1_fois_mois": "1×/mois", "2_fois_mois": "2×/mois", "3_fois_mois": "3×/mois", "4_fois_mois": "4×/mois",
  "bi-hebdomadaire": "Bi-hebdo", "hebdomadaire": "Hebdo", "mensuel": "Mensuel", "abonnement": "Abonnement",
};

function getInitials(name?: string | null): string {
  if (!name) return "—";
  return name.trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() || "").join("") || "—";
}

function getSegment(d: Demande): "entreprise" | "particulier" {
  return d.nom_entreprise ? "entreprise" : "particulier";
}

function getNextIntervention(d: Demande, from: Date): Date | null {
  const list = getInterventionsBetween(d, from, addDays(from, 365));
  if (!list.length) return null;
  list.sort((a, b) => a.getTime() - b.getTime());
  return list[0];
}


type Demande = Tables<"demandes">;
type Facturation = Tables<"facturation">;

const FREQ_DAYS: Record<string, number> = {
  "1_fois_semaine": 7, "2_fois_semaine": 3, "3_fois_semaine": 2, "4_fois_semaine": 2,
  "5_fois_semaine": 1, "6_fois_semaine": 1, "quotidien": 1,
  "1_fois_mois": 30, "2_fois_mois": 15, "3_fois_mois": 10, "4_fois_mois": 7,
};

function isAbonnement(d: Demande) {
  return !!d.frequence && d.frequence !== "ponctuel";
}

function getStats(d: Demande) {
  const planning = d.planning as any;
  let total = 0, effectuees = 0, annulees = 0;
  let maxDate: Date | null = null;
  if (planning?.semaines?.length) {
    for (const sem of planning.semaines) {
      const base = sem.semaine_debut ? parseISO(sem.semaine_debut) : null;
      for (const j of sem.jours || []) {
        total++;
        if (j.statut === "terminee") effectuees++;
        else if (j.statut === "annule") annulees++;
        if (base) {
          const dt = addDays(base, typeof j.jour === "number" ? j.jour : 0);
          if (!maxDate || dt > maxDate) maxDate = dt;
        }
      }
    }
  }
  return { total, effectuees, annulees, restantes: Math.max(0, total - effectuees - annulees), dateFin: maxDate };
}

function getInterventionsBetween(d: Demande, from: Date, to: Date): Date[] {
  const out: Date[] = [];
  const planning = d.planning as any;
  if (planning?.semaines?.length) {
    for (const sem of planning.semaines) {
      const base = sem.semaine_debut ? parseISO(sem.semaine_debut) : null;
      if (!base) continue;
      for (const j of sem.jours || []) {
        if (j.statut === "terminee") continue;
        const date = addDays(base, typeof j.jour === "number" ? j.jour : 0);
        if (date >= from && date <= to) out.push(date);
      }
    }
    return out;
  }
  const start = d.date_prestation ? parseISO(d.date_prestation as unknown as string) : (d.confirmed_at ? new Date(d.confirmed_at) : null);
  if (!start) return out;
  const step = FREQ_DAYS[d.frequence || ""] || 7;
  let cur = new Date(start);
  while (cur <= to) {
    if (cur >= from) out.push(new Date(cur));
    cur = addDays(cur, step);
  }
  return out;
}

export default function GestionAbonnement() {
  const navigate = useNavigate();
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const tomorrow = useMemo(() => addDays(today, 1), [today]);
  const [actionState, setActionState] = useState<{ demande: Demande; action: AbonnementAction } | null>(null);
  const openAction = (demande: Demande, action: AbonnementAction) => setActionState({ demande, action });
  const [calendarDemande, setCalendarDemande] = useState<Demande | null>(null);

  const { data: demandes = [] } = useQuery({
    queryKey: ["demandes", "gestion-abonnement"],
    queryFn: async () => {
      const { data, error } = await supabase.from("demandes").select("*").neq("statut", "annulee").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Demande[];
    },
  });

  const { data: facturations = [] } = useQuery({
    queryKey: ["facturation", "gestion-abonnement"],
    queryFn: async () => {
      const { data, error } = await supabase.from("facturation").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Facturation[];
    },
  });

  const abonnements = useMemo(() => demandes.filter(isAbonnement), [demandes]);

  const abosEnriched = useMemo(() => abonnements.map((d) => {
    const s = getStats(d);
    const jFin = s.dateFin ? differenceInCalendarDays(s.dateFin, today) : null;
    return { d, stats: s, joursRestants: jFin };
  }), [abonnements, today]);

  const abosActifs = useMemo(
    () => abosEnriched.filter(({ d, stats, joursRestants }) =>
      (joursRestants === null || joursRestants >= 0)
      && (stats.total === 0 || stats.restantes > 0)
      && !["paye", "annulee", "facturation_annulee", "cloturee", "rejetee"].includes(d.statut as string)
    ),
    [abosEnriched]
  );

  const abosEcheance = useMemo(
    () => abosActifs.filter((e) => e.joursRestants !== null && e.joursRestants >= 0 && e.joursRestants <= 7),
    [abosActifs]
  );

  const abosSuspendus = useMemo(() => {
    // Un abonnement est suspendu si au moins une facture liée est impayée (non_paye / paiement_partiel)
    const impayesDemandeIds = new Set(
      facturations.filter((f) => ["non_paye", "paiement_partiel"].includes(f.statut_paiement)).map((f) => f.demande_id)
    );
    return abosEnriched.filter(({ d }) => impayesDemandeIds.has(d.id));
  }, [abosEnriched, facturations]);

  const interventionsToday = useMemo(() => {
    const list: { d: Demande; date: Date }[] = [];
    for (const { d } of abosEnriched) {
      for (const date of getInterventionsBetween(d, today, today)) {
        if (isSameDay(date, today)) list.push({ d, date });
      }
    }
    // Ajouter aussi les demandes ponctuelles prévues aujourd'hui
    for (const d of demandes) {
      if (isAbonnement(d)) continue;
      const start = d.date_prestation ? parseISO(d.date_prestation as unknown as string) : null;
      if (start && isSameDay(start, today)) list.push({ d, date: start });
    }
    return list;
  }, [abosEnriched, demandes, today]);

  const interventionsTomorrow = useMemo(() => {
    const list: { d: Demande; date: Date }[] = [];
    for (const { d } of abosEnriched) {
      for (const date of getInterventionsBetween(d, tomorrow, tomorrow)) {
        if (isSameDay(date, tomorrow)) list.push({ d, date });
      }
    }
    for (const d of demandes) {
      if (isAbonnement(d)) continue;
      const start = d.date_prestation ? parseISO(d.date_prestation as unknown as string) : null;
      if (start && isSameDay(start, tomorrow)) list.push({ d, date: start });
    }
    return list;
  }, [abosEnriched, demandes, tomorrow]);

  // Factures à générer : prestations terminées sans ligne de facturation
  const facturesAGenerer = useMemo(() => {
    const facturationDemandeIds = new Set(facturations.map((f) => f.demande_id));
    return demandes.filter((d) =>
      (d.statut === "prestation_effectuee" || d.statut === "termine" || d.statut === "terminee")
      && !facturationDemandeIds.has(d.id)
    );
  }, [demandes, facturations]);

  // Factures impayées
  const facturesImpayees = useMemo(
    () => facturations.filter((f) => ["non_paye", "paiement_partiel"].includes(f.statut_paiement)),
    [facturations]
  );

  // Filtres
  type KpiKey = "actifs" | "echeance" | "suspendus" | "today" | "tomorrow" | "a-generer" | "impayees";
  const [activeKpi, setActiveKpi] = useState<KpiKey>("actifs");
  const [searchNom, setSearchNom] = useState("");
  const [dateDu, setDateDu] = useState("");
  const [dateAu, setDateAu] = useState("");

  const matchesNom = (name?: string | null) =>
    !searchNom.trim() || (name || "").toLowerCase().includes(searchNom.trim().toLowerCase());

  const matchesAbonnementDate = (d: Demande, stats: ReturnType<typeof getStats>) => {
    if (!dateDu && !dateAu) return true;
    const debut = d.date_prestation ? parseISO(d.date_prestation as unknown as string) : (d.confirmed_at ? new Date(d.confirmed_at) : null);
    const fin = stats.dateFin;
    const from = dateDu ? parseISO(dateDu) : null;
    const to = dateAu ? parseISO(dateAu) : null;
    // On garde s'il y a chevauchement entre [debut, fin] et [from, to]
    if (from && fin && fin < from) return false;
    if (to && debut && debut > to) return false;
    return true;
  };
  const matchesInterventionDate = (date: Date) => {
    if (dateDu && date < parseISO(dateDu)) return false;
    if (dateAu && date > parseISO(dateAu)) return false;
    return true;
  };
  const matchesFactureDate = (dateStr?: string | null) => {
    if (!dateDu && !dateAu) return true;
    if (!dateStr) return false;
    const dt = parseISO(dateStr);
    if (dateDu && dt < parseISO(dateDu)) return false;
    if (dateAu && dt > parseISO(dateAu)) return false;
    return true;
  };

  const abosActifsF = useMemo(() => abosActifs.filter(({ d, stats }) => matchesNom(d.nom_entreprise || d.nom) && matchesAbonnementDate(d, stats)), [abosActifs, searchNom, dateDu, dateAu]);
  const abosEcheanceF = useMemo(() => abosEcheance.filter(({ d, stats }) => matchesNom(d.nom_entreprise || d.nom) && matchesAbonnementDate(d, stats)), [abosEcheance, searchNom, dateDu, dateAu]);
  const abosSuspendusF = useMemo(() => abosSuspendus.filter(({ d, stats }) => matchesNom(d.nom_entreprise || d.nom) && matchesAbonnementDate(d, stats)), [abosSuspendus, searchNom, dateDu, dateAu]);
  const interventionsTodayF = useMemo(() => interventionsToday.filter(({ d, date }) => matchesNom(d.nom_entreprise || d.nom) && matchesInterventionDate(date)), [interventionsToday, searchNom, dateDu, dateAu]);
  const interventionsTomorrowF = useMemo(() => interventionsTomorrow.filter(({ d, date }) => matchesNom(d.nom_entreprise || d.nom) && matchesInterventionDate(date)), [interventionsTomorrow, searchNom, dateDu, dateAu]);
  const facturesAGenererF = useMemo(() => facturesAGenerer.filter((d) => matchesNom(d.nom_entreprise || d.nom) && matchesFactureDate(d.date_prestation as unknown as string)), [facturesAGenerer, searchNom, dateDu, dateAu]);
  const facturesImpayeesF = useMemo(() => facturesImpayees.filter((f) => matchesNom(f.nom_client) && matchesFactureDate(f.date_intervention as unknown as string)), [facturesImpayees, searchNom, dateDu, dateAu]);

  const resetFilters = () => { setSearchNom(""); setDateDu(""); setDateAu(""); };
  const hasFilters = !!(searchNom || dateDu || dateAu);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Gestion Abonnement</h1>
        <p className="text-sm text-muted-foreground">Vue centralisée des abonnements, interventions et facturation</p>
      </div>

      {/* KPI Cards cliquables = filtres */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KpiCard label="Actifs" value={abosActifs.length} icon={<CalendarCheck className="h-5 w-5" />} gradient="from-emerald-500 to-emerald-600" active={activeKpi==="actifs"} onClick={() => setActiveKpi("actifs")} />
        <KpiCard label="À échéance ≤ 7j" value={abosEcheance.length} icon={<CalendarClock className="h-5 w-5" />} gradient="from-amber-400 to-orange-500" active={activeKpi==="echeance"} onClick={() => setActiveKpi("echeance")} />
        <KpiCard label="Suspendus" value={abosSuspendus.length} icon={<PauseCircle className="h-5 w-5" />} gradient="from-red-500 to-rose-600" active={activeKpi==="suspendus"} onClick={() => setActiveKpi("suspendus")} />
        <KpiCard label="Aujourd'hui" value={interventionsToday.length} icon={<Sun className="h-5 w-5" />} gradient="from-cyan-500 to-cyan-600" active={activeKpi==="today"} onClick={() => setActiveKpi("today")} />
        <KpiCard label="Demain" value={interventionsTomorrow.length} icon={<Sunrise className="h-5 w-5" />} gradient="from-sky-500 to-blue-600" active={activeKpi==="tomorrow"} onClick={() => setActiveKpi("tomorrow")} />
        <KpiCard label="À générer" value={facturesAGenerer.length} icon={<FileText className="h-5 w-5" />} gradient="from-violet-500 to-purple-600" active={activeKpi==="a-generer"} onClick={() => setActiveKpi("a-generer")} />
        <KpiCard label="Impayées" value={facturesImpayees.length} icon={<FileWarning className="h-5 w-5" />} gradient="from-rose-500 to-red-600" active={activeKpi==="impayees"} onClick={() => setActiveKpi("impayees")} />
      </div>

      {/* Filtres nom + dates */}
      <Card className="p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <Label className="text-xs">Nom du client</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={searchNom} onChange={(e) => setSearchNom(e.target.value)} placeholder="Rechercher un client…" className="pl-8" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Du</Label>
            <Input type="date" value={dateDu} onChange={(e) => setDateDu(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Au</Label>
            <Input type="date" value={dateAu} onChange={(e) => setDateAu(e.target.value)} />
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters}><X className="h-4 w-4 mr-1" />Réinitialiser</Button>
          )}
        </div>
      </Card>

      {/* Contenu selon KPI actif */}
      {activeKpi === "actifs" && <AbonnementTable rows={abosActifsF} navigate={navigate} facturations={facturations} today={today} openAction={openAction} openCalendar={setCalendarDemande} />}
      {activeKpi === "echeance" && <AbonnementTable rows={abosEcheanceF} navigate={navigate} facturations={facturations} today={today} highlightEcheance openAction={openAction} openCalendar={setCalendarDemande} />}
      {activeKpi === "suspendus" && <AbonnementTable rows={abosSuspendusF} navigate={navigate} facturations={facturations} today={today} forceStatut="suspendu" openAction={openAction} openCalendar={setCalendarDemande} />}
      {activeKpi === "today" && <InterventionTable rows={interventionsTodayF} navigate={navigate} />}
      {activeKpi === "tomorrow" && <InterventionTable rows={interventionsTomorrowF} navigate={navigate} />}
      {activeKpi === "a-generer" && <FactureAGenererTable rows={facturesAGenererF} navigate={navigate} />}
      {activeKpi === "impayees" && <FactureImpayeeTable rows={facturesImpayeesF} navigate={navigate} />}

      <AbonnementActionsModal
        demande={actionState?.demande ?? null}
        action={actionState?.action ?? null}
        onClose={() => setActionState(null)}
      />
      <CalendrierAbonnementModal
        demande={calendarDemande}
        open={!!calendarDemande}
        onClose={() => setCalendarDemande(null)}
      />
    </div>
  );
}

function KpiCard({ label, value, icon, gradient, onClick, active }: { label: string; value: number | string; icon: React.ReactNode; gradient: string; onClick?: () => void; active?: boolean }) {
  return (
    <Card
      onClick={onClick}
      className={`p-3 bg-gradient-to-br ${gradient} text-white border-0 ${onClick ? "cursor-pointer hover:brightness-110 transition" : ""} ${active ? "ring-2 ring-offset-2 ring-white/80 brightness-110" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium opacity-90">{label}</div>
          <div className="text-2xl font-bold mt-1">{value}</div>
        </div>
        <div className="opacity-90">{icon}</div>
      </div>
    </Card>
  );
}

function AbonnementTable({
  rows, navigate, highlightEcheance, forceStatut, facturations = [], today, openAction, openCalendar,
}: {
  rows: { d: Demande; stats: ReturnType<typeof getStats>; joursRestants: number | null }[];
  navigate: ReturnType<typeof useNavigate>;
  highlightEcheance?: boolean;
  forceStatut?: "actif" | "echeance" | "suspendu";
  facturations?: Facturation[];
  today: Date;
  openAction: (d: Demande, action: AbonnementAction) => void;
  openCalendar: (d: Demande) => void;
}) {
  if (!rows.length) return <EmptyState label="Aucun abonnement" />;
  return (
    <TooltipProvider delayDuration={200}>
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N° Abo</TableHead>
              <TableHead>Com.</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Quartier / Ville</TableHead>
              <TableHead>Type de service</TableHead>
              <TableHead>Fréq / Dates</TableHead>
              <TableHead className="min-w-[160px]">Interventions</TableHead>
              <TableHead>Prochaine intervention</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Paiement</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ d, stats, joursRestants }) => {
              const impaye = facturations
                .filter((f) => f.demande_id === d.id && ["non_paye", "paiement_partiel"].includes(f.statut_paiement))
                .reduce((s, f) => s + (Number(f.montant_total) - Number(f.montant_paye_client || 0)), 0);
              const enRetard = impaye > 0;
              const statut: "actif" | "echeance" | "suspendu" =
                forceStatut ?? (enRetard ? "suspendu" : (joursRestants !== null && joursRestants <= 7 ? "echeance" : "actif"));
              const statutMeta = {
                actif: { dot: "bg-emerald-500", label: "Actif", cls: "bg-emerald-100 text-emerald-800" },
                echeance: { dot: "bg-amber-500", label: "À échéance", cls: "bg-amber-100 text-amber-800" },
                suspendu: { dot: "bg-red-500", label: "Suspendu", cls: "bg-red-100 text-red-800" },
              }[statut];
              const dateDebut = d.date_prestation ? parseISO(d.date_prestation as unknown as string) : (d.confirmed_at ? new Date(d.confirmed_at) : null);
              const finProche = stats.dateFin && joursRestants !== null && joursRestants >= 0 && joursRestants < 30;
              const segment = getSegment(d);
              const nextDate = getNextIntervention(d, today);
              const progressPct = stats.total > 0 ? Math.round((stats.effectuees / stats.total) * 100) : 0;
              const commercial = d.commercial || d.commercial_createur || "";
              const freqLabel = d.frequence ? (FREQ_LABEL[d.frequence] || d.frequence) : "—";

              return (
                <TableRow key={d.id}>
                  {/* N° Abo */}
                  <TableCell>
                    <button
                      onClick={() => navigate(`/compte-client?id=${d.id}&from=/gestion-abonnement`)}
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      #{d.num_demande}
                    </button>
                  </TableCell>
                  {/* Commercial abréviation + tooltip */}
                  <TableCell>
                    {commercial ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-indigo-100 text-indigo-800 text-xs font-semibold cursor-default">
                            {getInitials(commercial)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{commercial}</TooltipContent>
                      </Tooltip>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  {/* Client + icône segment */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {segment === "entreprise" ? (
                            <Building2 className="h-4 w-4 text-violet-600 shrink-0" />
                          ) : (
                            <User className="h-4 w-4 text-sky-600 shrink-0" />
                          )}
                        </TooltipTrigger>
                        <TooltipContent>{segment === "entreprise" ? "Entreprise" : "Particulier"}</TooltipContent>
                      </Tooltip>
                      <span className="font-medium">{d.nom_entreprise || d.nom}</span>
                    </div>
                  </TableCell>
                  {/* Quartier / Ville */}
                  <TableCell className="text-sm">
                    {d.quartier ? <div>{d.quartier}</div> : null}
                    <div className="text-xs text-muted-foreground">{d.ville || "—"}</div>
                  </TableCell>
                  {/* Type service */}
                  <TableCell className="text-sm">{d.type_prestation || d.type_service || "—"}</TableCell>
                  {/* Fréquence + Début/Fin */}
                  <TableCell>
                    <div className="space-y-1 text-xs">
                      <Badge variant="outline" className="text-xs">{freqLabel}</Badge>
                      <div className="text-muted-foreground">
                        {dateDebut ? format(dateDebut, "dd/MM/yy", { locale: fr }) : "—"} → {stats.dateFin ? format(stats.dateFin, "dd/MM/yy", { locale: fr }) : "—"}
                        {finProche && <Badge className="ml-1 bg-red-100 text-red-800 text-[10px] px-1.5 py-0">Fin {joursRestants}j</Badge>}
                      </div>
                    </div>
                  </TableCell>
                  {/* Interventions : faites / prévues + annulées */}
                  <TableCell>
                    <div className="space-y-1 min-w-[140px]">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold">{stats.effectuees}/{stats.total}</span>
                        <span className="text-muted-foreground">{progressPct}%</span>
                      </div>
                      <Progress value={progressPct} className="h-2" />
                      {stats.annulees > 0 && (
                        <Badge className="bg-rose-100 text-rose-800 text-[10px] px-1.5 py-0">
                          {stats.annulees} annulée{stats.annulees > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  {/* Prochaine intervention */}
                  <TableCell className="text-xs">
                    {nextDate ? (
                      <div>
                        <div className="font-semibold">{format(nextDate, "EEE dd MMM", { locale: fr })}</div>
                        <div className="text-muted-foreground">
                          {d.heure_prestation || "—"} · {d.candidat_nom || <span className="italic">Non affecté</span>}
                        </div>
                      </div>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  {/* Statut pastille */}
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${statutMeta.dot}`} />
                      <Badge className={statutMeta.cls}>{statutMeta.label}</Badge>
                    </div>
                  </TableCell>
                  {/* Paiement */}
                  <TableCell>
                    {enRetard ? (
                      <div className="text-xs">
                        <Badge className="bg-red-100 text-red-800">En retard</Badge>
                        <div className="mt-0.5 font-semibold text-red-600">{Math.round(impaye).toLocaleString("fr-FR")} DH</div>
                      </div>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-800">À jour</Badge>
                    )}
                  </TableCell>
                  {/* Actions */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigate(`/compte-client?id=${d.id}&from=/gestion-abonnement&section=gestion-abonnement`)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Voir gestion de l'abonnement</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-amber-600" onClick={() => openAction(d, "suspendre")}>
                            <Pause className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Suspendre</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600" onClick={() => openCalendar(d)}>
                            <CalendarIcon className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Voir calendrier de l'abonnement</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}


function InterventionTable({ rows, navigate }: { rows: { d: Demande; date: Date }[]; navigate: ReturnType<typeof useNavigate> }) {
  if (!rows.length) return <EmptyState label="Aucune intervention prévue" />;
  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>N°</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Ville / Quartier</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>Profil affecté</TableHead>
            <TableHead>Heure</TableHead>
            <TableHead>Téléphone</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ d, date }, i) => (
            <TableRow key={`${d.id}-${i}`}>
              <TableCell className="font-mono text-xs">#{d.num_demande}</TableCell>
              <TableCell className="font-medium">{d.nom}</TableCell>
              <TableCell>{d.ville} {d.quartier ? `— ${d.quartier}` : ""}</TableCell>
              <TableCell>{d.type_prestation}</TableCell>
              <TableCell>{(d as any).profil_nom || <span className="text-muted-foreground">Non affecté</span>}</TableCell>
              <TableCell>{(d as any).heure_debut || "—"}</TableCell>
              <TableCell className="font-mono text-xs">{d.telephone_direct}</TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="ghost" onClick={() => navigate(`/compte-client?id=${d.id}`)}>
                  <Eye className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function FactureAGenererTable({ rows, navigate }: { rows: Demande[]; navigate: ReturnType<typeof useNavigate> }) {
  if (!rows.length) return <EmptyState label="Aucune facture à générer" />;
  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>N°</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>Date prestation</TableHead>
            <TableHead>Montant</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((d) => (
            <TableRow key={d.id}>
              <TableCell className="font-mono text-xs">#{d.num_demande}</TableCell>
              <TableCell className="font-medium">{d.nom}</TableCell>
              <TableCell>{d.type_prestation}</TableCell>
              <TableCell>{d.date_prestation ? format(parseISO(d.date_prestation as unknown as string), "dd MMM yyyy", { locale: fr }) : "—"}</TableCell>
              <TableCell className="font-semibold">{Number(d.montant_total || 0).toLocaleString("fr-FR")} DH</TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="ghost" onClick={() => navigate(`/gestion-financiere`)}>
                  <FileText className="h-4 w-4 mr-1" /> Générer
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function FactureImpayeeTable({ rows, navigate }: { rows: Facturation[]; navigate: ReturnType<typeof useNavigate> }) {
  if (!rows.length) return <EmptyState label="Aucune facture impayée" />;
  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mission</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Payé</TableHead>
            <TableHead>Reste dû</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((f) => {
            const reste = Number(f.montant_total) - Number(f.montant_paye_client || 0);
            return (
              <TableRow key={f.id}>
                <TableCell className="font-mono text-xs">#{f.num_mission}</TableCell>
                <TableCell className="font-medium">{f.nom_client}</TableCell>
                <TableCell>{f.type_service}</TableCell>
                <TableCell>{f.date_intervention ? format(parseISO(f.date_intervention as unknown as string), "dd MMM yyyy", { locale: fr }) : "—"}</TableCell>
                <TableCell>{Number(f.montant_total).toLocaleString("fr-FR")} DH</TableCell>
                <TableCell>{Number(f.montant_paye_client || 0).toLocaleString("fr-FR")} DH</TableCell>
                <TableCell className="font-semibold text-red-600">{Math.round(reste).toLocaleString("fr-FR")} DH</TableCell>
                <TableCell>
                  <Badge className={f.statut_paiement === "paiement_partiel" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}>
                    {f.statut_paiement === "paiement_partiel" ? "Partiel" : "Non payé"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/gestion-financiere`)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="border rounded-lg p-12 text-center text-muted-foreground">
      <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-40" />
      <p>{label}</p>
    </div>
  );
}
