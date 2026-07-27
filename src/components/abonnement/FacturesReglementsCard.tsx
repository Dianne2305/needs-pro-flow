/**
 * FacturesReglementsCard.tsx
 * Tableau "Factures & règlements" de l'abonnement (hors onglets mensuels).
 */
import { FileSpreadsheet } from "lucide-react";

export interface FactureLigne {
  reference: string;
  periode: string;
  montant: number;
  envoyeeLe: string;
  statut: { type: "envoyee" | "payee"; label: string };
}

interface Props {
  factures: FactureLigne[];
}

export default function FacturesReglementsCard({ factures }: Props) {
  return (
    <section className="rounded-xl border bg-background overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
        <FileSpreadsheet className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">Factures &amp; règlements</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-background">
              {["Facture", "Période", "Montant", "Envoyée le", "Statut"].map((h) => (
                <th key={h} className="text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-4 py-2.5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {factures.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground italic">
                  Aucune facture
                </td>
              </tr>
            ) : (
              factures.map((f) => (
                <tr key={f.reference} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{f.reference}</td>
                  <td className="px-4 py-3 text-muted-foreground">{f.periode}</td>
                  <td className="px-4 py-3 font-bold">{f.montant.toLocaleString("fr-FR")} DH</td>
                  <td className="px-4 py-3 text-muted-foreground">{f.envoyeeLe}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
                        f.statut.type === "payee"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-sky-100 text-sky-800"
                      }`}
                    >
                      {f.statut.label}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
