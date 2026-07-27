/**
 * AbonnementSidePanel.tsx
 * Colonne latérale de la section "Gestion de l'abonnement" :
 * prochain passage, intervenantes habituelles, infos terrain,
 * journal de l'abonnement et actions rapides.
 */
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ChevronsRight, Users, Star, Check, MapPin, KeyRound, Building2,
  Cat, ShoppingBasket, MessageCircle, Plus, ScrollText, Pause,
  Pencil, XCircle, Info,
} from "lucide-react";

export interface JournalEntry {
  date: string;
  texte: string;
}

export interface IntervenanteItem {
  nom: string;
  passages: number;
  note?: string;
}

export interface InfoTerrainItem {
  icon?: React.ReactNode;
  texte: string;
}

interface Props {
  prochainDate: Date | null;
  prochainHeure?: string;
  dureeHeures?: number;
  avecProduit?: boolean;
  intervenanteAssignee?: string | null;
  intervenantes?: IntervenanteItem[];
  infosTerrain?: InfoTerrainItem[];
  journal?: JournalEntry[];
  onSuspendre?: () => void;
  onModifierJours?: () => void;
  onContacter?: () => void;
  onResilier?: () => void;
}

const DOT_COLORS = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-600", "bg-teal-700"];

export default function AbonnementSidePanel({
  prochainDate,
  prochainHeure,
  dureeHeures,
  avecProduit,
  intervenanteAssignee,
  intervenantes = [],
  infosTerrain = [],
  journal = [],
  onSuspendre,
  onModifierJours,
  onContacter,
  onResilier,
}: Props) {
  const joursRestants = prochainDate
    ? Math.ceil((prochainDate.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000)
    : null;

  return (
    <aside className="space-y-4">
      {/* Prochain passage */}
      <section className="rounded-xl border border-amber-200 bg-amber-50/50 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-amber-200 bg-amber-100/60">
          <ChevronsRight className="h-4 w-4 text-amber-700" />
          <span className="text-sm font-semibold text-amber-900">Prochain passage</span>
        </div>
        <div className="p-3 space-y-2">
          {prochainDate ? (
            <>
              <div className="text-base font-bold capitalize">
                {format(prochainDate, "EEEE d MMMM", { locale: fr })}
                {prochainHeure ? ` · ${prochainHeure}` : ""}
              </div>
              <div className="text-xs text-muted-foreground">
                {dureeHeures ? `${dureeHeures}h` : "—"}{avecProduit ? " — avec option produits" : ""}
              </div>
              <Badge variant="outline" className="border-amber-300 bg-amber-100/70 text-amber-900 text-[11px] font-medium">
                → Remonté au Tableau de bord {joursRestants !== null ? `(J${joursRestants > 0 ? "-" + joursRestants : joursRestants === 0 ? "0" : "+" + Math.abs(joursRestants)})` : ""}
              </Badge>
              <div className="text-sm pt-1">
                <span className="font-semibold">Intervenante : </span>
                <span className={intervenanteAssignee ? "font-medium" : "text-amber-800 font-medium"}>
                  {intervenanteAssignee || "À assigner par la chargée opérationnelle"}
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground italic">Aucun passage planifié</p>
          )}
        </div>
      </section>

      {/* Intervenantes habituelles */}
      <section className="rounded-xl border bg-background overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Intervenantes habituelles</span>
        </div>
        <div className="p-3 space-y-2">
          {intervenantes.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Aucune intervenante enregistrée</p>
          ) : (
            intervenantes.map((iv, i) => (
              <div key={iv.nom} className="flex items-start gap-2 text-sm border-b last:border-0 pb-2 last:pb-0">
                <span className="mt-0.5 shrink-0">
                  {i === 0 ? <Star className="h-4 w-4 text-amber-500 fill-amber-400" />
                    : i === 1 ? <Check className="h-4 w-4 text-muted-foreground" />
                    : <span className="block h-1.5 w-1.5 rounded-full bg-muted-foreground/60 mt-1.5 ml-1" />}
                </span>
                <span>
                  <span className="font-semibold">{iv.nom}</span>
                  <span className="text-muted-foreground"> — {iv.passages} passage{iv.passages > 1 ? "s" : ""}</span>
                  {iv.note && <span className="text-muted-foreground"> · {iv.note}</span>}
                </span>
              </div>
            ))
          )}
          <p className="flex gap-1.5 text-[11px] text-muted-foreground italic pt-1">
            <Info className="h-3 w-3 shrink-0 mt-0.5" />
            Continuité non garantie contractuellement — priorité donnée à la première intervenante quand disponible.
          </p>
        </div>
      </section>

      {/* Infos terrain */}
      <section className="rounded-xl border bg-background overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-rose-600" />
            <span className="text-sm font-semibold">Infos terrain</span>
          </div>
          <Button size="icon" variant="outline" className="h-6 w-6">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <ul className="p-3 space-y-2 text-sm">
          {infosTerrain.length === 0 ? (
            <li className="text-muted-foreground italic">Aucune info terrain</li>
          ) : (
            infosTerrain.map((it, i) => (
              <li key={i} className="flex items-start gap-2 border-b last:border-0 pb-2 last:pb-0">
                <span className="shrink-0 mt-0.5">{it.icon ?? <Building2 className="h-4 w-4 text-muted-foreground" />}</span>
                <span>{it.texte}</span>
              </li>
            ))
          )}
        </ul>
      </section>

      {/* Journal de l'abonnement */}
      <section className="rounded-xl border bg-background overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
          <ScrollText className="h-4 w-4 text-amber-700" />
          <span className="text-sm font-semibold">Journal de l'abonnement</span>
        </div>
        <ul className="p-3 space-y-3 text-sm">
          {journal.length === 0 ? (
            <li className="text-muted-foreground italic">Aucun évènement</li>
          ) : (
            journal.map((e, i) => (
              <li key={i} className="grid grid-cols-[68px_1fr] gap-2 items-start">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground pt-0.5">
                  <span className={`h-2 w-2 rounded-full ${DOT_COLORS[i % DOT_COLORS.length]}`} />
                  {e.date}
                </span>
                <span className="text-sky-900">{e.texte}</span>
              </li>
            ))
          )}
        </ul>
      </section>

      {/* Actions */}
      <section className="rounded-xl border bg-background overflow-hidden">
        <div className="px-3 py-2 border-b bg-muted/30">
          <span className="text-sm font-semibold">Actions</span>
        </div>
        <div className="p-3 space-y-2">
          <Button variant="outline" className="w-full justify-start gap-2 h-9 text-xs" onClick={onSuspendre}>
            <Pause className="h-3.5 w-3.5" /> Suspendre temporairement (vacances)
          </Button>
          <Button variant="outline" className="w-full justify-start gap-2 h-9 text-xs" onClick={onModifierJours}>
            <Pencil className="h-3.5 w-3.5 text-amber-600" /> Modifier jours / heures
          </Button>
          <Button variant="outline" className="w-full justify-start gap-2 h-9 text-xs" onClick={onContacter}>
            <MessageCircle className="h-3.5 w-3.5 text-emerald-600" /> Contacter le client (WhatsApp)
          </Button>
          <Separator />
          <Button variant="outline" className="w-full justify-start gap-2 h-9 text-xs text-destructive hover:text-destructive" onClick={onResilier}>
            <XCircle className="h-3.5 w-3.5" /> Résilier l'abonnement
          </Button>
        </div>
      </section>
    </aside>
  );
}

export const DEFAULT_INFOS_TERRAIN_ICONS = { KeyRound, Cat, ShoppingBasket, MessageCircle, Building2 };
