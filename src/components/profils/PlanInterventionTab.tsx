/**
 * PlanInterventionTab.tsx
 * Onglet "Plan intervention" : vue hebdomadaire des interventions (jour/date, profils intervenants,
 * heure, nombre d'heures, statut du besoin, catégorie interne/externe).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { format, startOfWeek, addDays, addWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { STATUTS } from "@/lib/constants";

/** Données de démonstration pour remplir le planning par défaut. */
const DEMO_INTERVENANTS = [
  { nom: "Nadia B.", client: "Mme Alaoui", service: "Ménage régulier", ville: "Casablanca", quartier: "Maarif", duree: 4, heure: "09:00", frequence: "hebdomadaire", statut: "confirme" },
  { nom: "Zineb F.", client: "M. Bennani", service: "Grand ménage", ville: "Casablanca", quartier: "Ain Diab", duree: 6, heure: "08:30", frequence: "ponctuel", statut: "en_cours" },
  { nom: "Fatima L.", client: "Ste Logistika", service: "Entretien bureaux", ville: "Casablanca", quartier: "Sidi Maarouf", duree: 3, heure: "18:00", frequence: "mensuel", statut: "confirme" },
  { nom: "Khadija M.", client: "Mme El Fassi", service: "Ménage régulier", ville: "Casablanca", quartier: "Racine", duree: 3, heure: "14:00", frequence: "hebdomadaire", statut: "termine" },
  { nom: "Samira T.", client: "M. Ouazzani", service: "Nettoyage canapé", ville: "Casablanca", quartier: "Bourgogne", duree: 2, heure: "10:00", frequence: "ponctuel", statut: "en_cours" },
  { nom: "Aicha R.", client: "Ste Alpha", service: "Entretien bureaux", ville: "Casablanca", quartier: "Centre", duree: 5, heure: "07:00", frequence: "mensuel", statut: "confirme" },
  { nom: "Hafsa D.", client: "Mme Benmoussa", service: "Ménage après travaux", ville: "Casablanca", quartier: "Hay Riad", duree: 8, heure: "08:00", frequence: "ponctuel", statut: "reporte" },
  { nom: "Laila K.", client: "M. Zerouali", service: "Ménage régulier", ville: "Casablanca", quartier: "Anfa", duree: 4, heure: "09:30", frequence: "hebdomadaire", statut: "confirme" },
  { nom: "Rachida E.", client: "Mme Fassi", service: "Repassage", ville: "Casablanca", quartier: "Gauthier", duree: 2, heure: "13:00", frequence: "bi-mensuel", statut: "termine" },
  { nom: "Yasmin O.", client: "M. Tahiri", service: "Ménage régulier", ville: "Casablanca", quartier: "Ain Sebaa", duree: 3, heure: "16:00", frequence: "hebdomadaire", statut: "en_cours" },
];

function generateDemoDemandes(weekStart: Date): any[] {
  const rows: any[] = [];
  let idx = 0;
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    const dateKey = format(day, "yyyy-MM-dd");
    // 1 à 3 interventions par jour
    const count = 1 + (i % 3);
    for (let j = 0; j < count; j++) {
      const base = DEMO_INTERVENANTS[idx % DEMO_INTERVENANTS.length];
      const startHour = Number(base.heure.split(":")[0]) + j;
      const heure = `${String(startHour).padStart(2, "0")}:${base.heure.split(":")[1]}`;
      const endHour = startHour + base.duree;
      const heureFin = `${String(endHour).padStart(2, "0")}:${base.heure.split(":")[1]}`;
      rows.push({
        id: `demo-${idx}`,
        date_prestation: dateKey,
        candidat_nom: base.nom,
        nombre_intervenants: 1 + (idx % 2),
        nom: base.client,
        type_prestation: base.service,
        ville: base.ville,
        quartier: base.quartier,
        heure_prestation: heure,
        heure_fin: heureFin,
        duree_heures: base.duree,
        frequence: base.frequence,
        statut: base.statut,
        isDemo: true,
      });
      idx++;
    }
  }
  return rows;
}

/** Catégorie : missions récurrentes (abonnement) = Interne, ponctuelles = Externe. */
function getCategorie(d: any): "interne" | "externe" {
  return d.frequence && d.frequence !== "ponctuel" ? "interne" : "externe";
}

/** Initiales à partir d'un nom complet. */
function getInitials(name?: string | null): string {
  if (!name) return "—";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function PlanInterventionTab() {
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = useMemo(
    () => startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 }),
    [weekOffset],
  );
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const from = format(weekStart, "yyyy-MM-dd");
  const to = format(addDays(weekStart, 6), "yyyy-MM-dd");

  const { data: realDemandes = [], isLoading } = useQuery({
    queryKey: ["demandes", "plan_intervention", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandes")
        .select("*")
        .gte("date_prestation", from)
        .lte("date_prestation", to)
        .order("date_prestation", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const demandes = useMemo(() => {
    if (realDemandes.length > 0) return realDemandes;
    return generateDemoDemandes(weekStart);
  }, [realDemandes, weekStart]);

  const isDemo = realDemandes.length === 0;

  const byDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    days.forEach((d) => (map[format(d, "yyyy-MM-dd")] = []));
    (demandes as any[]).forEach((d) => {
      const k = d.date_prestation;
      if (k && map[k]) map[k].push(d);
    });
    return map;
  }, [demandes, days]);

  const total = (demandes as any[]).length;

  return (
    <div className="space-y-6">
      {/* Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h2 className="text-xl font-bold text-foreground">Planning des interventions</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Semaine du {format(weekStart, "dd MMM", { locale: fr })} au{" "}
            {format(addDays(weekStart, 6), "dd MMM yyyy", { locale: fr })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-muted rounded-lg border border-border">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-md"
              onClick={() => setWeekOffset((w) => w - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {weekOffset !== 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs font-medium"
                onClick={() => setWeekOffset(0)}
              >
                Semaine en cours
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-md"
              onClick={() => setWeekOffset((w) => w + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Badge variant="secondary" className="text-xs h-8 px-3">
            <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
            {total} intervention{total > 1 ? "s" : ""}
          </Badge>
        </div>
      </div>

      {/* Weekly View */}
      <div className="space-y-8">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const rows = byDay[key] || [];
          const isToday = key === format(new Date(), "yyyy-MM-dd");
          const dayName = format(day, "EEE", { locale: fr });
          const dayNumber = format(day, "dd");
          const fullDate = format(day, "EEEE dd MMMM yyyy", { locale: fr });

          return (
            <section key={key}>
              <div className="flex items-center gap-4 mb-4">
                <div
                  className={cn(
                    "flex flex-col items-center justify-center w-14 h-14 rounded-xl border",
                    isToday
                      ? "bg-primary/10 border-primary/30"
                      : "bg-muted/50 border-border",
                  )}
                >
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider",
                      isToday ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {dayName}
                  </span>
                  <span
                    className={cn(
                      "text-xl font-bold",
                      isToday ? "text-primary" : "text-foreground",
                    )}
                  >
                    {dayNumber}
                  </span>
                </div>
                <div>
                  <h3
                    className={cn(
                      "text-lg font-semibold capitalize",
                      isToday ? "text-primary" : "text-foreground",
                    )}
                  >
                    {fullDate}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {rows.length} intervention{rows.length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {rows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-8 text-center text-sm text-muted-foreground">
                  Aucune intervention ce jour
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Intervenante
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Client / Service
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Horaires
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Catégorie
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Statut
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-border">
                      {rows.map((d: any) => {
                        const st = (STATUTS as any)[d.statut];
                        const cat = getCategorie(d);
                        const start = d.heure_prestation
                          ? String(d.heure_prestation).slice(0, 5)
                          : "—";
                        const end = d.heure_fin
                          ? String(d.heure_fin).slice(0, 5)
                          : start !== "—" && d.duree_heures
                            ? `${String(Number(start.split(":")[0]) + Number(d.duree_heures)).padStart(2, "0")}:${start.split(":")[1]}`
                            : "—";

                        return (
                          <TableRow
                            key={d.id}
                            className="transition-colors hover:bg-muted/30"
                          >
                            <TableCell className="py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground border border-border">
                                  {getInitials(d.candidat_nom) || "—"}
                                </div>
                                <span className="font-medium text-foreground">
                                  {d.candidat_nom || (
                                    <span className="text-muted-foreground">Non affecté</span>
                                  )}
                                  {d.nombre_intervenants > 1 && (
                                    <span className="text-xs text-muted-foreground ml-1">
                                      ({d.nombre_intervenants} pers.)
                                    </span>
                                  )}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="py-4">
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold text-foreground">
                                  {d.nom}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {d.type_prestation} · {d.quartier || d.ville}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="py-4">
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold text-foreground">
                                  {start} - {end}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {d.duree_heures ? `${d.duree_heures} h` : "—"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="py-4">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "border-0 text-xs font-medium rounded-full",
                                  cat === "interne"
                                    ? "bg-teal-100 text-teal-800 hover:bg-teal-100"
                                    : "bg-amber-100 text-amber-800 hover:bg-amber-100",
                                )}
                              >
                                {cat === "interne" ? "Interne" : "Externe"}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-4">
                              {st ? (
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold border",
                                    st.color,
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "w-1.5 h-1.5 rounded-full",
                                      st.dot || "bg-current",
                                    )}
                                  />
                                  {st.label}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      )}
    </div>
  );
}
