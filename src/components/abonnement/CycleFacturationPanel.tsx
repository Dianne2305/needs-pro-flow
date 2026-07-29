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
import { Search, Download, Settings2, FileText } from "lucide-react";
import jsPDF from "jspdf";
import { toast } from "sonner";

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
  paiementConfirme?: boolean;
};

type StatutFacturationFilter = "all" | "Facture générée" | "En attente" | "Payé" | "Non payé";

const LIGNES: FactureLigne[] = [
  { reference: "AM/F118/2026", client: "Sofia BENNANI", periode: "Juillet", montant: 1944, statut: "Envoyée — éch. 20/06", ton: "info", action: "Relancer", actionVariant: "outline" },
  { reference: "AM/F121/2026", client: "SMILE+ (bureaux)", periode: "Juillet", montant: 2851, statut: "Payée le 17/06", ton: "ok", action: "Reçu", actionVariant: "outline", paiementConfirme: true },
  { reference: "AM/F103/2026", client: "Rachid EL AMRANI", periode: "Juin", montant: 1512, statut: "Retard J+11 — mise en demeure", ton: "warn", action: "Voir dossier", actionVariant: "default" },
  { reference: "AM/F097/2026", client: "Youssef KABBAJ", periode: "Juin", montant: 1296, statut: "Suspendu J+16", ton: "danger", action: "Voir dossier", actionVariant: "default" },
  { reference: "AM/F124/2026", client: "Famille TAZI (aux. vie)", periode: "Sem. 25", montant: 775, statut: "Hebdo — éch. mer 17/06", ton: "info", action: "Relancer", actionVariant: "outline", paiementConfirme: true },
  { reference: "—", client: "RIAD DAR ZITOUNE", periode: "Juillet", montant: 2566, statut: "Brouillon — prorata démarrage 01/07", ton: "neutre", action: "Valider", actionVariant: "outline" },
];

/**
 * Statut de facturation calculé automatiquement :
 * - avant le 15 : Non généré
 * - le 15 : Facture générée
 * - du 16 au 26 : Payé si confirmé, sinon En attente de règlement (intermédiaire)
 * - à partir du 27 : statut final Payé ou Non payé
 */
type StatutFacturation = {
  label: string;
  ton: FactureLigne["ton"];
  final: boolean;
  impactMoisSuivant: "Actif" | "Suspendu" | null;
};

export function computeStatutFacturation(jour: number, paiementConfirme: boolean): StatutFacturation {
  if (paiementConfirme && jour >= 15) {
    return { label: "Payé", ton: "ok", final: true, impactMoisSuivant: "Actif" };
  }
  if (jour < 15) {
    return { label: "Non généré", ton: "neutre", final: false, impactMoisSuivant: null };
  }
  if (jour === 15) {
    return { label: "Facture générée", ton: "info", final: false, impactMoisSuivant: null };
  }
  if (jour <= 26) {
    return { label: "En attente de règlement", ton: "warn", final: false, impactMoisSuivant: null };
  }
  return { label: "Non payé", ton: "danger", final: true, impactMoisSuivant: "Suspendu" };
}

const TON_CLASS: Record<FactureLigne["ton"], string> = {
  info: "bg-sky-50 text-sky-700 border-sky-200",
  ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warn: "bg-amber-50 text-amber-700 border-amber-200",
  danger: "bg-rose-50 text-rose-700 border-rose-200",
  neutre: "bg-muted text-muted-foreground border-border",
};


export default function CycleFacturationPanel({ statutFilter }: { statutFilter?: StatutFacturationFilter }) {
  const [search, setSearch] = useState("");
  const [internalStatut, setInternalStatut] = useState("all");
  const statut = statutFilter ?? internalStatut;
  const [fichiers, setFichiers] = useState<Record<string, string>>({});
  const today = new Date();
  const [simuJour, setSimuJour] = useState("auto");
  const jour = simuJour === "auto" ? today.getDate() : Number(simuJour);

  const [paiements, setPaiements] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(LIGNES.map((l, i) => [l.reference + i, !!l.paiementConfirme])),
  );


  const genererFacture = (l: FactureLigne, i: number) => {
    const ref = l.reference === "—" ? `BROUILLON-${i + 1}` : l.reference;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("FACTURE ABONNEMENT", 14, 20);
    doc.setFontSize(11);
    doc.text(`Référence : ${ref}`, 14, 35);
    doc.text(`Client : ${l.client}`, 14, 43);
    doc.text(`Période : ${l.periode}`, 14, 51);
    doc.text(`Statut : ${l.statut}`, 14, 59);
    doc.setFontSize(13);
    doc.text(`Montant TTC : ${l.montant.toLocaleString("fr-FR")} DH`, 14, 72);
    doc.setFontSize(9);
    doc.text(`Généré le ${format(new Date(), "dd/MM/yyyy à HH:mm", { locale: fr })}`, 14, 285);
    const nom = `${ref.replace(/\//g, "-")}.pdf`;
    doc.save(nom);
    setFichiers((p) => ({ ...p, [l.reference + i]: nom }));
    toast.success(`Facture générée : ${nom}`);
  };


  const etapes: Etape[] = [
    { titre: "15 du mois — 08h00", l1: "Génération auto", l2: "des factures" },
    { titre: "15 du mois", l1: "Envoi automatique", l2: "WhatsApp + email" },
    { titre: "18 du mois", l1: "1er rappel", l2: "WhatsApp" },
    { titre: "23 du mois", l1: "2ème rappel", l2: "WhatsApp" },
    { titre: "27 du mois", l1: "Suspension auto", l2: "+ notification CC" },
  ];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return LIGNES.map((l, i) => {
      const key = l.reference + i;
      return { l, i, key, sf: computeStatutFacturation(jour, !!paiements[key]) };
    }).filter(({ l, sf }) => {
      const okQ = !q || l.client.toLowerCase().includes(q) || l.reference.toLowerCase().includes(q);
      const okS = statut === "all" || sf.label === statut;
      return okQ && okS;
    });
  }, [search, statut, paiements, jour]);


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
          <div className="absolute left-0 top-0 h-[3px] rounded-full bg-primary" style={{ width: `${Math.min(100, (today.getDate() / 31) * 100)}%` }} />
          <div className="absolute top-[-22px] -translate-x-1/2" style={{ left: `${Math.min(100, (today.getDate() / 31) * 100)}%` }}>
            <span className="rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-[11px] font-semibold px-2 py-0.5 whitespace-nowrap">
              Aujourd'hui - {format(today, "d")}
            </span>
          </div>
          <div className="absolute top-[-4px] -translate-x-1/2 h-[11px] w-[11px] rounded-full bg-amber-400 border-2 border-background" style={{ left: `${Math.min(100, (today.getDate() / 31) * 100)}%` }} />

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
          <SelectTrigger className="w-[210px]"><SelectValue placeholder="Statut : Tous" /></SelectTrigger>
          <SelectContent className="bg-popover z-50">
            <SelectItem value="all">Statut : Tous</SelectItem>
            <SelectItem value="Non généré">Non généré</SelectItem>
            <SelectItem value="Facture générée">Facture générée</SelectItem>
            <SelectItem value="En attente de règlement">En attente de règlement</SelectItem>
            <SelectItem value="Payé">Payé</SelectItem>
            <SelectItem value="Non payé">Non payé</SelectItem>
          </SelectContent>
        </Select>

        <Select value={simuJour} onValueChange={setSimuJour}>
          <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-popover z-50">
            <SelectItem value="auto">Aperçu : jour réel ({today.getDate()})</SelectItem>
            <SelectItem value="10">Le 10 — Non généré</SelectItem>
            <SelectItem value="15">Le 15 — Facture générée</SelectItem>
            <SelectItem value="20">Le 20 — En attente de règlement</SelectItem>
            <SelectItem value="27">Le 27 — Payé / Non payé</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />Export Excel</Button>
      </div>

      {simuJour !== "auto" && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Mode aperçu UX : les statuts sont simulés au jour {jour} du cycle. Le système appliquera automatiquement la même logique à la date réelle.
        </p>
      )}


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
            {rows.map(({ l, i, key, sf }) => (
              <TableRow key={key}>
                <TableCell className="text-sm">{l.reference}</TableCell>
                <TableCell className="text-sm font-semibold">{l.client}</TableCell>
                <TableCell className="text-sm">{l.periode}</TableCell>
                <TableCell className="text-sm font-bold">{l.montant.toLocaleString("fr-FR")} DH</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1 items-start">
                    <Badge variant="outline" className={`text-[11px] font-medium ${TON_CLASS[sf.ton]}`}>{sf.label}</Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {sf.final
                        ? `Statut final · mois suivant : ${sf.impactMoisSuivant}`
                        : "Statut intermédiaire · sans impact mois suivant"}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {fichiers[key] ? (
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-emerald-600" />
                      <span className="text-xs">{fichiers[key]}</span>
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
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant={paiements[key] ? "outline" : "default"}
                      onClick={() => {
                        setPaiements((p) => ({ ...p, [key]: !p[key] }));
                        toast.success(paiements[key] ? "Paiement annulé" : "Paiement confirmé — statut : Payé");
                      }}
                    >
                      {paiements[key] ? "Annuler paiement" : "Confirmer paiement"}
                    </Button>
                    <Button size="sm" variant={l.actionVariant ?? "outline"}>{l.action}</Button>
                  </div>
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
          <li>· <code className="px-1 rounded bg-white/10">15 du mois — 08h00</code> : génération automatique des factures (calcul des passages 4 ou 5, PDF, calendrier des interventions)</li>
          <li>· <code className="px-1 rounded bg-white/10">15 du mois</code> : envoi automatique WhatsApp, e-mail, facture PDF et calendrier des passages</li>
          <li>· <code className="px-1 rounded bg-white/10">18 du mois</code> : 1er rappel WhatsApp</li>
          <li>· <code className="px-1 rounded bg-white/10">23 du mois</code> : 2ème rappel WhatsApp</li>
          <li>· <code className="px-1 rounded bg-white/10">27 du mois</code> : suspension automatique de la prestation + notification automatique au Chargé de Clientèle</li>
          <li>· Prorata automatique pour tout abonnement démarrant en cours de mois</li>
        </ul>
      </Card>
    </div>
  );
}
