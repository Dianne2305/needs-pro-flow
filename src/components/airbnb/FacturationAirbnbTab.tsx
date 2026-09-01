/**
 * FacturationAirbnbTab.tsx
 * Écran 06 — Facturation : cycles par passage, quinzaine probatoire et mensuel groupé (26 → 25),
 * génération des factures depuis les commandes facturables et suivi des échéances.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Receipt } from "lucide-react";
import { toast } from "sonner";
import { MODES_PAIEMENT_AIRBNB, formatDH } from "@/lib/airbnb-constants";

const STATUTS_FACTURE: Record<string, { label: string; color: string }> = {
  brouillon: { label: "Brouillon", color: "bg-muted text-muted-foreground" },
  emise: { label: "Émise", color: "bg-blue-100 text-blue-800" },
  en_attente: { label: "En attente de règlement", color: "bg-amber-100 text-amber-800" },
  payee: { label: "Payée", color: "bg-green-100 text-green-800" },
  echue: { label: "Échue — compte suspendu", color: "bg-red-100 text-red-800" },
};

export function FacturationAirbnbTab() {
  const qc = useQueryClient();
  const [fStatut, setFStatut] = useState("all");

  const { data: factures = [] } = useQuery({
    queryKey: ["airbnb_factures"],
    queryFn: async () => (await supabase.from("airbnb_factures").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: commandes = [] } = useQuery({
    queryKey: ["airbnb_commandes"],
    queryFn: async () => (await supabase.from("airbnb_commandes").select("*")).data ?? [],
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["airbnb_clients"],
    queryFn: async () => (await supabase.from("airbnb_clients").select("*")).data ?? [],
  });

  const totalCommande = (c: (typeof commandes)[number]) =>
    Number(c.montant_menage) + Number(c.montant_zone) + Number(c.montant_options) + Number(c.montant_linge) + Number(c.montant_linge_abime);

  const aFacturer = commandes.filter((c) => c.statut === "facturable");

  const parClient = useMemo(() => {
    const m = new Map<string, { client: (typeof clients)[number] | undefined; lignes: typeof commandes; total: number }>();
    aFacturer.forEach((c) => {
      const key = c.client_id ?? "—";
      const e = m.get(key) ?? { client: clients.find((x) => x.id === c.client_id), lignes: [], total: 0 };
      e.lignes = [...e.lignes, c];
      e.total += totalCommande(c);
      m.set(key, e);
    });
    return [...m.entries()];
  }, [aFacturer, clients]);

  const lignesFactures = factures.filter((f) => fStatut === "all" || f.statut === fStatut);

  const kpis = [
    { label: "À facturer", value: formatDH(aFacturer.reduce((s, c) => s + totalCommande(c), 0)), hint: `${aFacturer.length} commandes` },
    { label: "Émises", value: formatDH(factures.filter((f) => f.statut === "emise" || f.statut === "en_attente").reduce((s, f) => s + Number(f.montant), 0)) },
    { label: "Encaissé", value: formatDH(factures.filter((f) => f.statut === "payee").reduce((s, f) => s + Number(f.montant), 0)) },
    { label: "Échu", value: formatDH(factures.filter((f) => f.statut === "echue").reduce((s, f) => s + Number(f.montant), 0)) },
  ];

  const generer = useMutation({
    mutationFn: async ({ clientId, total }: { clientId: string; total: number }) => {
      const client = clients.find((c) => c.id === clientId);
      const now = new Date();
      const debut = new Date(now.getFullYear(), now.getMonth() - 1, 26).toISOString().slice(0, 10);
      const fin = new Date(now.getFullYear(), now.getMonth(), 25).toISOString().slice(0, 10);
      const echeance = new Date(now.getFullYear(), now.getMonth(), 30).toISOString().slice(0, 10);
      const numero = `FAC-AB-${now.getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      const { error } = await supabase.from("airbnb_factures").insert({
        numero, client_id: clientId, client_nom: client?.nom ?? null,
        mode: client?.mode_paiement ?? "mensuel", montant: total,
        periode_debut: debut, periode_fin: fin,
        date_emission: now.toISOString().slice(0, 10), date_echeance: echeance,
        statut: "emise",
      });
      if (error) throw error;
      const ids = aFacturer.filter((c) => c.client_id === clientId).map((c) => c.id);
      if (ids.length) await supabase.from("airbnb_commandes").update({ statut: "facturee" }).in("id", ids);
    },
    onSuccess: () => {
      toast.success("Facture générée");
      qc.invalidateQueries({ queryKey: ["airbnb_factures"] });
      qc.invalidateQueries({ queryKey: ["airbnb_commandes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const marquerPayee = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("airbnb_factures").update({ statut: "payee", date_paiement: new Date().toISOString().slice(0, 10) }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Règlement enregistré"); qc.invalidateQueries({ queryKey: ["airbnb_factures"] }); },
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}><CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</div>
            <div className="text-2xl font-bold">{k.value}</div>
            {k.hint && <div className="text-xs text-muted-foreground">{k.hint}</div>}
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><Receipt className="h-4 w-4" />Commandes facturables — regroupées par client</CardTitle>
          <p className="text-xs text-muted-foreground">Cycle mensuel groupé : du 26 du mois précédent au 25 du mois en cours. Une commande n'apparaît ici qu'après figeage du comptage linge.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {parClient.length === 0 && <p className="text-sm text-muted-foreground">Aucune commande en attente de facturation.</p>}
          {parClient.map(([id, e]) => (
            <div key={id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">{e.client?.nom ?? "Client inconnu"}</div>
                  <div className="text-xs text-muted-foreground">
                    {e.lignes.length} commande(s) · {MODES_PAIEMENT_AIRBNB.find((m) => m.value === e.client?.mode_paiement)?.label}
                    {e.client?.probatoire ? " · probatoire" : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-lg font-bold">{formatDH(e.total)}</div>
                  <Button size="sm" onClick={() => generer.mutate({ clientId: id, total: e.total })}>
                    <FileText className="mr-1 h-4 w-4" />Générer la facture
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Select value={fStatut} onValueChange={setFStatut}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(STATUTS_FACTURE).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Factures émises</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° facture</TableHead><TableHead>Client</TableHead><TableHead>Période</TableHead>
                <TableHead>Mode</TableHead><TableHead>Échéance</TableHead><TableHead>Montant</TableHead>
                <TableHead>Statut</TableHead><TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lignesFactures.length === 0 && <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Aucune facture.</TableCell></TableRow>}
              {lignesFactures.map((f) => {
                const st = STATUTS_FACTURE[f.statut] ?? STATUTS_FACTURE.brouillon;
                return (
                  <TableRow key={f.id}>
                    <TableCell className="font-mono text-xs">{f.numero}</TableCell>
                    <TableCell>{f.client_nom}</TableCell>
                    <TableCell className="text-xs">{f.periode_debut} → {f.periode_fin}</TableCell>
                    <TableCell className="text-xs">{MODES_PAIEMENT_AIRBNB.find((m) => m.value === f.mode)?.label ?? f.mode}</TableCell>
                    <TableCell className="text-xs">{f.date_echeance}</TableCell>
                    <TableCell className="font-semibold">{formatDH(Number(f.montant))}</TableCell>
                    <TableCell><Badge className={st.color}>{st.label}</Badge></TableCell>
                    <TableCell className="text-right">
                      {f.statut !== "payee" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => marquerPayee.mutate(f.id)}>Confirmer paiement</Button>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Règles de facturation appliquées</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-xs text-muted-foreground">
          <p>· Après chaque passage : règlement immédiat, mode par défaut pour tout nouveau client.</p>
          <p>· Quinzaine : période probatoire accordée avant passage au mensuel.</p>
          <p>· Mensuel groupé : cycle du 26 au 25, facture émise en fin de cycle avec échéance à J+5.</p>
          <p>· Une facture échue suspend automatiquement le compte : aucune nouvelle commande n'est acceptée tant qu'elle n'est pas réglée.</p>
        </CardContent>
      </Card>
    </div>
  );
}
