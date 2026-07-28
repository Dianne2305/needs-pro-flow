/**
 * GestionAbonnement.tsx
 * Page "Gestion Abonnement" : vue centralisée des abonnements et interventions.
 * Onglets :
 *  - Abonnements actifs
 *  - Abonnements arrivant à échéance (≤ 15 jours)
 *  - Abonnements suspendus (paiement non reçu)
 *  - Interventions prévues aujourd'hui
 *  - Interventions prévues demain
 *  - Factures à générer
 *  - Factures impayées
 */
import { useCallback, useMemo, useState } from "react";
import AbonnementActionsModal, { AbonnementAction } from "@/components/abonnement/AbonnementActionsModal";
import CalendrierAbonnementModal from "@/components/abonnement/CalendrierAbonnementModal";
import CycleFacturationPanel from "@/components/abonnement/CycleFacturationPanel";
import PlanningMoisPanel, { PlanningEntry } from "@/components/abonnement/PlanningMoisPanel";


import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

const DAY_MAP: Record<string, number> = {
  dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6,
};

/** Parse "YYYY-MM-DD" as a local Date at noon — évite tout décalage de timezone. */
function parseYMD(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

function isAbonnement(d: Demande) {
  return !!d.frequence && d.frequence !== "ponctuel";
}

/**
 * Reconstruit l'ensemble des dates d'intervention d'un abonnement,
 * en suivant exactement la même logique que CalendrierAbonnementModal / CompteClient
 * (planning.abo_jours + date_debut + date_fin + date_overrides + abo_frequence).
 */
function buildPlanningDates(d: Demande): {
  dates: { key: string; date: Date; statut: "a_venir" | "termine" | "annule" | "a_recuperer" }[];
  start: Date | null;
  end: Date | null;
} {
  const p = ((d as any).planning || {}) as any;
  const aboJours: { jour: string }[] = Array.isArray(p.abo_jours)
    ? p.abo_jours
    : Array.isArray(p.jours)
      ? p.jours.map((j: any) => (typeof j === "string" ? { jour: j } : j))
      : [];
  const overrides: Record<string, { heure?: string; excluded?: boolean; statut?: "termine" | "annule" | "a_recuperer" | null; reprogrammed_to?: string | null; reprogrammed_from?: string | null }> = p.date_overrides || {};
  const aboFrequence: string = p.abo_frequence || p.frequence || d.frequence || "";
  const selectedDows = aboJours.map((j) => DAY_MAP[j.jour]).filter((n) => n !== undefined);

  let start: Date | null = null;
  const dateDebutStr = p.date_debut || (d.date_prestation as unknown as string) || null;
  if (dateDebutStr) { try { start = parseYMD(dateDebutStr); } catch { start = null; } }
  let end: Date | null = null;
  const dateFinStr: string | null = p.date_fin || null;
  if (dateFinStr) { try { end = parseYMD(dateFinStr); } catch { end = null; } }
  if (!end && start) end = addMonths(start, typeof p.duree_mois === "number" ? p.duree_mois : 1);

  const pattern = new Set<string>();
  if (start && end && selectedDows.length > 0) {
    const startMs = start.getTime();
    const seenMonth = new Set<string>();
    for (let cur = new Date(start); cur <= end; cur = new Date(cur.getTime() + 86400000)) {
      if (!selectedDows.includes(cur.getDay())) continue;
      if (aboFrequence === "bi_hebdomadaire") {
        const w = Math.floor((cur.getTime() - startMs) / (7 * 86400000));
        if (w % 2 !== 0) continue;
      }
      if (aboFrequence === "1_fois_mois") {
        const k = `${cur.getFullYear()}-${cur.getMonth()}-${cur.getDay()}`;
        if (seenMonth.has(k)) continue;
        seenMonth.add(k);
      }
      pattern.add(format(cur, "yyyy-MM-dd"));
    }
  }

  const allKeys = new Set<string>(pattern);
  for (const k of Object.keys(overrides)) {
    const ov = overrides[k];
    if (ov?.excluded) continue;
    // Un override "à récupérer" ou "reporté" (heure définie) doit apparaître aussi.
    if (ov?.heure || ov?.statut === "a_recuperer") allKeys.add(k);
  }

  const list: { key: string; date: Date; statut: "a_venir" | "termine" | "annule" | "a_recuperer" }[] = [];
  for (const k of allKeys) {
    const ov = overrides[k];
    if (ov?.excluded) continue;
    const dt = parseYMD(k);
    const statut =
      ov?.statut === "termine" ? "termine"
      : ov?.statut === "annule" ? "annule"
      : ov?.statut === "a_recuperer" ? "a_recuperer"
      : "a_venir";
    list.push({ key: k, date: dt, statut });
  }
  list.sort((a, b) => a.date.getTime() - b.date.getTime());
  return { dates: list, start, end };
}

function getStats(d: Demande) {
  const { dates, end } = buildPlanningDates(d);
  let total = 0, effectuees = 0, annulees = 0, aRecuperer = 0;
  for (const it of dates) {
    // "a_recuperer" ne compte pas dans le total (déjà payée mais à reporter)
    if (it.statut === "a_recuperer") { aRecuperer++; continue; }
    total++;
    if (it.statut === "termine") effectuees++;
    else if (it.statut === "annule") annulees++;
  }
  return {
    total,
    effectuees,
    annulees,
    aRecuperer,
    restantes: Math.max(0, total - effectuees - annulees),
    dateFin: end || (dates.length ? dates[dates.length - 1].date : null),
  };
}

function getInterventionsBetween(d: Demande, from: Date, to: Date): Date[] {
  const { dates } = buildPlanningDates(d);
  const out: Date[] = [];
  for (const it of dates) {
    if (it.statut !== "a_venir") continue;
    if (it.date >= from && it.date <= to) out.push(it.date);
  }
  return out;
}

// ============================================================
// Données mock affichées par défaut quand une catégorie est vide
// (permet de visualiser l'UI même sans données en base)
// ============================================================
function _mockDemande(overrides: Record<string, any>): Demande {
  return ({
    id: `mock-${overrides.num_demande}`,
    frequence: "2_fois_semaine",
    ville: "Casablanca",
    quartier: "Maârif",
    type_prestation: "Ménage standard",
    type_service: "Ménage standard",
    heure_prestation: "09:00",
    montant_total: 1200,
    commercial: "Kaoutar",
    telephone_direct: "+212 6 00 00 00 00",
    ...overrides,
  }) as unknown as Demande;
}

function MOCK_ABOS_ECHEANCE(today: Date) {
  const mk = (num: string, nom: string, joursRestants: number, quartier: string, service: string) => {
    const dateFin = addDays(today, joursRestants);
    const dateDebut = addMonths(dateFin, -1);
    const d = _mockDemande({
      num_demande: num, nom, quartier, type_prestation: service, type_service: service,
      date_prestation: format(dateDebut, "yyyy-MM-dd") as any,
    });
    const stats = { total: 8, effectuees: 6, annulees: 0, aRecuperer: 1, restantes: 2, dateFin } as ReturnType<typeof getStats>;
    return { d, stats, joursRestants };
  };
  return [
    mk("A-1042", "Yasmine Alaoui", 3, "Gauthier", "Ménage standard"),
    mk("A-1043", "Karim Benjelloun", 8, "Anfa", "Grand ménage"),
    mk("A-1044", "SARL Nova Bureaux", 12, "Sidi Maarouf", "Ménage Bureaux"),
    mk("A-1045", "Nadia El Fassi", 14, "Racine", "Ménage standard"),
  ];
}

function MOCK_ABOS_SUSPENDUS(today: Date) {
  const mk = (num: string, nom: string, quartier: string, service: string) => {
    const dateFin = addDays(today, 20);
    const dateDebut = addMonths(dateFin, -1);
    const d = _mockDemande({
      num_demande: num, nom, quartier, type_prestation: service, type_service: service,
      date_prestation: format(dateDebut, "yyyy-MM-dd") as any,
      statut: "suspendu" as any,
    });
    const stats = { total: 8, effectuees: 4, annulees: 1, aRecuperer: 0, restantes: 3, dateFin } as ReturnType<typeof getStats>;
    return { d, stats, joursRestants: 20 };
  };
  return [
    mk("A-1020", "Salma Chraibi", "Bourgogne", "Ménage standard"),
    mk("A-1021", "Groupe Atlas SA", "Ain Diab", "Ménage Bureaux"),
    mk("A-1022", "Youssef Berrada", "Californie", "Ménage Air BnB"),
  ];
}

function MOCK_INTERVENTIONS(date: Date) {
  const mk = (num: string, nom: string, quartier: string, service: string, heure: string, profil: string, tel: string) => ({
    d: _mockDemande({
      num_demande: num, nom, quartier, type_prestation: service, type_service: service,
      heure_prestation: heure, telephone_direct: tel,
      profil_nom: profil, heure_debut: heure,
    }),
    date,
  });
  return [
    mk("I-2051", "Leila Amrani", "Maârif", "Ménage standard", "09:00", "Fatima Zahra", "+212 6 61 12 34 56"),
    mk("I-2052", "Omar Tazi", "Anfa", "Grand ménage", "10:30", "Aicha Bennani", "+212 6 62 78 90 12"),
    mk("I-2053", "Résidence Palm", "Bouskoura", "Ménage standard", "14:00", "Nadia Idrissi", "+212 6 63 45 67 89"),
    mk("I-2054", "Rachid Bennis", "Gauthier", "Ménage Air BnB", "16:00", "Sanaa Kabbaj", "+212 6 64 23 45 67"),
  ];
}

const MOCK_FACTURES_A_GENERER: Demande[] = [
  _mockDemande({ num_demande: "F-3071", nom: "Hassan El Yamani", montant_total: 900, date_prestation: format(new Date(), "yyyy-MM-dd") as any }),
  _mockDemande({ num_demande: "F-3072", nom: "Amine Cherkaoui", type_prestation: "Grand ménage", montant_total: 1800, date_prestation: format(addDays(new Date(), -2), "yyyy-MM-dd") as any }),
  _mockDemande({ num_demande: "F-3073", nom: "SARL Horizon", type_prestation: "Ménage Bureaux", montant_total: 2400, date_prestation: format(addDays(new Date(), -1), "yyyy-MM-dd") as any }),
];

export default function GestionAbonnement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const tomorrow = useMemo(() => addDays(today, 1), [today]);
  const [actionState, setActionState] = useState<{ demande: Demande; action: AbonnementAction } | null>(null);
  const openAction = (demande: Demande, action: AbonnementAction) => setActionState({ demande, action });
  const [calendarDemande, setCalendarDemande] = useState<Demande | null>(null);

  const suspendreDemande = async (d: Demande) => {
    if (!window.confirm(`Suspendre l'abonnement #${d.num_demande} — ${d.nom_entreprise || d.nom} ?`)) return;
    const { error } = await supabase
      .from("demandes")
      .update({ statut: "suspendu", motif_annulation: "Suspendu depuis Gestion Abonnement" })
      .eq("id", d.id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["demandes"] });
    toast({ title: "Abonnement suspendu", description: `#${d.num_demande} · ${d.nom_entreprise || d.nom}` });
  };

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
    () => abosActifs.filter((e) => e.joursRestants !== null && e.joursRestants >= 0 && e.joursRestants <= 15),
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

  // Toutes les interventions (abonnements + ponctuelles) sur une période donnée
  const getPlanningEntries = useCallback((from: Date, to: Date): PlanningEntry[] => {
    const list: PlanningEntry[] = [];
    for (const { d } of abosEnriched) {
      for (const it of buildPlanningDates(d).dates) {
        if (it.date < from || it.date > to) continue;
        list.push({
          date: it.date,
          service: d.type_prestation || (d as any).type_service,
          ville: d.ville,
          commercial: d.commercial || d.commercial_createur,
          statut: it.statut,
        });
      }
    }
    for (const d of demandes) {
      if (isAbonnement(d)) continue;
      const start = d.date_prestation ? parseISO(d.date_prestation as unknown as string) : null;
      if (start && start >= from && start <= to) {
        list.push({
          date: start,
          service: d.type_prestation || (d as any).type_service,
          ville: d.ville,
          commercial: d.commercial || d.commercial_createur,
          statut: ["prestation_effectuee", "termine", "terminee"].includes(d.statut) ? "termine"
            : d.statut === "annule" ? "annule" : "a_venir",
        });
      }
    }
    return list;
  }, [abosEnriched, demandes]);



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
  type KpiKey = "actifs" | "echeance" | "suspendus" | "today" | "tomorrow" | "a-generer";
  type MainTab = "abonnement" | "planning" | "facturation";
  const [mainTab, setMainTab] = useState<MainTab>("abonnement");
  const [activeKpi, setActiveKpi] = useState<KpiKey>("actifs");
  const [searchNom, setSearchNom] = useState("");
  const [dateDu, setDateDu] = useState("");
  const [dateAu, setDateAu] = useState("");
  const [filtreService, setFiltreService] = useState("all");
  const [filtreCommercial, setFiltreCommercial] = useState("all");
  const [filtreVille, setFiltreVille] = useState("all");

  const uniq = (arr: (string | null | undefined)[]) =>
    Array.from(new Set(arr.filter((v): v is string => !!v && !!v.trim()))).sort((a, b) => a.localeCompare(b));
  const servicesOptions = useMemo(
    () => uniq([...demandes.map((d) => d.type_prestation || d.type_service), ...facturations.map((f) => f.type_service)]),
    [demandes, facturations]
  );
  const commerciauxOptions = useMemo(
    () => uniq([...demandes.map((d) => d.commercial || d.commercial_createur), ...facturations.map((f) => f.commercial)]),
    [demandes, facturations]
  );
  const villesOptions = useMemo(
    () => uniq([...demandes.map((d) => d.ville), ...facturations.map((f) => f.ville)]),
    [demandes, facturations]
  );

  const matchesNom = (name?: string | null) =>
    !searchNom.trim() || (name || "").toLowerCase().includes(searchNom.trim().toLowerCase());

  const matchesDemande = (d: Demande) =>
    (filtreService === "all" || (d.type_prestation || d.type_service) === filtreService) &&
    (filtreCommercial === "all" || (d.commercial || d.commercial_createur) === filtreCommercial) &&
    (filtreVille === "all" || d.ville === filtreVille);

  const matchesFacture = (f: any) =>
    (filtreService === "all" || f.type_service === filtreService) &&
    (filtreCommercial === "all" || f.commercial === filtreCommercial) &&
    (filtreVille === "all" || f.ville === filtreVille);


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

  const deps = [searchNom, dateDu, dateAu, filtreService, filtreCommercial, filtreVille];
  const abosActifsF = useMemo(() => abosActifs.filter(({ d, stats }) => matchesNom(d.nom_entreprise || d.nom) && matchesDemande(d) && matchesAbonnementDate(d, stats)), [abosActifs, ...deps]);
  const abosEcheanceF = useMemo(() => abosEcheance.filter(({ d, stats }) => matchesNom(d.nom_entreprise || d.nom) && matchesDemande(d) && matchesAbonnementDate(d, stats)), [abosEcheance, ...deps]);
  const abosSuspendusF = useMemo(() => abosSuspendus.filter(({ d, stats }) => matchesNom(d.nom_entreprise || d.nom) && matchesDemande(d) && matchesAbonnementDate(d, stats)), [abosSuspendus, ...deps]);
  const interventionsTodayF = useMemo(() => interventionsToday.filter(({ d, date }) => matchesNom(d.nom_entreprise || d.nom) && matchesDemande(d) && matchesInterventionDate(date)), [interventionsToday, ...deps]);
  const interventionsTomorrowF = useMemo(() => interventionsTomorrow.filter(({ d, date }) => matchesNom(d.nom_entreprise || d.nom) && matchesDemande(d) && matchesInterventionDate(date)), [interventionsTomorrow, ...deps]);
  const facturesAGenererF = useMemo(() => facturesAGenerer.filter((d) => matchesNom(d.nom_entreprise || d.nom) && matchesDemande(d) && matchesFactureDate(d.date_prestation as unknown as string)), [facturesAGenerer, ...deps]);
  const facturesImpayeesF = useMemo(() => facturesImpayees.filter((f) => matchesNom(f.nom_client) && matchesFacture(f) && matchesFactureDate(f.date_intervention as unknown as string)), [facturesImpayees, ...deps]);

  const resetFilters = () => { setSearchNom(""); setDateDu(""); setDateAu(""); setFiltreService("all"); setFiltreCommercial("all"); setFiltreVille("all"); };
  const hasFilters = !!(searchNom || dateDu || dateAu) || filtreService !== "all" || filtreCommercial !== "all" || filtreVille !== "all";


  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Gestion Abonnement</h1>
        <p className="text-sm text-muted-foreground">Vue centralisée des abonnements, interventions et facturation</p>
      </div>

      <Tabs
        value={mainTab}
        onValueChange={(v) => {
          const t = v as MainTab;
          setMainTab(t);
          setActiveKpi(t === "abonnement" ? "actifs" : t === "planning" ? "today" : "a-generer");
        }}
        className="space-y-4"
      >
        <TabsList className="w-full justify-center gap-2 bg-transparent p-0 h-auto">
          <TabsTrigger
            value="abonnement"
            className="text-2xl font-semibold h-14 px-8 rounded-md bg-muted text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-colors"
          >
            Vue d'ensemble Abonnement
          </TabsTrigger>
          <TabsTrigger
            value="planning"
            className="text-2xl font-semibold h-14 px-8 rounded-md bg-muted text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-colors"
          >
            Planning
          </TabsTrigger>
          <TabsTrigger
            value="facturation"
            className="text-2xl font-semibold h-14 px-8 rounded-md bg-muted text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-colors"
          >
            Facturation Abonnement
          </TabsTrigger>
        </TabsList>

        {/* KPI Cards cliquables = filtres */}
        {mainTab === "abonnement" && (
        <div className="flex flex-wrap justify-center gap-3 [&>*]:flex-1 [&>*]:min-w-[200px] [&>*]:max-w-[280px]">
          <KpiCard label="Actifs" value={abosActifs.length} icon={<CalendarCheck className="h-5 w-5" />} gradient="from-emerald-500 to-emerald-600" active={activeKpi==="actifs"} onClick={() => setActiveKpi("actifs")} />
          <KpiCard label="À échéance ≤ 15j" value={abosEcheance.length} icon={<CalendarClock className="h-5 w-5" />} gradient="from-amber-400 to-orange-500" active={activeKpi==="echeance"} onClick={() => setActiveKpi("echeance")} />
          <KpiCard label="Suspendus" value={abosSuspendus.length} icon={<PauseCircle className="h-5 w-5" />} gradient="from-red-500 to-rose-600" active={activeKpi==="suspendus"} onClick={() => setActiveKpi("suspendus")} />
          <KpiCard label="Aujourd'hui" value={interventionsToday.length} icon={<Sun className="h-5 w-5" />} gradient="from-cyan-500 to-cyan-600" active={activeKpi==="today"} onClick={() => setActiveKpi("today")} />
          <KpiCard label="Demain" value={interventionsTomorrow.length} icon={<Sunrise className="h-5 w-5" />} gradient="from-sky-500 to-blue-600" active={activeKpi==="tomorrow"} onClick={() => setActiveKpi("tomorrow")} />
        </div>
        )}



        {/* Filtres nom + dates */}
        {mainTab !== "planning" && (
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
            <div className="min-w-[170px]">
              <Label className="text-xs">Service</Label>
              <Select value={filtreService} onValueChange={setFiltreService}>
                <SelectTrigger><SelectValue placeholder="Tous les services" /></SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="all">Tous les services</SelectItem>
                  {servicesOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[160px]">
              <Label className="text-xs">Commercial</Label>
              <Select value={filtreCommercial} onValueChange={setFiltreCommercial}>
                <SelectTrigger><SelectValue placeholder="Tous" /></SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="all">Tous les commerciaux</SelectItem>
                  {commerciauxOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[150px]">
              <Label className="text-xs">Ville</Label>
              <Select value={filtreVille} onValueChange={setFiltreVille}>
                <SelectTrigger><SelectValue placeholder="Toutes" /></SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="all">Toutes les villes</SelectItem>
                  {villesOptions.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters}><X className="h-4 w-4 mr-1" />Réinitialiser</Button>
            )}
          </div>
        </Card>
        )}


        <TabsContent value="abonnement" className="m-0 space-y-4">
          {activeKpi === "actifs" && <AbonnementTable rows={abosActifsF} navigate={navigate} facturations={facturations} today={today} openAction={openAction} openCalendar={setCalendarDemande} onSuspend={suspendreDemande} />}
          {activeKpi === "echeance" && <AbonnementTable rows={abosEcheanceF.length ? abosEcheanceF : (MOCK_ABOS_ECHEANCE(today) as any)} navigate={navigate} facturations={facturations} today={today} highlightEcheance openAction={openAction} openCalendar={setCalendarDemande} onSuspend={suspendreDemande} />}
          {activeKpi === "suspendus" && <AbonnementTable rows={abosSuspendusF.length ? abosSuspendusF : (MOCK_ABOS_SUSPENDUS(today) as any)} navigate={navigate} facturations={facturations} today={today} forceStatut="suspendu" openAction={openAction} openCalendar={setCalendarDemande} onSuspend={suspendreDemande} />}
          {activeKpi === "today" && <InterventionTable rows={interventionsTodayF.length ? interventionsTodayF : (MOCK_INTERVENTIONS(today) as any)} navigate={navigate} />}
          {activeKpi === "tomorrow" && <InterventionTable rows={interventionsTomorrowF.length ? interventionsTomorrowF : (MOCK_INTERVENTIONS(tomorrow) as any)} navigate={navigate} />}
        </TabsContent>

        <TabsContent value="planning" className="m-0 space-y-4">
          <PlanningMoisPanel getEntries={getPlanningEntries} services={servicesOptions} villes={villesOptions} commerciaux={commerciauxOptions} />
        </TabsContent>

        <TabsContent value="facturation" className="m-0 space-y-4">
          <CycleFacturationPanel />

        </TabsContent>

      </Tabs>

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
  rows, navigate, highlightEcheance, forceStatut, facturations = [], today, openAction, openCalendar, onSuspend,
}: {
  rows: { d: Demande; stats: ReturnType<typeof getStats>; joursRestants: number | null }[];
  navigate: ReturnType<typeof useNavigate>;
  highlightEcheance?: boolean;
  forceStatut?: "actif" | "echeance" | "suspendu";
  facturations?: Facturation[];
  today: Date;
  openAction: (d: Demande, action: AbonnementAction) => void;
  openCalendar: (d: Demande) => void;
  onSuspend: (d: Demande) => void;
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
                forceStatut ?? (d.statut === "suspendu" ? "suspendu" : enRetard ? "suspendu" : (joursRestants !== null && joursRestants <= 15 ? "echeance" : "actif"));
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
                    <div className="space-y-1 min-w-[150px]">
                      <div className="flex items-baseline justify-between text-xs">
                        <span>
                          <span className="font-semibold text-emerald-700">{stats.effectuees}</span>
                          <span className="text-muted-foreground"> / {stats.total}</span>
                          <span className="ml-1 text-[10px] text-muted-foreground">effectuées</span>
                        </span>
                        <span className="text-muted-foreground">{progressPct}%</span>
                      </div>
                      <Progress value={progressPct} className="h-2" />
                      <div className="flex flex-wrap gap-1">
                        {stats.annulees > 0 && (
                          <Badge className="bg-rose-100 text-rose-800 text-[10px] px-1.5 py-0">
                            {stats.annulees} annulée{stats.annulees > 1 ? "s" : ""}
                          </Badge>
                        )}
                        {stats.aRecuperer > 0 && (
                          <Badge className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0">
                            {stats.aRecuperer} à récup.
                          </Badge>
                        )}
                      </div>
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
                  {/* Actions */}
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
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-amber-600" onClick={() => onSuspend(d)}>
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
