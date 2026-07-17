/**
 * CalendrierAbonnementModal.tsx
 * Raccourci : affiche le calendrier des interventions d'un abonnement en modal.
 */
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import {
  addMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay, parseISO, addDays,
} from "date-fns";
import { fr } from "date-fns/locale";
import { Tables } from "@/integrations/supabase/types";
import { useNavigate } from "react-router-dom";

type Demande = Tables<"demandes">;

interface DayInfo {
  date: Date;
  statut?: string;
  heure_debut?: string;
  heure_fin?: string;
}

function extractDays(d: Demande): DayInfo[] {
  const p = (d.planning as any) || {};
  const out: DayInfo[] = [];
  if (p.semaines?.length) {
    for (const sem of p.semaines) {
      const base = sem.semaine_debut ? parseISO(sem.semaine_debut) : null;
      if (!base) continue;
      for (const j of sem.jours || []) {
        const offset = typeof j.jour === "number" ? j.jour : 0;
        out.push({
          date: addDays(base, offset),
          statut: j.statut,
          heure_debut: j.heure_debut,
          heure_fin: j.heure_fin,
        });
      }
    }
  }
  return out;
}

const STATUT_STYLE: Record<string, { label: string; cls: string }> = {
  terminee: { label: "Terminé", cls: "bg-emerald-500 text-white" },
  annule: { label: "Annulé", cls: "bg-rose-500 text-white line-through" },
  a_venir: { label: "À venir", cls: "bg-primary text-primary-foreground" },
};

export default function CalendrierAbonnementModal({
  demande, open, onClose,
}: {
  demande: Demande | null;
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [cursor, setCursor] = useState<Date>(new Date());

  const days = useMemo(() => (demande ? extractDays(demande) : []), [demande]);
  const gridDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { locale: fr });
    const end = endOfWeek(endOfMonth(cursor), { locale: fr });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  if (!demande) return null;

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
          <Button size="icon" variant="ghost" onClick={() => setCursor(addMonths(cursor, -1))}>
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
            const info = days.find((di) => isSameDay(di.date, day));
            const inMonth = isSameMonth(day, cursor);
            const statut = info?.statut || (info ? "a_venir" : undefined);
            const style = statut ? STATUT_STYLE[statut] : null;
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

        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-3">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" /> À venir</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Terminé</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> Annulé</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
