/**
 * AbonnementHeaderCard.tsx
 * Bandeau d'en-tête de l'abonnement (référence, client, KPIs) + alerte 5ème semaine.
 */
import { Info } from "lucide-react";

interface Props {
  reference: string;
  nom: string;
  sousTitre: string;
  passages: number;
  reports: number;
  impayes: number;
  assiduite: number;
  cinquiemeSemaine?: {
    moisLabel: string;
    jourPluriel: string;
    dateLabel: string;
    montant: number;
  } | null;
}

export default function AbonnementHeaderCard({
  reference, nom, sousTitre, passages, reports, impayes, assiduite, cinquiemeSemaine,
}: Props) {
  const Stat = ({ value, label, accent }: { value: string; label: string; accent?: boolean }) => (
    <div className="px-4 sm:px-6 text-center">
      <div className={`text-xl font-bold leading-none ${accent ? "text-amber-300" : "text-primary-foreground"}`}>{value}</div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground/70">{label}</div>
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="rounded-xl bg-primary text-primary-foreground px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="min-w-0">
          <span className="inline-block rounded-md bg-primary-foreground/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide">
            {reference}
          </span>
          <h3 className="mt-1.5 text-lg font-bold truncate">{nom}</h3>
          <p className="text-xs text-primary-foreground/75 truncate">{sousTitre}</p>
        </div>
        <div className="flex items-center divide-x divide-primary-foreground/20 shrink-0">
          <Stat value={String(passages)} label="Passages réalisés" />
          <Stat value={String(reports)} label="Report" />
          <Stat value={String(impayes)} label="Impayé" />
          <Stat value={`${assiduite}%`} label="Assiduité" accent />
        </div>
      </div>

      {cinquiemeSemaine && (
        <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-2.5 flex gap-2.5">
          <Info className="h-4 w-4 text-violet-700 shrink-0 mt-0.5" />
          <div className="text-xs text-violet-900">
            <p className="font-bold">5ème semaine détectée — {cinquiemeSemaine.moisLabel}</p>
            <p className="mt-0.5">
              Le mois contient 5 {cinquiemeSemaine.jourPluriel}. Le passage du {cinquiemeSemaine.dateLabel} est facturé en
              complément au prorata : <b className="text-violet-800">+{Math.round(cinquiemeSemaine.montant)} DH</b> déjà
              intégrés à la facture de {cinquiemeSemaine.moisLabel}.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
