/**
 * PaiementDeuxFoisFields.tsx
 * Champs communs au paiement en deux fois (virement + espèces) et à la gestion
 * du reste à payer (récupéré par la FDM ou par l'agence).
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RECUPERATEURS_ESPECES, RECUPERATEUR_LABEL } from "@/lib/constants";

export interface PaiementDeuxFoisValue {
  montant_virement: string;
  montant_especes: string;
  especes_recupere_par: string;
}

interface Props {
  value: PaiementDeuxFoisValue;
  onChange: (patch: Partial<PaiementDeuxFoisValue>) => void;
  /** Montant total attendu, pour afficher le contrôle de cohérence. */
  montantTotal?: number;
  className?: string;
}

/** Bloc « Paiement en deux fois » : montant viré + montant en espèces et son récupérateur. */
export function PaiementDeuxFoisFields({ value, onChange, montantTotal = 0, className = "" }: Props) {
  const virement = Number(value.montant_virement) || 0;
  const especes = Number(value.montant_especes) || 0;
  const cumul = virement + especes;
  const ecart = montantTotal - cumul;

  return (
    <div className={`p-4 rounded-lg border border-indigo-200 bg-indigo-50/60 space-y-3 ${className}`}>
      <h4 className="text-sm font-bold text-indigo-900">Paiement en deux fois (virement + espèces)</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Virement (MAD)</Label>
          <Input
            type="number"
            value={value.montant_virement}
            onChange={(e) => onChange({ montant_virement: e.target.value })}
            placeholder="0"
          />
        </div>
        <div>
          <Label className="text-xs">Espèces (MAD)</Label>
          <Input
            type="number"
            value={value.montant_especes}
            onChange={(e) => onChange({ montant_especes: e.target.value })}
            placeholder="0"
          />
        </div>
        <div>
          <Label className="text-xs">Espèces récupérées</Label>
          <Select
            value={value.especes_recupere_par || undefined}
            onValueChange={(v) => onChange({ especes_recupere_par: v })}
          >
            <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
            <SelectContent>
              {RECUPERATEURS_ESPECES.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap gap-6 text-xs text-indigo-900">
        <p>Virement : <strong>{virement.toLocaleString("fr-MA")} DH</strong></p>
        <p>Espèces : <strong>{especes.toLocaleString("fr-MA")} DH</strong>
          {value.especes_recupere_par ? ` (${RECUPERATEUR_LABEL[value.especes_recupere_par]})` : ""}
        </p>
        <p>Total réglé : <strong>{cumul.toLocaleString("fr-MA")} DH</strong></p>
      </div>
      {montantTotal > 0 && Math.abs(ecart) > 0.01 && (
        <p className={`text-xs font-medium ${ecart > 0 ? "text-amber-700" : "text-rose-700"}`}>
          {ecart > 0
            ? `Reste à payer : ${ecart.toLocaleString("fr-MA")} DH`
            : `Dépassement de ${Math.abs(ecart).toLocaleString("fr-MA")} DH par rapport au montant total`}
        </p>
      )}
    </div>
  );
}

interface ResteProps {
  value: string;
  onChange: (v: string) => void;
  reste: number;
  className?: string;
}

/** Cases « Reste à FDM » / « Reste à agence » affichées sous le montant versé. */
export function ResteAPayerCases({ value, onChange, reste, className = "" }: ResteProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-xs">Reste à payer récupéré par</Label>
      <div className="flex gap-2">
        {RECUPERATEURS_ESPECES.map((r) => {
          const active = value === r.value;
          return (
            <button
              key={r.value}
              type="button"
              onClick={() => onChange(active ? "" : r.value)}
              className={`flex-1 text-xs font-medium px-2 py-2 rounded-md border transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted border-input"
              }`}
            >
              {r.value === "fdm" ? "Reste à FDM" : "Reste à agence"}
            </button>
          );
        })}
      </div>
      {value && reste > 0 && (
        <p className="text-xs text-muted-foreground">
          {reste.toLocaleString("fr-MA")} DH à récupérer en espèces par {value === "fdm" ? "la femme de ménage" : "l'agence"}.
        </p>
      )}
    </div>
  );
}
