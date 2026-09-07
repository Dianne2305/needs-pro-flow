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

/** Catégorie : missions récurrentes (abonnement) = Interne, ponctuelles = Externe. */
function getCategorie(d: any): "interne" | "externe" {
  return d.frequence && d.frequence !== "ponctuel" ? "interne" : "externe";
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

  const { data: demandes = [], isLoading } = useQuery({
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
    <div className="space-y-4">
      {/* Navigation semaine */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset((w) => w - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CalendarDays className="h-4 w-4 text-primary" />
            Semaine du {format(weekStart, "dd MMM", { locale: fr })} au{" "}
            {format(addDays(weekStart, 6), "dd MMM yyyy", { locale: fr })}
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset((w) => w + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {weekOffset !== 0 && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setWeekOffset(0)}>
              Semaine en cours
            </Button>
          )}
        </div>
        <Badge variant="secondary" className="text-xs">
          {total} intervention{total > 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="space-y-4">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const rows = byDay[key] || [];
          const isToday = key === format(new Date(), "yyyy-MM-dd");
          return (
            <div key={key} className={cn("border rounded-lg overflow-hidden", isToday && "border-primary")}>
              <div
                className={cn(
                  "px-3 py-2 flex items-center justify-between",
                  isToday ? "bg-primary/10" : "bg-muted/50",
                )}
              >
                <span className="text-sm font-bold capitalize">
                  {format(day, "EEEE dd MMMM yyyy", { locale: fr })}
                </span>
                <Badge
                  variant={rows.length > 0 ? "default" : "outline"}
                  className="text-xs font-semibold"
                >
                  {rows.length} intervention{rows.length > 1 ? "s" : ""}
                </Badge>
              </div>
              {rows.length === 0 ? (
                <div className="px-3 py-4 text-xs text-muted-foreground">Aucune intervention</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Profils intervenants</TableHead>
                      <TableHead className="text-xs">Client / Service</TableHead>
                      <TableHead className="text-xs">Heure</TableHead>
                      <TableHead className="text-xs">Nb heures</TableHead>
                      <TableHead className="text-xs">Statut du besoin</TableHead>
                      <TableHead className="text-xs">Catégorie</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((d: any) => {
                      const st = (STATUTS as any)[d.statut];
                      const cat = getCategorie(d);
                      return (
                        <TableRow key={d.id} className="hover:bg-muted/40">
                          <TableCell className="text-sm font-medium">
                            {d.candidat_nom || <span className="text-muted-foreground">Non affecté</span>}
                            {d.nombre_intervenants > 1 && (
                              <span className="text-xs text-muted-foreground"> ({d.nombre_intervenants} pers.)</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="font-medium">{d.nom}</div>
                            <div className="text-muted-foreground">
                              {d.type_prestation} · {d.quartier || d.ville}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {d.heure_prestation ? String(d.heure_prestation).slice(0, 5) : "—"}
                          </TableCell>
                          <TableCell className="text-sm">{d.duree_heures ? `${d.duree_heures} h` : "—"}</TableCell>
                          <TableCell>
                            {st ? (
                              <Badge variant="outline" className={cn("border-0 text-xs", st.color)}>
                                {st.label}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "border-0 text-xs",
                                cat === "interne"
                                  ? "bg-teal-100 text-teal-800"
                                  : "bg-amber-100 text-amber-800",
                              )}
                            >
                              {cat === "interne" ? "Interne" : "Externe"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          );
        })}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement...</p>}
    </div>
  );
}
