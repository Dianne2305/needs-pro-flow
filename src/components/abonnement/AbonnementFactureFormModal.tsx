/**
 * AbonnementFactureFormModal.tsx
 * Formulaire de facturation intelligent pour un abonnement mensuel.
 * Gère les interventions reportées (déjà payées, non refacturées) et calcule
 * automatiquement le montant HT/TTC des nouvelles interventions à facturer.
 */
import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { FileText, Receipt, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export interface FactureFormData {
  clientNom: string;
  numAbonnement: string | number;
  monthLabel: string;
  typePrestation: string;
  frequenceLabel: string;
  /** Interventions prévues pour la période (calendrier). */
  interventionsPrevues: number;
  /** Interventions reportées des mois précédents, déjà payées. */
  reportesPayees: number;
  /** Crédits "à récupérer" restants sur l'abonnement (lecture seule). */
  creditsRestants: number;
  /** Prix unitaire calculé (montant total / total interventions). */
  prixUnitaire: number;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  data: FactureFormData | null;
  /** Champs éditables des paramètres de l'abonnement (optionnel). */
  paramsSection?: React.ReactNode;
  onValidate?: (result: {
    nouvellesInterventions: number;
    prixUnitaire: number;
    remise: number;
    tvaPct: number;
    totalHT: number;
    totalTTC: number;
  }) => void;
}

export default function AbonnementFactureFormModal({ open, onOpenChange, data, paramsSection, onValidate }: Props) {
  const [prix, setPrix] = useState<string>("");
  const [remise, setRemise] = useState<string>("0");
  const [tva, setTva] = useState<string>("20");

  useEffect(() => {
    if (data && open) {
      setPrix(data.prixUnitaire > 0 ? String(Math.round(data.prixUnitaire * 100) / 100) : "");
      setRemise("0");
      setTva("20");
    }
  }, [data, open]);

  const calc = useMemo(() => {
    if (!data) return null;
    const nouvelles = Math.max(0, data.interventionsPrevues - data.reportesPayees);
    const totalPlanifiees = data.interventionsPrevues; // nouvelles + reportées effectuées
    const p = parseFloat(prix) || 0;
    const r = parseFloat(remise) || 0;
    const t = parseFloat(tva) || 0;
    const montantBrut = p * nouvelles;
    const totalHT = Math.max(0, montantBrut - r);
    const totalTTC = totalHT * (1 + t / 100);
    return { nouvelles, totalPlanifiees, montantBrut, totalHT, totalTTC, p, r, t };
  }, [data, prix, remise, tva]);

  if (!data) return null;

  const handleValidate = () => {
    if (!calc) return;
    onValidate?.({
      nouvellesInterventions: calc.nouvelles,
      prixUnitaire: calc.p,
      remise: calc.r,
      tvaPct: calc.t,
      totalHT: calc.totalHT,
      totalTTC: calc.totalTTC,
    });
    toast({ title: "Facture préparée", description: `${calc.nouvelles} intervention(s) · ${Math.round(calc.totalTTC).toLocaleString("fr-FR")} DH TTC` });
    onOpenChange(false);
  };

  const fmt = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" /> Formulaire de facturation — Abonnement
          </DialogTitle>
          <DialogDescription>
            Une intervention n'est facturée qu'une seule fois. Les interventions reportées (déjà payées) sont exclues du montant.
          </DialogDescription>
        </DialogHeader>

        {/* Informations générales */}
        <section className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <h3 className="text-sm font-semibold text-primary">Informations générales</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <div><span className="text-muted-foreground">Client : </span><span className="font-medium">{data.clientNom}</span></div>
            <div><span className="text-muted-foreground">N° abonnement : </span><span className="font-medium">#{data.numAbonnement}</span></div>
            <div><span className="text-muted-foreground">Période : </span><span className="font-medium">{data.monthLabel}</span></div>
            <div><span className="text-muted-foreground">Type prestation : </span><span className="font-medium">{data.typePrestation || "—"}</span></div>
            <div><span className="text-muted-foreground">Fréquence : </span><span className="font-medium">{data.frequenceLabel || "—"}</span></div>
            <div><span className="text-muted-foreground">Interventions prévues : </span><span className="font-medium">{data.interventionsPrevues}</span></div>
          </div>
        </section>

        {/* Calcul des interventions */}
        <section className="rounded-lg border bg-background p-3 space-y-2">
          <h3 className="text-sm font-semibold text-primary">Calcul des interventions</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Row label="Interventions prévues" value={data.interventionsPrevues} />
            <Row label="Reportées des mois précédents (déjà payées)" value={data.reportesPayees} tone="indigo" />
            <Row label="Total interventions planifiées" value={calc!.totalPlanifiees} strong />
            <Row label="Nouvelles interventions à facturer" value={calc!.nouvelles} tone="emerald" strong />
            <Row label="Interventions déjà payées (lecture seule)" value={data.reportesPayees} tone="indigo" />
            <Row label="Crédits à récupérer restants" value={data.creditsRestants} tone="amber" />
          </div>
        </section>

        {/* Tarification */}
        <section className="rounded-lg border bg-background p-3 space-y-3">
          <h3 className="text-sm font-semibold text-primary">Tarification</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="prix" className="text-xs">Prix unitaire (DH)</Label>
              <Input id="prix" type="number" step="0.01" min="0" value={prix} onChange={(e) => setPrix(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="remise" className="text-xs">Remise (DH)</Label>
              <Input id="remise" type="number" step="0.01" min="0" value={remise} onChange={(e) => setRemise(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tva" className="text-xs">TVA (%)</Label>
              <Input id="tva" type="number" step="0.01" min="0" value={tva} onChange={(e) => setTva(e.target.value)} />
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Montant nouvelles interventions</span><span className="font-medium">{fmt(calc!.montantBrut)} DH</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Remise</span><span className="font-medium">− {fmt(calc!.r)} DH</span></div>
            <div className="flex justify-between border-t pt-1.5"><span className="text-muted-foreground">Total HT</span><span className="font-semibold">{fmt(calc!.totalHT)} DH</span></div>
            <div className="flex justify-between border-t pt-1.5"><span className="text-muted-foreground">TVA ({calc!.t}%)</span><span className="font-medium">{fmt(calc!.totalHT * calc!.t / 100)} DH</span></div>
            <div className="col-span-2 flex justify-between border-t pt-2 text-base"><span className="font-semibold text-primary">Total TTC</span><span className="font-bold text-primary">{fmt(calc!.totalTTC)} DH</span></div>
          </div>
        </section>

        {/* Aperçu */}
        <section className="rounded-lg border-2 border-emerald-200 bg-emerald-50/60 p-3 space-y-1.5 text-sm">
          <h3 className="text-sm font-semibold text-emerald-900 flex items-center gap-1.5"><Info className="h-4 w-4" /> Aperçu de la facturation</h3>
          <ul className="text-emerald-900 space-y-0.5">
            <li>Interventions prévues ce mois : <b>{data.interventionsPrevues}</b></li>
            <li>Interventions reportées (déjà payées) : <b>{data.reportesPayees}</b></li>
            <li>Nouvelles interventions facturables : <b>{calc!.nouvelles}</b></li>
            <li>Prix unitaire : <b>{fmt(calc!.p)} DH</b></li>
            <li className="pt-1">Montant à facturer : <b>{calc!.nouvelles} × {fmt(calc!.p)} DH = {fmt(calc!.montantBrut)} DH</b></li>
          </ul>
          <div className="text-[11px] text-emerald-800/80 italic pt-1">
            Interventions déjà réglées : {data.reportesPayees} · Interventions facturées ce mois : {calc!.nouvelles}
          </div>
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
          <Button onClick={handleValidate} className="gap-1.5"><FileText className="h-4 w-4" /> Valider la facture</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, tone, strong }: { label: string; value: number; tone?: "emerald" | "indigo" | "amber"; strong?: boolean }) {
  const toneCls =
    tone === "emerald" ? "text-emerald-800 bg-emerald-50 border-emerald-200" :
    tone === "indigo" ? "text-indigo-800 bg-indigo-50 border-indigo-200" :
    tone === "amber" ? "text-amber-900 bg-amber-50 border-amber-200" :
    "text-foreground bg-muted border-border";
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs ${strong ? "font-bold" : "font-medium"} ${toneCls}`}>{value}</span>
    </div>
  );
}
