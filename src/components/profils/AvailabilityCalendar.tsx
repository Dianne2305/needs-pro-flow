/**
 * AvailabilityCalendar.tsx
 * Calendrier de disponibilité hebdomadaire d'un profil FDM.
 * - Une ligne par jour (lundi → dimanche).
 * - Case à cocher "Actif" + deux inputs horaires (début / fin).
 * - Utilisé dans AddProfilModal et EditProfilModal.
 */
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  JOURS_SEMAINE,
  DEFAULT_DISPONIBILITE_CALENDRIER,
  type DisponibiliteCalendrier,
} from "@/lib/profil-constants";

interface Props {
  value: DisponibiliteCalendrier;
  onChange: (next: DisponibiliteCalendrier) => void;
}

export function AvailabilityCalendar({ value, onChange }: Props) {
  // Fusion avec défaut pour tolérer une valeur partielle
  const cal: DisponibiliteCalendrier = { ...DEFAULT_DISPONIBILITE_CALENDRIER, ...(value || {}) };

  const setJour = (key: string, patch: Partial<DisponibiliteCalendrier[string]>) => {
    onChange({ ...cal, [key]: { ...cal[key], ...patch } });
  };

  return (
    <div className="border rounded-lg divide-y">
      {JOURS_SEMAINE.map(j => {
        const jour = cal[j.key];
        return (
          <div key={j.key} className="flex items-center gap-3 px-3 py-2">
            <div className="flex items-center gap-2 w-28 shrink-0">
              <Checkbox
                id={`dispo-${j.key}`}
                checked={jour.actif}
                onCheckedChange={v => setJour(j.key, { actif: !!v })}
              />
              <Label htmlFor={`dispo-${j.key}`} className="text-sm cursor-pointer">
                {j.label}
              </Label>
            </div>
            <div className="flex items-center gap-2 flex-1">
              <Input
                type="time"
                value={jour.debut}
                disabled={!jour.actif}
                onChange={e => setJour(j.key, { debut: e.target.value })}
                className="h-8 text-xs w-28"
              />
              <span className="text-xs text-muted-foreground">à</span>
              <Input
                type="time"
                value={jour.fin}
                disabled={!jour.actif}
                onChange={e => setJour(j.key, { fin: e.target.value })}
                className="h-8 text-xs w-28"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
