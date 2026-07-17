/**
 * CalendrierAbonnementModal.tsx
 * Raccourci : affiche un calendrier par mois couvert par l'abonnement,
 * (max 2 calendriers par ligne), avec le nom du mois au-dessus de chacun.
 * Même logique de génération que la section Gestion de l'abonnement dans CompteClient.
 */
import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import {
  addMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay, parseISO, getDay,
} from "date-fns";
import { fr } from "date-fns/locale";
import { Tables } from "@/integrations/supabase/types";
import { useNavigate } from "react-router-dom";

type Demande = Tables<"demandes">;

const DAY_MAP: Record<string, number> = {
  dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6,
};

type Override = { heure?: string; heure_fin?: string; excluded?: boolean; statut?: "termine" | "annule" | "a_recuperer" | null; reprogrammed_to?: string | null; reprogrammed_from?: string | null };

interface DayInfo {
  date: Date;
  statut: "a_venir" | "termine" | "annule" | "a_recuperer" | "reportee";
  heure_debut?: string;
  heure_fin?: string;
}

function getBounds(demande: Demande): { start: Date; end: Date } | null {
  const p = ((demande as any).planning || {}) as any;
  const dateDebutStr = p.date_debut || (demande.date_prestation as unknown as string) || null;
  if (!dateDebutStr) return null;
  let start: Date;
  try { start = parseISO(dateDebutStr); } catch { return null; }
  let end: Date;
  try {
    end = p.date_fin
      ? parseISO(p.date_fin)
      : addMonths(start, typeof p.duree_mois === "number" ? p.duree_mois : 1);
  } catch { end = addMonths(start, 1); }
  return { start, end };
}

function buildInterventions(demande: Demande, month: Date): DayInfo[] {
  const p = ((demande as any).planning || {}) as any;
  const aboJours: { jour: string; heure_debut?: string; heure_fin?: string }[] =
    Array.isArray(p.abo_jours) ? p.abo_jours
    : Array.isArray(p.jours) ? p.jours.map((j: any) => typeof j === "string" ? { jour: j } : j)
    : [];
  const bounds = getBounds(demande);
  const aboFrequence: string = p.abo_frequence || p.frequence || demande.frequence || "";
  const overrides: Record<string, Override> = p.date_overrides || {};

  const heureByDow: Record<number, string | undefined> = {};
  aboJours.forEach((j) => { heureByDow[DAY_MAP[j.jour]] = j.heure_debut; });
  const selectedDows = aboJours.map((j) => DAY_MAP[j.jour]).filter((n) => n !== undefined);

  const interventionSet = new Set<string>();
  if (bounds && selectedDows.length > 0) {
    const { start, end } = bounds;
    const startMs = start.getTime();
    const seenMonth = new Set<string>();
    for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86400000)) {
      if (!selectedDows.includes(d.getDay())) continue;
      if (aboFrequence === "bi_hebdomadaire") {
        const weekNo = Math.floor((d.getTime() - startMs) / (7 * 86400000));
        if (weekNo % 2 !== 0) continue;
      }
      if (aboFrequence === "1_fois_mois") {
        const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDay()}`;
        if (seenMonth.has(k)) continue;
        seenMonth.add(k);
      }
      interventionSet.add(format(d, "yyyy-MM-dd"));
    }
  }

  const out: DayInfo[] = [];
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  for (const day of eachDayOfInterval({ start: monthStart, end: monthEnd })) {
    const key = format(day, "yyyy-MM-dd");
    const ov = overrides[key];
    const isPattern = interventionSet.has(key);
    const hasStatutOnly = ov?.statut === "a_recuperer";
    const isIntervention = (isPattern && !ov?.excluded) || (!!ov?.heure && !ov?.excluded) || hasStatutOnly;
    if (!isIntervention) continue;
    let statut: DayInfo["statut"] =
      ov?.statut === "termine" ? "termine"
      : ov?.statut === "annule" ? "annule"
      : ov?.statut === "a_recuperer" ? "a_recuperer"
      : "a_venir";
    if (statut === "a_venir" && ov?.reprogrammed_from) statut = "reportee";
    out.push({
      date: day,
      statut,
      heure_debut: ov?.heure || (isPattern ? heureByDow[getDay(day)] : undefined),
      heure_fin: ov?.heure_fin,
    });
  }
  return out;
}

const STATUT_STYLE: Record<DayInfo["statut"], { label: string; cls: string }> = {
  a_venir: { label: "À venir", cls: "bg-primary text-primary-foreground" },
  termine: { label: "Terminé", cls: "bg-emerald-500 text-white" },
  annule: { label: "Annulé", cls: "bg-rose-500 text-white line-through" },
  a_recuperer: { label: "À récup.", cls: "bg-amber-500 text-white" },
  reportee: { label: "Reportée", cls: "bg-indigo-500 text-white" },
};

function MonthCalendar({ demande, month }: { demande: Demande; month: Date }) {
  const interventions = useMemo(() => buildInterventions(demande, month), [demande, month]);
  const gridDays = useMemo(() => {
    const s = startOfWeek(startOfMonth(month), { locale: fr });
    const e = endOfWeek(endOfMonth(month), { locale: fr });
    return eachDayOfInterval({ start: s, end: e });
  }, [month]);

  const totalMois = interventions.filter((i) => i.statut !== "annule" && i.statut !== "a_recuperer").length;
  const annulees = interventions.filter((i) => i.statut === "annule").length;
  const aRecuperer = interventions.filter((i) => i.statut === "a_recuperer").length;
  const reportees = interventions.filter((i) => i.statut === "reportee").length;

  return (
    <div className="border rounded-lg p-3 bg-card">
      <div className="font-semibold capitalize text-center mb-2">
        {format(month, "MMMM yyyy", { locale: fr })}
      </div>
      <div className="grid grid-cols-7 gap-1 text-[10px] font-semibold text-muted-foreground uppercase mb-1">
        {["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"].map((d) => (
          <div key={d} className="text-center py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {gridDays.map((day) => {
          const info = interventions.find((di) => isSameDay(di.date, day));
          const inMonth = isSameMonth(day, month);
          const style = info ? STATUT_STYLE[info.statut] : null;
          return (
            <div
              key={day.toISOString()}
              className={`min-h-[60px] border rounded p-1 text-xs flex flex-col ${inMonth ? "bg-background" : "bg-muted/30 text-muted-foreground"}`}
            >
              <div className="text-right font-medium text-[11px]">{format(day, "d")}</div>
              {info && style && (
                <div className="mt-auto space-y-0.5">
                  <Badge className={`w-full justify-center ${style.cls} text-[9px] px-1 py-0`}>{style.label}</Badge>
                  {(info.heure_debut || info.heure_fin) && (
                    <div className="text-[9px] text-center text-muted-foreground">
                      {info.heure_debut || "?"}{info.heure_fin ? `–${info.heure_fin}` : ""}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="text-[11px] text-muted-foreground text-center mt-2">
        <span className="font-semibold text-foreground">{totalMois}</span> intervention(s)
        {annulees > 0 && <span className="ml-2 text-rose-600">· {annulees} annulée(s)</span>}
        {aRecuperer > 0 && <span className="ml-2 text-amber-700">· {aRecuperer} à récup.</span>}
        {reportees > 0 && <span className="ml-2 text-indigo-700">· {reportees} reportée(s)</span>}
      </div>
    </div>
  );
}

export default function CalendrierAbonnementModal({
  demande, open, onClose,
}: {
  demande: Demande | null;
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();

  const monthsList = useMemo(() => {
    if (!demande) return [] as Date[];
    const bounds = getBounds(demande);
    if (!bounds) return [new Date()];
    const list: Date[] = [];
    let cur = startOfMonth(bounds.start);
    const last = startOfMonth(bounds.end);
    while (cur <= last) {
      list.push(cur);
      cur = addMonths(cur, 1);
    }
    return list.length ? list : [startOfMonth(bounds.start)];
  }, [demande]);

  if (!demande) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-6">
            <span>Calendrier — {demande.nom_entreprise || demande.nom}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onClose();
                navigate(`/compte-client?id=${demande.id}&from=/gestion-abonnement&section=gestion-abonnement`);
              }}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Ouvrir la gestion
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className={`grid gap-4 ${monthsList.length > 1 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
          {monthsList.map((m) => (
            <MonthCalendar key={m.toISOString()} demande={demande} month={m} />
          ))}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap mt-2">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" /> À venir</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Terminé</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> Annulé</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> À récup.</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-500" /> Reportée</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
