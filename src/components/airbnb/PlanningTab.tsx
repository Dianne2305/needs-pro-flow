/**
 * PlanningTab.tsx
 * Écran 05 — Planning & exécution : vue jour des turnovers, affectation des intervenantes,
 * suivi des photos et remontée des commandes vers le tableau de bord.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Camera, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { STATUTS_COMMANDE, formatDH, labelTypologie } from "@/lib/airbnb-constants";

export function PlanningTab() {
  const qc = useQueryClient();
  const [jour, setJour] = useState(() => new Date().toISOString().slice(0, 10));
  const [fStatut, setFStatut] = useState("all");

  const { data: commandes = [] } = useQuery({
    queryKey: ["airbnb_commandes"],
    queryFn: async () => (await supabase.from("airbnb_commandes").select("*").order("heure_intervention")).data ?? [],
  });
  const { data: biens = [] } = useQuery({
    queryKey: ["airbnb_biens"],
    queryFn: async () => (await supabase.from("airbnb_biens").select("*")).data ?? [],
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["airbnb_clients"],
    queryFn: async () => (await supabase.from("airbnb_clients").select("*")).data ?? [],
  });
  const { data: profils = [] } = useQuery({
    queryKey: ["profils_airbnb"],
    queryFn: async () => (await supabase.from("profils").select("id, nom, prenom").limit(200)).data ?? [],
  });

  const duJour = useMemo(
    () => commandes.filter((c) => c.date_intervention === jour && (fStatut === "all" || c.statut === fStatut)),
    [commandes, jour, fStatut],
  );

  const kpis = [
    { label: "Turnovers du jour", value: duJour.length },
    { label: "Non affectés", value: duJour.filter((c) => !c.intervenante).length },
    { label: "Photos en attente", value: duJour.filter((c) => !c.photos_recues).length },
    { label: "CA prévisionnel", value: formatDH(duJour.reduce((s, c) => s + Number(c.montant_menage) + Number(c.montant_options) + Number(c.montant_zone) + Number(c.montant_linge), 0)) },
  ];

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("airbnb_commandes").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Commande mise à jour"); qc.invalidateQueries({ queryKey: ["airbnb_commandes"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}><CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</div>
            <div className="text-2xl font-bold">{k.value}</div>
          </CardContent></Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input type="date" className="w-44" value={jour} onChange={(e) => setJour(e.target.value)} />
        <Select value={fStatut} onValueChange={setFStatut}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(STATUTS_COMMANDE).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4" />Turnovers du {jour}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Heure</TableHead><TableHead>Bien</TableHead><TableHead>Client</TableHead>
                <TableHead>Intervenante</TableHead><TableHead>Linge</TableHead><TableHead>Photos</TableHead>
                <TableHead>Statut</TableHead><TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {duJour.length === 0 && <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Aucun turnover ce jour.</TableCell></TableRow>}
              {duJour.map((c) => {
                const b = biens.find((x) => x.id === c.bien_id);
                const cl = clients.find((x) => x.id === c.client_id);
                const st = STATUTS_COMMANDE[c.statut as keyof typeof STATUTS_COMMANDE];
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-semibold">{c.heure_intervention?.slice(0, 5) ?? "—"}</TableCell>
                    <TableCell>
                      <div className="font-mono text-xs">{b?.code}</div>
                      <div className="text-xs text-muted-foreground">{b ? labelTypologie(b.typologie) : ""} · {b?.quartier}</div>
                    </TableCell>
                    <TableCell className="text-sm">{cl?.nom}</TableCell>
                    <TableCell>
                      <Select value={c.intervenante ?? ""} onValueChange={(v) => update.mutate({ id: c.id, patch: { intervenante: v, statut: "remontee_tdb" } })}>
                        <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Affecter" /></SelectTrigger>
                        <SelectContent>
                          {profils.map((p) => <SelectItem key={p.id} value={`${p.prenom} ${p.nom}`}>{p.prenom} {p.nom}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{c.comptage_valide ? <Badge className="bg-green-100 text-green-800">Figé</Badge> : <Badge variant="outline">{c.nature_linge === "aucun" ? "Sans linge" : "À compter"}</Badge>}</TableCell>
                    <TableCell>
                      <Button size="sm" variant={c.photos_recues ? "secondary" : "outline"} className="h-7 text-xs"
                        onClick={() => update.mutate({ id: c.id, patch: { photos_recues: !c.photos_recues } })}>
                        <Camera className="mr-1 h-3 w-3" />{c.photos_recues ? "Reçues" : "En attente"}
                      </Button>
                    </TableCell>
                    <TableCell><Badge className={st?.color}>{st?.label ?? c.statut}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => update.mutate({ id: c.id, patch: { statut: "terminee" } })}>
                        <CheckCircle2 className="mr-1 h-3 w-3" />Terminer
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
