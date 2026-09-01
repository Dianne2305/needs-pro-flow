/**
 * CommandeDossierTab.tsx
 * Écran 03 — Le dossier unifié d'une commande : bloc commercial, bloc terrain, chaîne du linge,
 * détail financier et journal. Vue partagée par le commercial, le runner et la responsable linge.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Circle, MapPin, Phone, Camera } from "lucide-react";
import {
  ETAPES_LINGE, NATURES_LINGE, OPTIONS_AUTRES, OPTIONS_REASSORT, STATUTS_COMMANDE,
  formatDH, labelTypologie,
} from "@/lib/airbnb-constants";

export function CommandeDossierTab() {
  const [selected, setSelected] = useState<string>("");

  const { data: commandes = [] } = useQuery({
    queryKey: ["airbnb_commandes"],
    queryFn: async () => (await supabase.from("airbnb_commandes").select("*").order("date_intervention", { ascending: false })).data ?? [],
  });
  const { data: biens = [] } = useQuery({
    queryKey: ["airbnb_biens"],
    queryFn: async () => (await supabase.from("airbnb_biens").select("*")).data ?? [],
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["airbnb_clients"],
    queryFn: async () => (await supabase.from("airbnb_clients").select("*")).data ?? [],
  });

  const commande = commandes.find((c) => c.id === selected) ?? commandes[0];
  const { data: comptages = [] } = useQuery({
    queryKey: ["airbnb_comptages", commande?.id],
    enabled: !!commande?.id,
    queryFn: async () => (await supabase.from("airbnb_comptages").select("*").eq("commande_id", commande!.id).order("created_at")).data ?? [],
  });

  if (!commande) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">Aucune commande enregistrée. Créez-en une depuis l'onglet « Nouvelle commande ».</CardContent></Card>;
  }

  const bien = biens.find((b) => b.id === commande.bien_id);
  const client = clients.find((c) => c.id === commande.client_id);
  const statut = STATUTS_COMMANDE[commande.statut as keyof typeof STATUTS_COMMANDE];
  const options = Array.isArray(commande.options) ? (commande.options as string[]) : [];
  const total = Number(commande.montant_menage) + Number(commande.montant_zone) + Number(commande.montant_options)
    + Number(commande.montant_linge) + Number(commande.montant_linge_abime);
  const etapeCourante = commande.comptage_valide ? 4 : comptages.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={commande.id} onValueChange={setSelected}>
          <SelectTrigger className="w-80"><SelectValue /></SelectTrigger>
          <SelectContent>
            {commandes.map((c) => {
              const b = biens.find((x) => x.id === c.bien_id);
              return <SelectItem key={c.id} value={c.id}>{c.numero} — {b?.code} — {c.date_intervention}</SelectItem>;
            })}
          </SelectContent>
        </Select>
        <Badge className={statut?.color}>{statut?.label ?? commande.statut}</Badge>
        {commande.comptage_valide && <Badge className="bg-green-100 text-green-800">Comptage validé — montant figé</Badge>}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Bloc commercial — ce qui a été vendu</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-2">
            <Info label="Client" value={client?.nom ?? "—"} />
            <Info label="Bien" value={`${bien?.code ?? "—"} · ${bien ? labelTypologie(bien.typologie) : ""}`} />
            <Info label="Date / heure" value={`${commande.date_intervention} à ${commande.heure_intervention ?? "—"}`} />
            <Info label="Nature du passage linge" value={NATURES_LINGE.find((n) => n.value === commande.nature_linge)?.label ?? "—"} />
            <Info label="Options" value={options.length
              ? options.map((o) => OPTIONS_REASSORT.find((r) => r.value === o)?.label ?? OPTIONS_AUTRES.find((a) => a.value === o)?.label ?? o).join(" · ")
              : "Aucune"} />
            <Info label="Intervenante" value={commande.intervenante ?? "Non affectée"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Bloc terrain</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="flex gap-2"><MapPin className="h-4 w-4 shrink-0" />{bien?.adresse || `${bien?.quartier}, ${bien?.ville}`}</p>
            <p className="text-xs text-muted-foreground">Accès : {bien?.acces_type} — {bien?.acces_details || "aucune précision"}</p>
            <p className="text-xs text-muted-foreground">Sets de rechange sur place : {bien?.sets_rechange ?? 0}</p>
            <p className="flex gap-2 text-xs"><Phone className="h-4 w-4 shrink-0" />{client?.telephone || "—"}</p>
            <p className="flex gap-2 text-xs"><Camera className="h-4 w-4 shrink-0" />Photos de fin : {commande.photos_recues ? "reçues" : "en attente"}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Chaîne du linge — de la collecte au retour</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-5">
            {ETAPES_LINGE.map((e, i) => {
              const done = i < etapeCourante;
              const active = i === etapeCourante;
              return (
                <div key={e.value} className={`rounded-lg border p-3 ${active ? "border-primary bg-primary/5" : done ? "border-green-300 bg-green-50" : ""}`}>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {done ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                    {e.label}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{e.hint}</p>
                </div>
              );
            })}
          </div>
          {comptages.length > 0 && (
            <Table className="mt-4">
              <TableHeader>
                <TableRow><TableHead>Étape</TableHead><TableHead>Pièces</TableHead><TableHead>Sets</TableHead><TableHead>Pièces supp.</TableHead><TableHead>Écart</TableHead><TableHead>Montant</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {comptages.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{ETAPES_LINGE.find((e) => e.value === c.etape)?.label ?? c.etape}</TableCell>
                    <TableCell>{c.total_pieces}</TableCell>
                    <TableCell>{c.sets}</TableCell>
                    <TableCell>{c.pieces_supp}</TableCell>
                    <TableCell className={c.ecart !== 0 ? "font-semibold text-destructive" : ""}>{c.ecart}</TableCell>
                    <TableCell className="font-semibold">{formatDH(Number(c.montant))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Détail financier</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <Ligne label="Ménage" value={Number(commande.montant_menage)} />
          {Number(commande.montant_zone) > 0 && <Ligne label="Supplément zone" value={Number(commande.montant_zone)} />}
          {Number(commande.montant_options) > 0 && <Ligne label="Options" value={Number(commande.montant_options)} />}
          <Ligne label={`Linge${commande.comptage_valide ? " (figé)" : " (provisoire)"}`} value={Number(commande.montant_linge)} />
          {Number(commande.montant_linge_abime) > 0 && <Ligne label="Linge abîmé / manquant" value={Number(commande.montant_linge_abime)} />}
          <div className="flex justify-between border-t pt-2 text-lg font-bold"><span>Total commande</span><span>{formatDH(total)}</span></div>
          {!commande.comptage_valide && commande.nature_linge !== "aucun" && (
            <p className="text-xs text-muted-foreground">Le total n'est pas facturable tant que la responsable linge n'a pas validé le comptage.</p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline">Envoyer la fiche mission</Button>
        <Button disabled={!commande.comptage_valide && commande.nature_linge !== "aucun"}>Basculer en facturation</Button>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div><div className="font-medium">{value}</div></div>;
}
function Ligne({ label, value }: { label: string; value: number }) {
  return <div className="flex justify-between border-b border-dashed py-1"><span className="text-muted-foreground">{label}</span><span className="font-medium">{formatDH(value)}</span></div>;
}
