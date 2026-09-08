/**
 * CompteClientAirbnb.tsx
 * Compte d'un client Airbnb / Conciergerie : informations éditables, indicateurs
 * et liste complète des biens confiés.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Building2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  MODES_PAIEMENT_AIRBNB, SERVICES_BIEN, SEUIL_CONCIERGERIE, SUPPLEMENT_ZONE,
  TYPES_CLIENT_AIRBNB, calculerTrigramme, formatDH, labelTypologie,
} from "@/lib/airbnb-constants";

export default function CompteClientAirbnb() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);

  const { data: client, isLoading } = useQuery({
    queryKey: ["airbnb_client", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("airbnb_clients").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: biens = [] } = useQuery({
    queryKey: ["airbnb_biens_client", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("airbnb_biens").select("*").eq("client_id", id!).order("code");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: commandes = [] } = useQuery({
    queryKey: ["airbnb_commandes_client", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("airbnb_commandes").select("*").eq("client_id", id!).order("date_intervention", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const [form, setForm] = useState({
    nom: "", type_client: "conciergerie", telephone: "", email: "", ville: "Casablanca",
    mode_paiement: "passage", commercial: "", contrat_signe: false, probatoire: false, notes: "",
  });

  useEffect(() => {
    if (!client) return;
    setForm({
      nom: client.nom ?? "",
      type_client: client.type_client ?? "conciergerie",
      telephone: client.telephone ?? "",
      email: client.email ?? "",
      ville: client.ville ?? "Casablanca",
      mode_paiement: client.mode_paiement ?? "passage",
      commercial: client.commercial ?? "",
      contrat_signe: !!client.contrat_signe,
      probatoire: !!client.probatoire,
      notes: client.notes ?? "",
    });
  }, [client]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("airbnb_clients").update({
        ...form,
        trigramme: calculerTrigramme(form.nom),
      }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Informations client enregistrées");
      setEdit(false);
      qc.invalidateQueries({ queryKey: ["airbnb_client", id] });
      qc.invalidateQueries({ queryKey: ["airbnb_clients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Chargement…</div>;
  if (!client) return <div className="p-8 text-muted-foreground">Client introuvable.</div>;

  const totalTournee = biens.reduce((s, b) => s + Number(b.tarif_base), 0);
  const eligible = biens.length >= SEUIL_CONCIERGERIE;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate("/airbnb-conciergerie")}>
          <ArrowLeft className="mr-1 h-4 w-4" />Retour
        </Button>
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">{client.nom}</h1>
          <Badge variant="outline" className="font-mono">{client.trigramme}</Badge>
          <Badge>{TYPES_CLIENT_AIRBNB.find((t) => t.value === client.type_client)?.label}</Badge>
          {eligible
            ? <Badge className="bg-green-100 text-green-800">Éligible conciergerie</Badge>
            : <Badge variant="outline">Sous le seuil</Badge>}
        </div>
        <div className="ml-auto">
          {edit
            ? (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEdit(false)}>Annuler</Button>
                <Button onClick={() => save.mutate()}><Save className="mr-1 h-4 w-4" />Enregistrer</Button>
              </div>
            )
            : <Button onClick={() => setEdit(true)}>Modifier les informations</Button>}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Biens confiés" value={String(biens.length)} />
        <Kpi label="Montant par tournée" value={formatDH(totalTournee)} />
        <Kpi label="Passages enregistrés" value={String(commandes.length)} />
        <Kpi label="Règlement" value={MODES_PAIEMENT_AIRBNB.find((m) => m.value === client.mode_paiement)?.label ?? "—"} />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Informations du client</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div>
            <Label>Nom complet</Label>
            <Input value={form.nom} disabled={!edit} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
            {edit && form.nom && <p className="mt-1 text-xs text-muted-foreground">Trigramme : <b>{calculerTrigramme(form.nom)}</b></p>}
          </div>
          <div>
            <Label>Type de client</Label>
            <Select value={form.type_client} disabled={!edit} onValueChange={(v) => setForm({ ...form, type_client: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES_CLIENT_AIRBNB.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ville principale</Label>
            <Select value={form.ville} disabled={!edit} onValueChange={(v) => setForm({ ...form, ville: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="Casablanca">Casablanca</SelectItem><SelectItem value="Rabat">Rabat</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Téléphone</Label><Input value={form.telephone} disabled={!edit} onChange={(e) => setForm({ ...form, telephone: e.target.value })} /></div>
          <div><Label>Email</Label><Input value={form.email} disabled={!edit} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div>
            <Label>Mode de paiement</Label>
            <Select value={form.mode_paiement} disabled={!edit} onValueChange={(v) => setForm({ ...form, mode_paiement: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MODES_PAIEMENT_AIRBNB.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Commercial référent</Label><Input value={form.commercial} disabled={!edit} onChange={(e) => setForm({ ...form, commercial: e.target.value })} /></div>
          <div className="flex items-center gap-2 pt-6">
            <Switch checked={form.contrat_signe} disabled={!edit} onCheckedChange={(v) => setForm({ ...form, contrat_signe: v })} />
            <Label>Contrat signé</Label>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Switch checked={form.probatoire} disabled={!edit} onCheckedChange={(v) => setForm({ ...form, probatoire: v })} />
            <Label>Période probatoire</Label>
          </div>
          <div className="md:col-span-3">
            <Label>Notes</Label>
            <Textarea value={form.notes} disabled={!edit} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Biens du client</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead><TableHead>Ville / Quartier / Adresse</TableHead>
                <TableHead>Typologie</TableHead><TableHead>Accès</TableHead>
                <TableHead>Services</TableHead><TableHead>Tarif</TableHead><TableHead>iCal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {biens.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Aucun bien confié.</TableCell></TableRow>}
              {biens.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono font-semibold">{b.code}</TableCell>
                  <TableCell>
                    <div>{b.ville} · {b.quartier}</div>
                    <div className="text-xs text-muted-foreground">{b.adresse}</div>
                  </TableCell>
                  <TableCell>{labelTypologie(b.typologie)}</TableCell>
                  <TableCell className="text-xs">{b.acces_type}<div className="text-muted-foreground">{b.acces_details}</div></TableCell>
                  <TableCell className="text-xs">{SERVICES_BIEN.find((s) => s.value === b.services)?.label}</TableCell>
                  <TableCell className="whitespace-nowrap font-semibold">
                    {formatDH(Number(b.tarif_base))}
                    {b.zone_eloignee && <Badge variant="outline" className="ml-1">Zone +{SUPPLEMENT_ZONE}</Badge>}
                  </TableCell>
                  <TableCell>
                    {b.ical_url ? <Badge className="bg-green-100 text-green-800">Connecté</Badge> : <Badge variant="outline">Non synchronisé</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Derniers passages</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Bien</TableHead><TableHead>Statut</TableHead><TableHead>Montant</TableHead></TableRow></TableHeader>
            <TableBody>
              {commandes.length === 0 && <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">Aucun passage enregistré.</TableCell></TableRow>}
              {commandes.slice(0, 15).map((c) => {
                const b = biens.find((x) => x.id === c.bien_id);
                const total = Number(c.montant_menage) + Number(c.montant_zone) + Number(c.montant_options) + Number(c.montant_linge) + Number(c.montant_linge_abime);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs">{c.date_intervention} {c.heure_intervention?.slice(0, 5)}</TableCell>
                    <TableCell className="font-mono text-xs">{b?.code ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{c.statut}</Badge></TableCell>
                    <TableCell className="font-semibold">{formatDH(total)}</TableCell>
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

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </CardContent></Card>
  );
}
