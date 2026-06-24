/**
 * OffrePromoDetailModal.tsx
 * Fiche détail d'un code promo : résumé, statistiques, journal des utilisations
 * (CDC v1 — manques M-06, M-07, M-08).
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { STATUT_OFFRE_COLORS } from "@/lib/marketing-constants";

interface Props {
  offre: any | null;
  onClose: () => void;
}

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  code_envoye: { label: "Code envoyé", color: "bg-blue-100 text-blue-800" },
  message_ouvert: { label: "Message ouvert", color: "bg-cyan-100 text-cyan-800" },
  lien_clique: { label: "Lien cliqué", color: "bg-indigo-100 text-indigo-800" },
  code_applique: { label: "Code appliqué", color: "bg-emerald-100 text-emerald-800" },
  code_refuse: { label: "Code refusé", color: "bg-red-100 text-red-800" },
};

export function OffrePromoDetailModal({ offre, onClose }: Props) {
  const { data: usages = [] } = useQuery({
    enabled: !!offre?.id,
    queryKey: ["promo_usages", offre?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promo_usages" as any)
        .select("*")
        .eq("offre_id", offre.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const stats = useMemo(() => {
    const envoye = usages.filter((u) => u.evenement === "code_envoye").length;
    const ouvert = usages.filter((u) => u.evenement === "message_ouvert").length;
    const clique = usages.filter((u) => u.evenement === "lien_clique").length;
    const applique = usages.filter((u) => u.evenement === "code_applique");
    const refuse = usages.filter((u) => u.evenement === "code_refuse");
    const montant = applique.reduce((acc, u) => acc + Number(u.montant_remise || 0), 0);
    const tauxOuv = envoye ? (ouvert / envoye) * 100 : 0;
    const tauxClic = ouvert ? (clique / ouvert) * 100 : 0;
    const tauxConv = clique ? (applique.length / clique) * 100 : 0;
    const reasons: Record<string, number> = {};
    refuse.forEach((r) => {
      const k = r.raison_refus || "Inconnue";
      reasons[k] = (reasons[k] || 0) + 1;
    });
    const topRefus = Object.entries(reasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    return { envoye, ouvert, clique, applique: applique.length, refuse: refuse.length, montant, tauxOuv, tauxClic, tauxConv, topRefus };
  }, [usages]);

  if (!offre) return null;
  const statutInfo = STATUT_OFFRE_COLORS[offre.statut] || STATUT_OFFRE_COLORS.active;
  const used = offre.nombre_utilisations || 0;
  const quota = offre.limite_utilisation;

  return (
    <Dialog open={!!offre} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {offre.nom}
            <Badge className={statutInfo.color}>{statutInfo.label}</Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Bloc résumé */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kpi label="Code" value={<span className="font-mono">{offre.code_promo || "—"}</span>} />
          <Kpi
            label="Réduction"
            value={
              offre.type_reduction === "abonnement_offert"
                ? "1 mois offert"
                : offre.type_reduction === "pourcentage"
                ? `-${offre.valeur_reduction}%`
                : `-${offre.valeur_reduction} MAD`
            }
          />
          <Kpi label="Taux d'ouverture" value={`${stats.tauxOuv.toFixed(1)}%`} />
          <Kpi label="Taux de clic" value={`${stats.tauxClic.toFixed(1)}%`} />
          <Kpi label="Taux de conversion" value={`${stats.tauxConv.toFixed(1)}%`} />
          <Kpi label="Refus" value={stats.refuse} />
        </div>

        {/* Top raisons refus */}
        {stats.topRefus.length > 0 && (
          <div className="rounded-md border p-3 bg-muted/30">
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Top raisons de refus</p>
            <ul className="text-sm space-y-1">
              {stats.topRefus.map(([raison, count]) => (
                <li key={raison} className="flex justify-between">
                  <span>{raison}</span>
                  <span className="font-mono text-muted-foreground">{count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Journal des utilisations */}
        <div>
          <h4 className="text-sm font-semibold mb-2">Journal des utilisations ({usages.length})</h4>
          <div className="rounded-md border max-h-80 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Événement</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Détail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                      Aucune utilisation enregistrée.
                    </TableCell>
                  </TableRow>
                ) : (
                  usages.map((u: any) => {
                    const ev = EVENT_LABELS[u.evenement] || { label: u.evenement, color: "bg-gray-100 text-gray-800" };
                    const detail =
                      u.evenement === "code_applique" && u.montant_remise
                        ? `${Number(u.montant_remise).toLocaleString()} MAD`
                        : u.evenement === "code_refuse"
                        ? u.raison_refus || "—"
                        : u.statut_envoi || "—";
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {format(new Date(u.created_at), "dd/MM/yy HH:mm", { locale: fr })}
                        </TableCell>
                        <TableCell><Badge className={ev.color}>{ev.label}</Badge></TableCell>
                        <TableCell className="text-sm">{u.client_nom || u.client_id || "—"}</TableCell>
                        <TableCell className="text-sm">{u.canal || "—"}</TableCell>
                        <TableCell className="text-sm">{detail}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Kpi({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border p-2 bg-card">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold mt-0.5">{value}</p>
    </div>
  );
}
