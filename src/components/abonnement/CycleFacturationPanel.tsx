/**
 * CycleFacturationPanel.tsx
 * Vue "Cycle de facturation" : frise du cycle, voyants, table des factures
 * et rappel des automatismes.
 */
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Download, Settings2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type Etape = { titre: string; l1: string; l2?: string; accent?: boolean };

type FactureLigne = {
  reference: string;
  client: string;
  periode: string;
  montant: number;
  statut: string;
  ton: "info" | "ok" | "warn" | "danger" | "neutre";
  action: string;
  actionVariant?: "outline" | "default";
};

const LIGNES: FactureLigne[] = [
  { reference: "AM/F118/2026", client: "Sofia BENNANI", periode: "Juillet", montant: 1944, statut: "Envoyée — éch. 20/06", ton: "info", action: "Relancer", actionVariant: "outline" },
  { reference: "AM/F121/2026", client: "SMILE+ (bureaux)", periode: "Juillet", montant: 2851, statut: "Payée le 17/06", ton: "ok", action: "Reçu", actionVariant: "outline" },
  { reference: "AM/F103/2026", client: "Rachid EL AMRANI", periode: "Juin", montant: 1512, statut: "Retard J+11 — mise en demeure", ton: "warn", action: "Voir dossier", actionVariant: "default" },
  { reference: "AM/F097/2026", client: "Youssef KABBAJ", periode: "Juin", montant: 1296, statut: "Suspendu J+16", ton: "danger", action: "Voir dossier", actionVariant: "default" },
  { reference: "AM/F124/2026", client: "Famille TAZI (aux. vie)", periode: "Sem. 25", montant: 775, statut: "Hebdo — éch. mer 17/06", ton: "info", action: "Relancer", actionVariant: "outline" },
  { reference: "—", client: "RIAD DAR ZITOUNE", periode: "Juillet", montant: 2566, statut: "Brouillon — prorata démarrage 01/07", ton: "neutre", action: "Valider", actionVariant: "outline" },
];

const TON_CLASS: Record<FactureLigne["ton"], string> = {
  info: "bg-sky-50 text-sky-700 border-sky-200",
  ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warn: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-rose-50 text-rose-700 border-rose-200",
  neutre: "bg-muted text-muted-foreground border-border",
};

export default function CycleFacturationPanel() {
  const [search, setSearch] = useState("");
  const [statut, setStatut] = useState("all");
  const today = new Date();

  const etapes: Etape[] = [
    { titre: "15 juin", l1: "Génération auto", l2: "des factures" },
    { titre: "15 → 18", l1: "Envoi WhatsApp", l2: "+ email + planning" },
    { titre: "20 juin", l1: "Échéance", l2: "paiement virement" },
    { titre: "J+5 / J+10", l1: "Rappel puis mise", l2: "en demeure auto" },
    { titre: "J+15", l1: "Suspension", l2: "de la prestation" },
  ];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return LIGNES.filter((l) => {
      const okQ = !q || l.client.toLowerCase().includes(q) || l.reference.toLowerCase().includes(q);
      const okS = statut === "all" || l.ton === statut;
      return okQ && okS;
    });
  }, [search, statut]);

  return (
    <div className="space-y-4">
      {/* Frise du cycle */}
      <Card className="p-5">
        <div className="flex items-baseline gap-2 mb-6">
          <h3 className="font-bold text-sm">Cycle de facturation — {format(today, "MMMM yyyy", { locale: fr })}</h3>
          <span className="text-xs text-muted-foreground">pour les prestations du mois suivant</span>
        </div>

        <div className="relative">
          <div className="absolute left-0 right-0 top-0 h-[3px] rounded-full bg-muted" />
          <div className="absolute left-0 top-0 h-[3px] w-[52%] rounded-full bg-primary" />
          <div className="absolute top-[-22px] left-[52%] -translate-x-1/2">
            <span className="rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-[11px] font-semibold px-2 py-0.5 whitespace-nowrap">
              Aujourd'hui - {format(today, "d")}
            </span>
          </div>
          <div className="absolute top-[-4px] left-[52%] -translate-x-1/2 h-[11px] w-[11px] rounded-full bg-amber-400 border-2 border-background" />

          <div className="grid grid-cols-5 pt-5 text-center">
            {etapes.map((e) => (
              <div key={e.titre} className="px-1">
                <p className="text-xs font-bold">{e.titre}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">{e.l1}</p>
                {e.l2 && <p className="text-[11px] text-muted-foreground leading-tight">{e.l2}</p>}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Voyants */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Factures générées</p>
          <p className="text-3xl font-bold mt-1">47</p>
          <p className="text-[11px] text-muted-foreground mt-1">62 180 DH TTC au total</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Payées</p>
          <p className="text-3xl font-bold mt-1 text-emerald-600">38</p>
          <p className="text-[11px] text-muted-foreground mt-1">52 480 DH encaissés</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">En attente (éch. 20/06)</p>
          <p className="text-3xl font-bold mt-1 text-amber-600">6</p>
          <p className="text-[11px] text-muted-foreground mt-1">4 850 DH</p>
        </Card>
        <Card className="p-4 border-rose-200 bg-rose-50/40">
          <p className="text-[11px] uppercase tracking-wide text-rose-700 font-semibold">En retard</p>
          <p className="text-3xl font-bold mt-1 text-rose-600">3</p>
          <p className="text-[11px] text-muted-foreground mt-1">1 relance · 1 mise en demeure · 1 suspension</p>
        </Card>
      </div>

      {/* Barre de recherche */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une facture…" className="pl-8" />
        </div>
        <Select value={statut} onValueChange={setStatut}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Statut : Tous" /></SelectTrigger>
          <SelectContent className="bg-popover z-50">
            <SelectItem value="all">Statut : Tous</SelectItem>
            <SelectItem value="ok">Payées</SelectItem>
            <SelectItem value="info">Envoyées</SelectItem>
            <SelectItem value="warn">En retard</SelectItem>
            <SelectItem value="danger">Suspendues</SelectItem>
            <SelectItem value="neutre">Brouillons</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />Export Excel</Button>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-[11px] uppercase">Facture</TableHead>
              <TableHead className="text-[11px] uppercase">Client</TableHead>
              <TableHead className="text-[11px] uppercase">Période</TableHead>
              <TableHead className="text-[11px] uppercase">Montant TTC</TableHead>
              <TableHead className="text-[11px] uppercase">Statut</TableHead>
              <TableHead className="text-[11px] uppercase">Fichier facture</TableHead>
              <TableHead className="text-[11px] uppercase text-right">Action</TableHead>

            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((l, i) => (
              <TableRow key={`${l.reference}-${i}`}>
                <TableCell className="text-sm">{l.reference}</TableCell>
                <TableCell className="text-sm font-semibold">{l.client}</TableCell>
                <TableCell className="text-sm">{l.periode}</TableCell>
                <TableCell className="text-sm font-bold">{l.montant.toLocaleString("fr-FR")} DH</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-[11px] font-medium ${TON_CLASS[l.ton]}`}>{l.statut}</Badge>
                </TableCell>
                <TableCell>
                  {fichiers[l.reference + i] ? (
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-emerald-600" />
                      <span className="text-xs">{fichiers[l.reference + i]}</span>
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => genererFacture(l, i)}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="h-7" onClick={() => genererFacture(l, i)}>
                      <FileText className="h-3.5 w-3.5 mr-1" />Générer
                    </Button>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant={l.actionVariant ?? "outline"}>{l.action}</Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Aucune facture</TableCell></TableRow>
            )}

          </TableBody>
        </Table>
      </Card>

      {/* Automatismes */}
      <Card className="p-4 bg-sidebar text-sidebar-foreground border-sidebar-border">
        <p className="text-xs font-bold flex items-center gap-1.5 mb-2"><Settings2 className="h-3.5 w-3.5" />Automatismes de cette vue</p>
        <ul className="space-y-1 text-[11px] leading-relaxed opacity-90">
          <li>· Génération des factures le <code className="px-1 rounded bg-white/10">15</code> à 08h00 — calcul auto du nombre de passages du mois suivant (4 ou 5 par jour choisi)</li>
          <li>· Envoi groupé WhatsApp + email avec PDF facture + calendrier des passages entre le <code className="px-1 rounded bg-white/10">15</code> et le <code className="px-1 rounded bg-white/10">18</code></li>
          <li>· Relances automatiques : <code className="px-1 rounded bg-white/10">J+5</code> rappel WhatsApp → <code className="px-1 rounded bg-white/10">J+10</code> mise en demeure email → <code className="px-1 rounded bg-white/10">J+15</code> suspension + notification CC</li>
          <li>· L'auxiliaire de vie suit un cycle <strong>hebdomadaire</strong> (échéance mercredi) — même moteur, périodicité différente</li>
          <li>· Prorata automatique pour tout abonnement démarrant en cours de mois</li>
        </ul>
      </Card>
    </div>
  );
}
