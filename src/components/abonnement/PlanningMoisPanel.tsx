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

export type PlanningStatut = "a_venir" | "termine" | "annule" | "a_recuperer";
export type PlanningEntry = {
  date: Date;
  service?: string | null;
  ville?: string | null;
  commercial?: string | null;
  statut?: PlanningStatut;
};

const DOWS = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"];

export default function PlanningMoisPanel({
  getEntries,
  services,
  villes,
  commerciaux = [],
}: {
  getEntries: (from: Date, to: Date) => PlanningEntry[];
  services: string[];
  villes: string[];
  commerciaux?: string[];
}) {
  const today = new Date();
  const [monthRef, setMonthRef] = useState<Date>(startOfMonth(today));
  const [service, setService] = useState("all");
  const [ville, setVille] = useState("all");
  const [commercial, setCommercial] = useState("all");
  const [showExamples, setShowExamples] = useState(true);

  const monthStart = startOfMonth(monthRef);
  const monthEnd = endOfMonth(monthRef);

  const exampleEntries = useMemo<PlanningEntry[]>(() => {
    // Exemples visuels : terminé, annulé, reporté, à venir
    const examples: PlanningEntry[] = [];
    const servicesEx = ["Ménage", "Nettoyage vitres", "Repassage"];
    const villesEx = ["Casablanca", "Rabat"];
    const commerciauxEx = ["Kaoutar", "Mehdi", "Youssef"];
    const statuts: PlanningStatut[] = ["termine", "termine", "annule", "a_recuperer", "a_venir"];
    let idx = 0;
    for (let d = 5; d <= 29; d += 2) {
      const baseDate = new Date(monthRef.getFullYear(), monthRef.getMonth(), d);
      const count = 3 + (idx % 4); // 3 à 6 interventions par jour
      for (let k = 0; k < count; k++) {
        examples.push({
          date: baseDate,
          service: servicesEx[(idx + k) % servicesEx.length],
          ville: villesEx[(idx + k) % villesEx.length],
          commercial: commerciauxEx[(idx + k) % commerciauxEx.length],
          statut: statuts[(idx + k) % statuts.length],
        });
      }
      idx++;
    }
    return examples;
  }, [monthRef]);

  const cells = useMemo(() => {
    let entries = getEntries(monthStart, monthEnd).filter(
      (e) =>
        (service === "all" || e.service === service) &&
        (ville === "all" || e.ville === ville) &&
        (commercial === "all" || e.commercial === commercial)
    );
    // Affiche des exemples si aucune donnée réelle n'existe pour le mois
    if (entries.length === 0) {
      entries = exampleEntries.filter(
        (e) =>
          (service === "all" || e.service === service) &&
          (ville === "all" || e.ville === ville) &&
          (commercial === "all" || e.commercial === commercial)
      );
    }
    // grille : lundi -> dimanche
    const firstDow = (monthStart.getDay() + 6) % 7;
    const days: { date: Date | null; count: number; termine: number; annule: number; reporte: number }[] = [];
    const empty = { date: null, count: 0, termine: 0, annule: 0, reporte: 0 };
    for (let i = 0; i < firstDow; i++) days.push({ ...empty });
    for (let d = 1; d <= monthEnd.getDate(); d++) {
      const date = new Date(monthRef.getFullYear(), monthRef.getMonth(), d);
      const dayEntries = entries.filter((e) => isSameDay(e.date, date));
      days.push({
        date,
        count: dayEntries.length,
        termine: dayEntries.filter((e) => e.statut === "termine").length,
        annule: dayEntries.filter((e) => e.statut === "annule").length,
        reporte: dayEntries.filter((e) => e.statut === "a_recuperer").length,
      });
    }
    while (days.length % 7 !== 0) days.push({ ...empty });
    return days;
  }, [getEntries, monthStart, monthEnd, monthRef, service, ville, commercial, exampleEntries]);


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
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Exemples visuels</span>

        <div className="ml-auto flex items-center gap-2">
          <Select value={service} onValueChange={setService}>
            <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Tous les services" /></SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="all">Tous les services</SelectItem>
              {services.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={commercial} onValueChange={setCommercial}>
            <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Tous les commerciaux" /></SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="all">Tous les commerciaux</SelectItem>
              {commerciaux.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
                <p className={`text-base font-semibold ${isToday ? "text-amber-700" : "text-foreground"}`}>{c.date.getDate()}</p>
                {c.count > 0 ? (
                  <div className="mt-0.5 space-y-0.5">
                    <p className="text-sm font-semibold text-primary">Nbre d'interventions : {c.count}</p>
                    {c.termine > 0 && <p className="text-xs font-medium text-emerald-600">Nbr terminé : {c.termine}</p>}
                    {c.reporte > 0 && <p className="text-xs font-medium text-indigo-600">Nbre reporté : {c.reporte}</p>}
                    {c.annule > 0 && <p className="text-xs font-medium text-destructive">Nombre annulé : {c.annule}</p>}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground/60 mt-0.5">—</p>
                )}

              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
