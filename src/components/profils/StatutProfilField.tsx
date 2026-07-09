/**
 * StatutProfilField.tsx
 * Sélecteur du statut profil FDM avec options conditionnelles :
 *  - "stand_by"  → nombre de jours de suspension.
 *  - "en_conge"  → dates début / fin du congé.
 * Le retour automatique au statut "active" est calculé côté client via
 * `computeStatutEffectif` dans profil-constants.
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUT_PROFIL_OPTIONS } from "@/lib/profil-constants";

export interface StatutProfilValue {
  statut: string;
  standbyJours?: number | null;
  congeDebut?: string | null;
  congeFin?: string | null;
}

interface Props {
  value: StatutProfilValue;
  onChange: (next: StatutProfilValue) => void;
  idPrefix?: string;
}

export function StatutProfilField({ value, onChange, idPrefix = "statut" }: Props) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold">Statut du profil</Label>
      <Select
        value={value.statut || "nouveau"}
        onValueChange={statut => onChange({ ...value, statut })}
      >
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {STATUT_PROFIL_OPTIONS.map(s => (
            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value.statut === "stand_by" && (
        <div>
          <Label className="text-xs">Nombre de jours en stand by</Label>
          <Input
            type="number"
            min={1}
            value={value.standbyJours ?? ""}
            onChange={e => onChange({ ...value, standbyJours: e.target.value ? Number(e.target.value) : null })}
            placeholder="Ex: 7"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Le profil reviendra automatiquement en statut « Active » à l'expiration.
          </p>
        </div>
      )}

      {value.statut === "en_conge" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Du</Label>
            <Input
              type="date"
              value={value.congeDebut || ""}
              onChange={e => onChange({ ...value, congeDebut: e.target.value || null })}
            />
          </div>
          <div>
            <Label className="text-xs">Au</Label>
            <Input
              type="date"
              value={value.congeFin || ""}
              onChange={e => onChange({ ...value, congeFin: e.target.value || null })}
            />
          </div>
          <p className="col-span-2 text-[11px] text-muted-foreground">
            Retour automatique en « Active » après la date de fin.
          </p>
        </div>
      )}
    </div>
  );
}
