/**
 * EspaceConciergerieTab.tsx
 * Écran 07 — Espace conciergerie : vue client (portefeuille de biens, prochains passages,
 * synchronisation iCal et consommation du mois).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarClock, Link2 } from "lucide-react";
import { MODES_PAIEMENT_AIRBNB, SEUIL_CONCIERGERIE, STATUTS_COMMANDE, formatDH, labelTypologie } from "@/lib/airbnb-constants";

export function EspaceConciergerieTab() {
  const [clientId, setClientId] = useState("");

  const { data: clients = [] } = useQuery({
    queryKey: ["airbnb_clients"],
    queryFn: async () => (await supabase.from("airbnb_clients").select("*").order("nom")).data ?? [],
  });
  const { data: biens = [] } = useQuery({
    queryKey: ["airbnb_biens"],
    queryFn: async () => (await supabase.from("airbnb_biens").select("*")).data ?? [],
  });
  const { data: commandes = [] } = useQuery({
    queryKey: ["airbnb_commandes"],
    queryFn: async () => (await supabase.from("airbnb_commandes").select("*").order("date_intervention")).data ?? [],
  });

  const client = clients.find((c) => c.id === clientId) ?? clients[0];
  const mesBiens = biens.filter((b) => b.client_id === client?.id);
  const mesCommandes = useMemo(
    () => commandes.filter((c) => c.client_id === client?.id),
    [commandes, client],
  );
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const aVenir = mesCommandes.filter((c) => c.date_intervention >= aujourdhui);
  const moisCourant = mesCommandes.filter((c) => c.date_intervention.slice(0, 7) === aujourdhui.slice(0, 7));
  const totalMois = moisCourant.reduce(
    (s, c) => s + Number(c.montant_menage) + Number(c.montant_zone) + Number(c.montant_options) + Number(c.montant_linge) + Number(c.montant_linge_abime), 0);

  if (!client) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">Aucun client enregistré.</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={client.id} onValueChange={setClientId}>
          <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
          <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}</SelectContent>
        </Select>
        {mesBiens.length >= SEUIL_CONCIERGERIE
          ? <Badge className="bg-green-100 text-green-800">Compte conciergerie</Badge>
          : <Badge variant="outline">Sous le seuil des {SEUIL_CONCIERGERIE} biens</Badge>}
        <Badge variant="outline">{MODES_PAIEMENT_AIRBNB.find((m) => m.value === client.mode_paiement)?.label}</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Biens confiés" value={String(mesBiens.length)} />
        <Kpi label="Passages ce mois" value={String(moisCourant.length)} />
        <Kpi label="Passages à venir" value={String(aVenir.length)} />
        <Kpi label="Consommation du mois" value={formatDH(totalMois)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-4 w-4" />Mes biens et synchronisation iCal</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {mesBiens.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <div>
                  <div className="font-mono text-xs">{b.code}</div>
                  <div className="text-xs text-muted-foreground">{labelTypologie(b.typologie)} · {b.quartier}</div>
                </div>
                {b.ical_url
                  ? <Badge className="bg-green-100 text-green-800">iCal connecté</Badge>
                  : <Badge variant="outline">Non synchronisé</Badge>}
              </div>
            ))}
            {mesBiens.length === 0 && <p className="text-sm text-muted-foreground">Aucun bien confié.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4" />Prochains passages</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Bien</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
              <TableBody>
                {aVenir.length === 0 && <TableRow><TableCell colSpan={3} className="py-6 text-center text-muted-foreground">Aucun passage programmé.</TableCell></TableRow>}
                {aVenir.slice(0, 10).map((c) => {
                  const b = biens.find((x) => x.id === c.bien_id);
                  const st = STATUTS_COMMANDE[c.statut as keyof typeof STATUTS_COMMANDE];
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs">{c.date_intervention} {c.heure_intervention?.slice(0, 5)}</TableCell>
                      <TableCell className="font-mono text-xs">{b?.code}</TableCell>
                      <TableCell><Badge className={st?.color}>{st?.label ?? c.statut}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </CardContent></Card>
  );
}
