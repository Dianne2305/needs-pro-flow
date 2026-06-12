/**
 * AbonnementDetailModal.tsx
 * Modal de détail d'un abonnement : client, prestation, prochain RDV,
 * historique des interventions (planning + statuts), dernière relance.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { format, addDays, parseISO, differenceInCalendarDays } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import {
  User, Phone, MapPin, Briefcase, Repeat, Clock, Coins,
  CalendarCheck, History, Bell, CheckCircle2, Circle, UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Demande = Tables<"demandes">;
type Historique = Tables<"demande_historique">;

const FREQ_LABEL: Record<string, string> = {
  "1_fois_semaine": "1 fois / semaine",
  "2_fois_semaine": "2 fois / semaine",
  "3_fois_semaine": "3 fois / semaine",
  "4_fois_semaine": "4 fois / semaine",
  "5_fois_semaine": "5 fois / semaine",
  "6_fois_semaine": "6 fois / semaine",
  "quotidien": "7j / 7",
  "1_fois_mois": "1 fois / mois",
  "2_fois_mois": "2 fois / mois",
  "3_fois_mois": "3 fois / mois",
  "4_fois_mois": "4 fois / mois",
};

const JOUR_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

type Intervention = { date: Date; statut: "terminee" | "a_venir"; semaineLabel?: string };

function buildInterventions(d: Demande): Intervention[] {
  const out: Intervention[] = [];
  const planning = d.planning as any;
  if (planning?.semaines?.length) {
    planning.semaines.forEach((sem: any, idx: number) => {
      const base = sem.semaine_debut ? parseISO(sem.semaine_debut) : null;
      if (!base) return;
      for (const j of sem.jours || []) {
        const offset = typeof j.jour === "number" ? j.jour : 0;
        out.push({
          date: addDays(base, offset),
          statut: j.statut === "terminee" ? "terminee" : "a_venir",
          semaineLabel: `Semaine ${idx + 1}`,
        });
      }
    });
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

interface Props {
  demande: Demande | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AbonnementDetailModal({ demande, open, onOpenChange }: Props) {
  const navigate = useNavigate();

  const { data: lastRelance } = useQuery({
    queryKey: ["demande_historique", "last_relance", demande?.id],
    enabled: !!demande?.id && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("demande_historique")
        .select("*")
        .eq("demande_id", demande!.id)
        .eq("action", "relance_abonnement")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as Historique | null;
    },
  });

  const interventions = useMemo(() => demande ? buildInterventions(demande) : [], [demande]);
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  if (!demande) return null;

  const terminees = interventions.filter((i) => i.statut === "terminee");
  const aVenir = interventions.filter((i) => i.statut === "a_venir" && i.date >= today);
  const prochaine = aVenir[0];
  const jours = prochaine ? differenceInCalendarDays(prochaine.date, today) : null;
  const ttc = Number(demande.montant_total) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-base">Détail de l'abonnement</span>
              <Badge variant="outline" className="font-mono text-xs">#{demande.num_demande}</Badge>
              <Badge className={demande.type_service === "SPP" ? "bg-primary text-primary-foreground" : "bg-spe text-spe-foreground"}>
                {demande.type_service === "SPP" ? "Particulier" : "Entreprise"}
              </Badge>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { onOpenChange(false); navigate(`/compte-client?id=${demande.id}&from=/clients/abonnements`); }}>
              <UserCheck className="h-4 w-4" /> Compte client
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Client */}
          <section className="border rounded-lg p-3 space-y-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <User className="h-4 w-4 text-primary" /> Client
            </h3>
            <Separator />
            <InfoRow label="Nom" value={demande.nom} />
            {demande.telephone_direct && <InfoRow icon={<Phone className="h-3 w-3" />} label="Téléphone" value={demande.telephone_direct} />}
            {demande.telephone_whatsapp && <InfoRow icon={<Phone className="h-3 w-3" />} label="WhatsApp" value={demande.telephone_whatsapp} />}
            {(demande.quartier || demande.ville) && (
              <InfoRow icon={<MapPin className="h-3 w-3" />} label="Adresse" value={[demande.adresse, demande.quartier, demande.ville].filter(Boolean).join(" — ")} />
            )}
          </section>

          {/* Prestation */}
          <section className="border rounded-lg p-3 space-y-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Briefcase className="h-4 w-4 text-primary" /> Prestation
            </h3>
            <Separator />
            <InfoRow label="Service" value={demande.type_prestation} />
            <InfoRow icon={<Repeat className="h-3 w-3" />} label="Fréquence" value={FREQ_LABEL[demande.frequence || ""] || demande.frequence || "—"} />
            {demande.duree_heures && <InfoRow icon={<Clock className="h-3 w-3" />} label="Durée" value={`${demande.duree_heures}h × ${demande.nombre_intervenants || 1} intervenant(s)`} />}
            <InfoRow icon={<Coins className="h-3 w-3" />} label="Montant / intervention" value={`${ttc.toLocaleString("fr-FR")} DH`} />
          </section>

          {/* Prochain rendez-vous */}
          <section className="border rounded-lg p-3 space-y-2 md:col-span-1">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <CalendarCheck className="h-4 w-4 text-primary" /> Prochain rendez-vous
            </h3>
            <Separator />
            {prochaine ? (
              <div className="space-y-1.5">
                <div className="text-lg font-semibold capitalize">
                  {format(prochaine.date, "EEEE dd MMMM yyyy", { locale: fr })}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn(
                    jours !== null && jours < 0 && "bg-red-100 text-red-700 border-red-300",
                    jours !== null && jours >= 0 && jours <= 3 && "bg-orange-100 text-orange-700 border-orange-300",
                    jours !== null && jours > 3 && jours <= 7 && "bg-yellow-100 text-yellow-800 border-yellow-300",
                    jours !== null && jours > 7 && "bg-emerald-100 text-emerald-700 border-emerald-300",
                  )}>
                    {jours === 0 ? "Aujourd'hui" : jours! < 0 ? `${Math.abs(jours!)}j en retard` : `J-${jours}`}
                  </Badge>
                  {prochaine.semaineLabel && <span className="text-xs text-muted-foreground">{prochaine.semaineLabel}</span>}
                </div>
                {demande.heure_prestation && <div className="text-xs text-muted-foreground">à {demande.heure_prestation}</div>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Aucun rendez-vous planifié</p>
            )}
          </section>

          {/* Dernière relance */}
          <section className="border rounded-lg p-3 space-y-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Bell className="h-4 w-4 text-primary" /> Dernière relance
            </h3>
            <Separator />
            {lastRelance ? (
              <div className="space-y-1 text-sm">
                <div className="font-medium">{format(new Date(lastRelance.created_at), "dd/MM/yyyy 'à' HH:mm", { locale: fr })}</div>
                <div className="text-muted-foreground">{lastRelance.details}</div>
                {lastRelance.utilisateur && <div className="text-xs text-muted-foreground">Par {lastRelance.utilisateur}</div>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">Aucune relance enregistrée</p>
            )}
          </section>
        </div>

        {/* Historique interventions */}
        <section className="border rounded-lg p-3 space-y-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <History className="h-4 w-4 text-primary" /> Historique des interventions
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {terminees.length} terminée(s) • {aVenir.length} à venir
            </span>
          </h3>
          <Separator />
          {interventions.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-2">Aucun planning défini pour cet abonnement.</p>
          ) : (
            <ul className="divide-y max-h-64 overflow-y-auto">
              {interventions.map((it, idx) => {
                const isPast = it.date < today;
                const dow = (it.date.getDay() + 6) % 7;
                return (
                  <li key={idx} className="flex items-center gap-3 py-2 text-sm">
                    {it.statut === "terminee" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Circle className={cn("h-4 w-4 shrink-0", isPast ? "text-red-500" : "text-muted-foreground")} />
                    )}
                    <div className="flex-1">
                      <div className="font-medium">
                        {JOUR_LABELS[dow]} {format(it.date, "dd/MM/yyyy")}
                      </div>
                      {it.semaineLabel && <div className="text-xs text-muted-foreground">{it.semaineLabel}</div>}
                    </div>
                    <Badge variant="outline" className={cn(
                      "text-xs",
                      it.statut === "terminee" ? "bg-emerald-100 text-emerald-700 border-emerald-300" :
                      isPast ? "bg-red-100 text-red-700 border-red-300" : "bg-muted text-muted-foreground"
                    )}>
                      {it.statut === "terminee" ? "Terminée" : isPast ? "Non effectuée" : "À venir"}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string | null; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-xs text-muted-foreground w-28 shrink-0 flex items-center gap-1">{icon}{label}</span>
      <span className="font-medium flex-1 break-words">{value || "—"}</span>
    </div>
  );
}
