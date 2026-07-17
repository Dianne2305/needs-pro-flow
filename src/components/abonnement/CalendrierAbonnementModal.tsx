/**
 * CalendrierAbonnementModal.tsx
 * Raccourci : affiche le calendrier mensuel des interventions d'un abonnement,
 * généré automatiquement à partir de planning.abo_jours + date_debut + date_overrides
 * (même logique que la section Gestion de l'abonnement dans CompteClient).
 */
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import {
  addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
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

function buildInterventions(demande: Demande, month: Date): DayInfo[] {
  const p = ((demande as any).planning || {}) as any;
  const aboJours: { jour: string; heure_debut?: string; heure_fin?: string }[] =
    Array.isArray(p.abo_jours) ? p.abo_jours
    : Array.isArray(p.jours) ? p.jours.map((j: any) => typeof j === "string" ? { jour: j } : j)
    : [];
  const dateDebutStr = p.date_debut || (demande.date_prestation as unknown as string) || null;
  const dateFinStr: string | null = p.date_fin || null;
  const aboFrequence: string = p.abo_frequence || p.frequence || demande.frequence || "";
  const overrides: Record<string, Override> = p.date_overrides || {};

  const heureByDow: Record<number, string | undefined> = {};
  aboJours.forEach((j) => { heureByDow[DAY_MAP[j.jour]] = j.heure_debut; });
  const selectedDows = aboJours.map((j) => DAY_MAP[j.jour]).filter((n) => n !== undefined);

  const interventionSet = new Set<string>();
  if (dateDebutStr && selectedDows.length > 0) {
    let start: Date;
    try { start = parseISO(dateDebutStr); } catch { start = new Date(); }
    let end: Date;
    try {
      end = dateFinStr
        ? parseISO(dateFinStr)
        : addMonths(start, typeof p.duree_mois === "number" ? p.duree_mois : 1);
    } catch { end = addMonths(start, 1); }
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

export default function CalendrierAbonnementModal({
  demande, open, onClose,
}: {
  demande: Demande | null;
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [cursor, setCursor] = useState<Date>(() => {
    const p = (demande as any)?.planning;
    if (p?.date_debut) { try { return parseISO(p.date_debut); } catch { /* noop */ } }
    return new Date();
  });

  const interventions = useMemo(() => (demande ? buildInterventions(demande, cursor) : []), [demande, cursor]);
  const gridDays = useMemo(() => {
    const s = startOfWeek(startOfMonth(cursor), { locale: fr });
    const e = endOfWeek(endOfMonth(cursor), { locale: fr });
    return eachDayOfInterval({ start: s, end: e });
  }, [cursor]);

  if (!demande) return null;

  const totalMois = interventions.filter((i) => i.statut !== "annule" && i.statut !== "a_recuperer").length;
  const annulees = interventions.filter((i) => i.statut === "annule").length;
  const aRecuperer = interventions.filter((i) => i.statut === "a_recuperer").length;
  const reportees = interventions.filter((i) => i.statut === "reportee").length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
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

        <div className="flex items-center justify-between mb-2">
          <Button size="icon" variant="ghost" onClick={() => setCursor(subMonths(cursor, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="font-semibold capitalize">{format(cursor, "MMMM yyyy", { locale: fr })}</div>
          <Button size="icon" variant="ghost" onClick={() => setCursor(addMonths(cursor, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-[11px] font-semibold text-muted-foreground uppercase mb-1">
          {["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"].map((d) => (
            <div key={d} className="text-center py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {gridDays.map((day) => {
            const info = interventions.find((di) => isSameDay(di.date, day));
            const inMonth = isSameMonth(day, cursor);
            const style = info ? STATUT_STYLE[info.statut] : null;
            return (
              <div
                key={day.toISOString()}
                className={`min-h-[72px] border rounded p-1 text-xs flex flex-col ${inMonth ? "bg-background" : "bg-muted/30 text-muted-foreground"}`}
              >
                <div className="text-right font-medium">{format(day, "d")}</div>
                {info && style && (
                  <div className="mt-auto space-y-0.5">
                    <Badge className={`w-full justify-center ${style.cls} text-[9px] px-1 py-0`}>{style.label}</Badge>
                    {(info.heure_debut || info.heure_fin) && (
                      <div className="text-[10px] text-center text-muted-foreground">
                        {info.heure_debut || "?"}{info.heure_fin ? `–${info.heure_fin}` : ""}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between mt-3 text-xs flex-wrap gap-2">
          <div className="flex items-center gap-3 text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" /> À venir</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Terminé</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> Annulé</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> À récup.</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-500" /> Reportée</span>
          </div>
          <div className="text-muted-foreground">
            <span className="font-semibold text-foreground">{totalMois}</span> intervention(s)
            {annulees > 0 && <span className="ml-2 text-rose-600">· {annulees} annulée(s)</span>}
            {aRecuperer > 0 && <span className="ml-2 text-amber-700">· {aRecuperer} à récupérer</span>}
            {reportees > 0 && <span className="ml-2 text-indigo-700">· {reportees} reportée(s)</span>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
