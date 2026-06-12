/**
 * SuiviAbonnements.tsx
 * Sous-page "Listing Clients" : suivi des abonnements (clients récurrents).
 * - 4 KPIs (Actifs / À renouveler 7j / En retard / CA mensuel estimé)
 * - Filtres (urgence, segment, service, recherche)
 * - 3 vues : Tableau complet, Calendrier mensuel, Historique des relances
 * - Actions : Relancer (log dans demande_historique), Voir compte, Renouveler
 */
import { useMemo, useState } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, addDays, addWeeks, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, differenceInCalendarDays, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  RefreshCw, Search, Phone, MessageSquare, UserCheck, RotateCw,
  AlertTriangle, CalendarDays, TrendingUp, History, ChevronLeft, ChevronRight, Bell, Eye,
} from "lucide-react";
import { AbonnementDetailModal } from "@/components/dashboard/AbonnementDetailModal";

type Demande = Tables<"demandes">;
type Historique = Tables<"demande_historique">;

const FREQ_DAYS: Record<string, number> = {
  "1_fois_semaine": 7,
  "2_fois_semaine": 3,
  "3_fois_semaine": 2,
  "4_fois_semaine": 2,
  "5_fois_semaine": 1,
  "6_fois_semaine": 1,
  "quotidien": 1,
  "1_fois_mois": 30,
  "2_fois_mois": 15,
  "3_fois_mois": 10,
  "4_fois_mois": 7,
};

const FREQ_PER_MONTH: Record<string, number> = {
  "1_fois_semaine": 4,
  "2_fois_semaine": 8,
  "3_fois_semaine": 12,
  "4_fois_semaine": 16,
  "5_fois_semaine": 20,
  "6_fois_semaine": 24,
  "quotidien": 30,
  "1_fois_mois": 1,
  "2_fois_mois": 2,
  "3_fois_mois": 3,
  "4_fois_mois": 4,
};

const FREQ_LABEL: Record<string, string> = {
  "1_fois_semaine": "1 / semaine",
  "2_fois_semaine": "2 / semaine",
  "3_fois_semaine": "3 / semaine",
  "4_fois_semaine": "4 / semaine",
  "5_fois_semaine": "5 / semaine",
  "6_fois_semaine": "6 / semaine",
  "quotidien": "7 / semaine",
  "1_fois_mois": "1 / mois",
  "2_fois_mois": "2 / mois",
  "3_fois_mois": "3 / mois",
  "4_fois_mois": "4 / mois",
};

/** Total planifié, effectué, restant + date de fin d'abonnement à partir du planning. */
function getInterventionStats(d: Demande): { total: number; effectuees: number; restantes: number; dateFin: Date | null } {
  const planning = d.planning as any;
  let total = 0;
  let effectuees = 0;
  let maxDate: Date | null = null;
  if (planning?.semaines?.length) {
    for (const sem of planning.semaines) {
      const base = sem.semaine_debut ? parseISO(sem.semaine_debut) : null;
      for (const j of sem.jours || []) {
        total++;
        if (j.statut === "terminee") effectuees++;
        if (base) {
          const dt = addDays(base, typeof j.jour === "number" ? j.jour : 0);
          if (!maxDate || dt > maxDate) maxDate = dt;
        }
      }
    }
  }
  return { total, effectuees, restantes: Math.max(0, total - effectuees), dateFin: maxDate };
}

function isAbonnement(d: Demande): boolean {
  return !!d.frequence && d.frequence !== "ponctuel";
}

/** Compute next intervention date for an abonnement. */
function getNextInterventionDate(d: Demande, today: Date): Date | null {
  // 1) planning.semaines if present
  const planning = d.planning as any;
  if (planning?.semaines?.length) {
    const dates: Date[] = [];
    for (const sem of planning.semaines) {
      const base = sem.semaine_debut ? parseISO(sem.semaine_debut) : null;
      if (!base) continue;
      for (const j of sem.jours || []) {
        // j.jour = 0=lundi..6=dim
        if (j.statut === "terminee") continue;
        const offset = typeof j.jour === "number" ? j.jour : 0;
        dates.push(addDays(base, offset));
      }
    }
    const future = dates.filter((x) => x >= today).sort((a, b) => a.getTime() - b.getTime());
    if (future.length) return future[0];
  }
  // 2) fallback: date_prestation + cadence
  const start = d.date_prestation ? parseISO(d.date_prestation as unknown as string) : (d.confirmed_at ? new Date(d.confirmed_at) : null);
  if (!start) return null;
  const step = FREQ_DAYS[d.frequence || ""] || 7;
  let next = new Date(start);
  while (next < today) next = addDays(next, step);
  return next;
}

function getAllUpcoming(d: Demande, from: Date, to: Date): Date[] {
  const out: Date[] = [];
  const planning = d.planning as any;
  if (planning?.semaines?.length) {
    for (const sem of planning.semaines) {
      const base = sem.semaine_debut ? parseISO(sem.semaine_debut) : null;
      if (!base) continue;
      for (const j of sem.jours || []) {
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

function urgencyOf(jours: number | null): "retard" | "urgent" | "bientot" | "ok" | "inconnu" {
  if (jours === null) return "inconnu";
  if (jours < 0) return "retard";
  if (jours <= 3) return "urgent";
  if (jours <= 7) return "bientot";
  return "ok";
}

const URGENCY_STYLES: Record<string, string> = {
  retard: "bg-red-100 text-red-700 border-red-300",
  urgent: "bg-orange-100 text-orange-700 border-orange-300",
  bientot: "bg-yellow-100 text-yellow-800 border-yellow-300",
  ok: "bg-emerald-100 text-emerald-700 border-emerald-300",
  inconnu: "bg-muted text-muted-foreground",
};

const URGENCY_LABEL: Record<string, string> = {
  retard: "En retard",
  urgent: "≤ 3 jours",
  bientot: "≤ 7 jours",
  ok: "À venir",
  inconnu: "—",
};

type AboStatus = "actif" | "expire" | "retard";

function getAboStatus(dateFin: Date | null, restantes: number, jours: number | null, today: Date): AboStatus {
  if (dateFin && dateFin < today) return "expire";
  if (dateFin && restantes === 0) return "expire";
  if (jours !== null && jours < 0) return "retard";
  return "actif";
}

const ABO_STATUS_STYLES: Record<AboStatus, string> = {
  actif: "bg-emerald-100 text-emerald-700 border-emerald-300",
  expire: "bg-slate-200 text-slate-700 border-slate-300",
  retard: "bg-red-100 text-red-700 border-red-300",
};

const ABO_STATUS_LABEL: Record<AboStatus, string> = {
  actif: "Actif",
  expire: "Expiré",
  retard: "En retard",
};

export default function SuiviAbonnements() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [calMonth, setCalMonth] = useState<Date>(startOfMonth(today));
  const [relanceFor, setRelanceFor] = useState<Demande | null>(null);
  const [relanceCanal, setRelanceCanal] = useState<"whatsapp" | "appel" | "email">("whatsapp");
  const [relanceNote, setRelanceNote] = useState("");
  const [detailFor, setDetailFor] = useState<Demande | null>(null);

  const { data: demandes = [], isLoading, refetch } = useQuery({
    queryKey: ["demandes", "abonnements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandes")
        .select("*")
        .neq("statut", "annulee")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Demande[]).filter(isAbonnement);
    },
  });

  const { data: historiqueRelances = [] } = useQuery({
    queryKey: ["demande_historique", "relances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demande_historique")
        .select("*")
        .eq("action", "relance_abonnement")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as Historique[];
    },
  });

  const enriched = useMemo(() => {
    return demandes.map((d) => {
      const next = getNextInterventionDate(d, today);
      const jours = next ? differenceInCalendarDays(next, today) : null;
      const ca = (Number(d.montant_total) || 0) * (FREQ_PER_MONTH[d.frequence || ""] || 0);
      const lastRelance = historiqueRelances.find((h) => h.demande_id === d.id);
      const stats = getInterventionStats(d);
      return {
        d,
        next,
        jours,
        urgency: urgencyOf(jours),
        caMois: ca,
        lastRelance,
        stats,
      };
    });
  }, [demandes, historiqueRelances, today]);

  const uniqueServices = useMemo(() => Array.from(new Set(demandes.map((d) => d.type_prestation))).sort(), [demandes]);

  const filtered = useMemo(() => {
    return enriched.filter(({ d, urgency }) => {
      if (segmentFilter !== "all" && d.type_service !== segmentFilter) return false;
      if (serviceFilter !== "all" && d.type_prestation !== serviceFilter) return false;
      if (urgencyFilter !== "all" && urgency !== urgencyFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!d.nom.toLowerCase().includes(q) && !String(d.num_demande).includes(q) && !(d.ville || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [enriched, segmentFilter, serviceFilter, urgencyFilter, search]);

  // KPIs
  const kpis = useMemo(() => {
    const actifs = enriched.length;
    const aRenouveler = enriched.filter((e) => e.jours !== null && e.jours >= 0 && e.jours <= 7).length;
    const retard = enriched.filter((e) => e.jours !== null && e.jours < 0).length;
    const caMois = enriched.reduce((s, e) => s + e.caMois, 0);
    return { actifs, aRenouveler, retard, caMois };
  }, [enriched]);

  // Calendar
  const monthDays = useMemo(() => eachDayOfInterval({ start: startOfMonth(calMonth), end: endOfMonth(calMonth) }), [calMonth]);
  const interventionsByDay = useMemo(() => {
    const map = new Map<string, { d: Demande }[]>();
    const from = startOfMonth(calMonth);
    const to = endOfMonth(calMonth);
    for (const { d } of enriched) {
      for (const date of getAllUpcoming(d, from, to)) {
        const key = format(date, "yyyy-MM-dd");
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({ d });
      }
    }
    return map;
  }, [enriched, calMonth]);

  // Mutations
  const relanceMutation = useMutation({
    mutationFn: async ({ demande, canal, note }: { demande: Demande; canal: string; note: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      let userName = "Système";
      if (user) {
        const { data: prof } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
        userName = prof?.display_name || user.email || "Utilisateur";
      }
      const { error } = await supabase.from("demande_historique").insert({
        demande_id: demande.id,
        action: "relance_abonnement",
        details: `[${canal.toUpperCase()}] ${note || "Relance abonnement"}`,
        utilisateur: userName,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demande_historique"] });
      toast({ title: "Relance enregistrée" });
      setRelanceFor(null);
      setRelanceNote("");
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const renouvelerMutation = useMutation({
    mutationFn: async (d: Demande) => {
      const { error } = await supabase.from("demandes").insert({
        nom: d.nom,
        telephone_direct: d.telephone_direct,
        telephone_whatsapp: d.telephone_whatsapp,
        type_service: d.type_service,
        type_prestation: d.type_prestation,
        type_bien: d.type_bien,
        frequence: d.frequence,
        duree_heures: d.duree_heures,
        nombre_intervenants: d.nombre_intervenants,
        ville: d.ville,
        quartier: d.quartier,
        adresse: d.adresse,
        montant_total: d.montant_total,
        statut: "nouveau_besoin",
        notes_client: `Renouvellement abonnement #${d.num_demande}`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demandes"] });
      toast({ title: "Abonnement renouvelé", description: "Une nouvelle demande a été créée." });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      {/* Header + sub-nav */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Suivi des abonnements</h1>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Actualiser
        </Button>
      </div>

      <div className="flex gap-1 border-b">
        <NavLink to="/clients" end className={({ isActive }) => cn("px-3 py-2 text-sm font-medium border-b-2 -mb-px",
          isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
          Tous les clients
        </NavLink>
        <NavLink to="/clients/abonnements" className={({ isActive }) => cn("px-3 py-2 text-sm font-medium border-b-2 -mb-px",
          isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
          Suivi des abonnements
        </NavLink>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <KpiCard label="Abonnements actifs" value={kpis.actifs} gradient="from-cyan-500 to-cyan-600" icon={<RotateCw className="h-5 w-5" />} onClick={() => setUrgencyFilter("all")} />
        <KpiCard label="À renouveler ≤ 7j" value={kpis.aRenouveler} gradient="from-yellow-400 to-amber-500" icon={<CalendarDays className="h-5 w-5" />} onClick={() => setUrgencyFilter("bientot")} />
        <KpiCard label="En retard" value={kpis.retard} gradient="from-red-500 to-rose-600" icon={<AlertTriangle className="h-5 w-5" />} onClick={() => setUrgencyFilter("retard")} />
        <KpiCard label="CA mensuel estimé" value={`${Math.round(kpis.caMois).toLocaleString("fr-FR")} DH`} gradient="from-teal-500 to-emerald-600" icon={<TrendingUp className="h-5 w-5" />} />
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher client, numéro, ville…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>
        <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Urgence" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toute urgence</SelectItem>
            <SelectItem value="retard">🔴 En retard</SelectItem>
            <SelectItem value="urgent">🟠 ≤ 3 jours</SelectItem>
            <SelectItem value="bientot">🟡 ≤ 7 jours</SelectItem>
            <SelectItem value="ok">🟢 À venir</SelectItem>
          </SelectContent>
        </Select>
        <Select value={segmentFilter} onValueChange={setSegmentFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Segment" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tout</SelectItem>
            <SelectItem value="SPP">Particulier</SelectItem>
            <SelectItem value="SPE">Entreprise</SelectItem>
          </SelectContent>
        </Select>
        <Select value={serviceFilter} onValueChange={setServiceFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Service" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tout</SelectItem>
            {uniqueServices.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Vues */}
      <Tabs defaultValue="tableau">
        <TabsList>
          <TabsTrigger value="tableau">Tableau</TabsTrigger>
          <TabsTrigger value="calendrier">Calendrier mensuel</TabsTrigger>
          <TabsTrigger value="historique">Historique des relances</TabsTrigger>
        </TabsList>

        {/* Tableau */}
        <TabsContent value="tableau">
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Fréquence</TableHead>
                  <TableHead>Interventions</TableHead>
                  <TableHead>Prochaine intervention</TableHead>
                  <TableHead>Jours restants</TableHead>
                  <TableHead>Fin d'abonnement</TableHead>
                  <TableHead>Dernière relance</TableHead>
                  <TableHead>CA / mois</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={12} className="text-center py-10 text-muted-foreground">Chargement…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={12} className="text-center py-10 text-muted-foreground">Aucun abonnement trouvé</TableCell></TableRow>
                ) : filtered
                  .sort((a, b) => (a.jours ?? 9999) - (b.jours ?? 9999))
                  .map(({ d, next, jours, urgency, caMois, lastRelance, stats }) => {
                  const aboStatus = getAboStatus(stats.dateFin, stats.restantes, jours, today);
                  return (
                  <TableRow key={d.id}>
                    <TableCell>
                      <button onClick={() => setDetailFor(d)} className="font-medium text-sm text-primary hover:underline text-left">
                        {d.nom}
                      </button>
                      <div className="text-[10px] text-muted-foreground font-mono">#{d.num_demande} • {d.ville}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-xs", ABO_STATUS_STYLES[aboStatus])}>
                        {ABO_STATUS_LABEL[aboStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={d.type_service === "SPP" ? "bg-primary text-primary-foreground" : "bg-spe text-spe-foreground"}>
                        {d.type_service === "SPP" ? "Particulier" : "Entreprise"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{d.type_prestation}</TableCell>
                    <TableCell className="text-sm font-medium">{FREQ_LABEL[d.frequence || ""] || d.frequence}</TableCell>
                    <TableCell className="text-sm">
                      {stats.total > 0 ? (
                        <span className="font-medium">
                          <span className="text-emerald-600">{stats.effectuees}</span>
                          <span className="text-muted-foreground"> / </span>
                          <span>{stats.restantes}</span>
                          <span className="text-[10px] text-muted-foreground ml-1">(restantes)</span>
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm">{next ? format(next, "EEE dd MMM yyyy", { locale: fr }) : "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-xs", URGENCY_STYLES[urgency])}>
                        {jours === null ? "—" : jours < 0 ? `${Math.abs(jours)}j en retard` : jours === 0 ? "Aujourd'hui" : `J-${jours}`}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{stats.dateFin ? format(stats.dateFin, "dd MMM yyyy", { locale: fr }) : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {lastRelance ? format(new Date(lastRelance.created_at), "dd/MM HH:mm") : <span className="italic">Jamais</span>}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{Math.round(caMois).toLocaleString("fr-FR")} DH</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => setDetailFor(d)}>
                          <Eye className="h-3 w-3" /> Détail
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => { setRelanceFor(d); setRelanceCanal("whatsapp"); setRelanceNote(""); }}>
                          <Bell className="h-3 w-3" /> Relancer
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => navigate(`/compte-client?id=${d.id}&from=/clients/abonnements`)}>
                          <UserCheck className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Calendrier */}
        <TabsContent value="calendrier">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <Button variant="outline" size="sm" onClick={() => setCalMonth(addWeeks(calMonth, -4))}><ChevronLeft className="h-4 w-4" /></Button>
              <h3 className="font-semibold capitalize">{format(calMonth, "MMMM yyyy", { locale: fr })}</h3>
              <Button variant="outline" size="sm" onClick={() => setCalMonth(addWeeks(calMonth, 4))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-[11px] text-muted-foreground font-semibold mb-1">
              {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => <div key={d} className="p-1 text-center">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {/* Pad with empty cells */}
              {Array.from({ length: (monthDays[0].getDay() + 6) % 7 }).map((_, i) => <div key={`pad-${i}`} />)}
              {monthDays.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const items = interventionsByDay.get(key) || [];
                const isToday = isSameDay(day, today);
                return (
                  <div key={key} className={cn("min-h-[80px] border rounded-md p-1 text-xs", isToday && "ring-2 ring-primary bg-primary/5")}>
                    <div className="font-semibold text-[11px] mb-1">{format(day, "d")}</div>
                    <div className="space-y-0.5">
                      {items.slice(0, 3).map((it, idx) => (
                        <button key={idx} onClick={() => setDetailFor(it.d)}
                          className={cn("block w-full text-left truncate rounded px-1 py-0.5 text-[10px] hover:opacity-80",
                            it.d.type_service === "SPP" ? "bg-primary/15 text-primary" : "bg-spe/30 text-spe-foreground")}>
                          {it.d.nom}
                        </button>
                      ))}
                      {items.length > 3 && <div className="text-[10px] text-muted-foreground">+{items.length - 3}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        {/* Historique relances */}
        <TabsContent value="historique">
          <Card className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Canal / Note</TableHead>
                  <TableHead>Effectuée par</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historiqueRelances.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">Aucune relance enregistrée</TableCell></TableRow>
                ) : historiqueRelances.map((h) => {
                  const dem = demandes.find((d) => d.id === h.demande_id);
                  return (
                    <TableRow key={h.id}>
                      <TableCell className="text-xs whitespace-nowrap">{format(new Date(h.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                      <TableCell>
                        {dem ? (
                          <button onClick={() => navigate(`/compte-client?id=${dem.id}&from=/clients/abonnements`)} className="text-sm text-primary hover:underline">
                            {dem.nom} <span className="text-[10px] text-muted-foreground font-mono">#{dem.num_demande}</span>
                          </button>
                        ) : <span className="text-sm text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-sm">{h.details}</TableCell>
                      <TableCell className="text-sm">{h.utilisateur || "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Relance modal */}
      <Dialog open={!!relanceFor} onOpenChange={(o) => !o && setRelanceFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Relancer {relanceFor?.nom}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Canal</label>
              <Select value={relanceCanal} onValueChange={(v: any) => setRelanceCanal(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="appel">Appel téléphonique</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Note (optionnel)</label>
              <Textarea rows={3} value={relanceNote} onChange={(e) => setRelanceNote(e.target.value)} placeholder="Ex : client a confirmé pour mercredi…" />
            </div>
            {relanceFor && (
              <div className="text-xs text-muted-foreground flex items-center gap-3">
                {relanceFor.telephone_direct && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {relanceFor.telephone_direct}</span>}
                {relanceFor.telephone_whatsapp && <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {relanceFor.telephone_whatsapp}</span>}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRelanceFor(null)}>Annuler</Button>
            <Button onClick={() => relanceFor && relanceMutation.mutate({ demande: relanceFor, canal: relanceCanal, note: relanceNote })} disabled={relanceMutation.isPending}>
              Marquer comme relancé
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail modal */}
      <AbonnementDetailModal demande={detailFor} open={!!detailFor} onOpenChange={(o) => !o && setDetailFor(null)} />
    </div>
  );
}

function KpiCard({ label, value, gradient, icon, onClick }: { label: string; value: string | number; gradient: string; icon: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={cn("text-left rounded-lg p-4 text-white bg-gradient-to-br shadow-sm hover:brightness-105 transition", gradient)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium opacity-90">{label}</span>
        <span className="opacity-80">{icon}</span>
      </div>
      <div className="text-2xl font-bold mt-2">{value}</div>
    </button>
  );
}
