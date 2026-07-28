/**
 * PlanningMoisPanel.tsx
 * Vue calendrier mensuelle du planning : nombre global d'interventions par jour.
 */
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isSameDay, isSameMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type PlanningEntry = { date: Date; service?: string | null; ville?: string | null };

const DOWS = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"];

export default function PlanningMoisPanel({
  getEntries,
  services,
  villes,
}: {
  getEntries: (from: Date, to: Date) => PlanningEntry[];
  services: string[];
  villes: string[];
}) {
  const today = new Date();
  const [monthRef, setMonthRef] = useState<Date>(startOfMonth(today));
  const [service, setService] = useState("all");
  const [ville, setVille] = useState("all");

  const monthStart = startOfMonth(monthRef);
  const monthEnd = endOfMonth(monthRef);

  const cells = useMemo(() => {
    const entries = getEntries(monthStart, monthEnd).filter(
      (e) => (service === "all" || e.service === service) && (ville === "all" || e.ville === ville)
    );
    // grille : lundi -> dimanche
    const firstDow = (monthStart.getDay() + 6) % 7;
    const days: { date: Date | null; count: number }[] = [];
    for (let i = 0; i < firstDow; i++) days.push({ date: null, count: 0 });
    for (let d = 1; d <= monthEnd.getDate(); d++) {
      const date = new Date(monthRef.getFullYear(), monthRef.getMonth(), d);
      days.push({ date, count: entries.filter((e) => isSameDay(e.date, date)).length });
    }
    while (days.length % 7 !== 0) days.push({ date: null, count: 0 });
    return days;
  }, [getEntries, monthStart, monthEnd, monthRef, service, ville]);

  const totalMois = cells.reduce((s, c) => s + c.count, 0);

  return (
    <div className="space-y-3">
      {/* Barre de navigation */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setMonthRef(subMonths(monthRef, 1))}>
          <ChevronLeft className="h-4 w-4 mr-1" />{format(subMonths(monthRef, 1), "MMMM", { locale: fr })}
        </Button>
        <span className="font-bold text-base capitalize px-1">{format(monthRef, "MMMM yyyy", { locale: fr })}</span>
        <Button variant="outline" size="sm" onClick={() => setMonthRef(addMonths(monthRef, 1))}>
          {format(addMonths(monthRef, 1), "MMMM", { locale: fr })}<ChevronRight className="h-4 w-4 ml-1" />
        </Button>
        <span className="text-xs text-muted-foreground ml-2">{totalMois} intervention{totalMois > 1 ? "s" : ""} ce mois</span>

        <div className="ml-auto flex items-center gap-2">
          <Select value={service} onValueChange={setService}>
            <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Tous les services" /></SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="all">Tous les services</SelectItem>
              {services.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={ville} onValueChange={setVille}>
            <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder="Toutes les villes" /></SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="all">Toutes les villes</SelectItem>
              {villes.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Calendrier */}
      <Card className="p-4">
        <div className="grid grid-cols-7 gap-2 mb-2">
          {DOWS.map((d) => (
            <div key={d} className="text-center text-[11px] font-semibold text-muted-foreground tracking-wide">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {cells.map((c, i) => {
            if (!c.date) return <div key={i} className="min-h-[110px] rounded-md bg-muted/20" />;
            const isToday = isSameDay(c.date, today);
            const isWeekend = [0, 6].includes(c.date.getDay());
            return (
              <div
                key={i}
                className={`min-h-[110px] rounded-md border p-2 transition-colors ${
                  isToday ? "border-amber-400 border-2 bg-amber-50/40" : "border-border"
                } ${isWeekend && !isToday ? "bg-muted/20" : "bg-background"}`}
              >
                <p className={`text-xs ${isToday ? "font-bold text-amber-700" : "text-foreground"}`}>{c.date.getDate()}</p>
                {c.count > 0 ? (
                  <p className="text-[11px] font-semibold text-primary mt-0.5">{c.count} passage{c.count > 1 ? "s" : ""}</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">—</p>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
