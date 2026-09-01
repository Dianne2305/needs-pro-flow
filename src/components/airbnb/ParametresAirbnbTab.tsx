/**
 * ParametresAirbnbTab.tsx
 * Écran 08 — Paramètres du module : grille tarifaire par typologie, tarifs du linge,
 * composition d'un set, options et règles commerciales.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ARTICLES_HORS_SET, MINIMUM_LINGE, OPTIONS_AUTRES, OPTIONS_REASSORT, SET_COMPOSITION,
  SEUIL_CONCIERGERIE, SUPPLEMENT_ZONE, TARIF_PIECE_SUPP, TARIF_SET, TARIF_STANDARD,
  TYPOLOGIES_BIEN, formatDH,
} from "@/lib/airbnb-constants";

export function ParametresAirbnbTab() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Grille tarifaire conciergerie</CardTitle>
          <p className="text-xs text-muted-foreground">Applicable dès {SEUIL_CONCIERGERIE} biens confiés par le même client.</p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Typologie</TableHead><TableHead className="text-right">Tarif par turnover</TableHead></TableRow></TableHeader>
            <TableBody>
              {TYPOLOGIES_BIEN.map((t) => (
                <TableRow key={t.value}><TableCell>{t.label}</TableCell><TableCell className="text-right font-semibold">{formatDH(t.tarif)}</TableCell></TableRow>
              ))}
              <TableRow><TableCell>Tarif standard (moins de {SEUIL_CONCIERGERIE} biens)</TableCell><TableCell className="text-right font-semibold">{formatDH(TARIF_STANDARD)} / 4h</TableCell></TableRow>
              <TableRow><TableCell>Supplément zone éloignée</TableCell><TableCell className="text-right font-semibold">+{formatDH(SUPPLEMENT_ZONE)}</TableCell></TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Composition d'un set de linge</CardTitle>
          <p className="text-xs text-muted-foreground">Le nombre de sets est le plus petit ratio disponible parmi ces articles.</p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Article</TableHead><TableHead className="text-right">Pièces par set</TableHead></TableRow></TableHeader>
            <TableBody>
              {SET_COMPOSITION.map((a) => (
                <TableRow key={a.key}><TableCell>{a.label}</TableCell><TableCell className="text-right font-semibold">{a.parSet}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Tarifs du linge</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Set complet" value={formatDH(TARIF_SET)} />
          <Row label="Pièce supplémentaire hors set" value={formatDH(TARIF_PIECE_SUPP)} />
          <Row label="Minimum de facturation linge" value={formatDH(MINIMUM_LINGE)} />
          <div className="pt-2 text-xs text-muted-foreground">
            Articles toujours facturés à la pièce : {ARTICLES_HORS_SET.map((a) => a.label).join(", ")}.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Options facturables</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {[...OPTIONS_REASSORT, ...OPTIONS_AUTRES].map((o) => (
            <div key={o.value} className="flex items-start justify-between gap-3 border-b border-dashed pb-1">
              <div>
                <div className="font-medium">{o.label}</div>
                <div className="text-xs text-muted-foreground">{o.detail}</div>
              </div>
              <Badge variant="outline">{o.prix} DH</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="pb-2"><CardTitle className="text-base">Règles commerciales du module</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
          <p>· Une ligne du répertoire = un appartement. Le code bien est généré à partir du trigramme du client et d'un numéro d'ordre (ex. GBE001).</p>
          <p>· Le service linge n'est proposé qu'à Casablanca.</p>
          <p>· Les quantités de linge ne sont jamais saisies à la commande : elles sont comptées sur place par le runner.</p>
          <p>· Le montant du linge n'est figé que par la responsable linge, après recomptage à la laverie.</p>
          <p>· Le linge est facturé sur la commande de ramassage, pas sur celle de dépôt.</p>
          <p>· Les photos de fin d'intervention, l'intervention à J+1 et la garantie 24h sont incluses sans supplément.</p>
          <p>· Le passage sous {SEUIL_CONCIERGERIE} biens confiés autorise un reclassement au tarif standard avec préavis écrit de 15 jours.</p>
          <p>· Une facture échue suspend le compte : plus aucune commande n'est acceptée avant règlement.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between border-b border-dashed py-1"><span className="text-muted-foreground">{label}</span><span className="font-semibold">{value}</span></div>;
}
