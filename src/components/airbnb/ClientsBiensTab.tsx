/**
 * ClientsBiensTab.tsx
 * Écran 01 — Répertoire des clients et des biens Airbnb : codification, fiche bien,
 * seuil des 3 biens (tarif conciergerie) et création client / bien.
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, Building2, Home, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  ACCES_BIEN, MODES_PAIEMENT_AIRBNB, SERVICES_BIEN, SEUIL_CONCIERGERIE, SUPPLEMENT_ZONE,
  TYPES_CLIENT_AIRBNB, TYPOLOGIES_BIEN, calculerTrigramme, codeBien, formatDH,
  labelTypologie, tarifApplicable,
} from "@/lib/airbnb-constants";
import { QUARTIERS_CASABLANCA } from "@/lib/constants";

export function ClientsBiensTab() {
  const qc = useQueryClient();
  const [vue, setVue] = useState<"bien" | "client">("bien");
  const [fVille, setFVille] = useState("all");
  const [fType, setFType] = useState("all");
  const [fService, setFService] = useState("all");
  const [openClient, setOpenClient] = useState(false);
  const [openBien, setOpenBien] = useState(false);

  const { data: clients = [] } = useQuery({
    queryKey: ["airbnb_clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("airbnb_clients").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: biens = [] } = useQuery({
    queryKey: ["airbnb_biens"],
    queryFn: async () => {
      const { data, error } = await supabase.from("airbnb_biens").select("*").order("code");
      if (error) throw error;
      return data;
    },
  });

  const nbBiensParClient = useMemo(() => {
    const m: Record<string, number> = {};
    biens.forEach((b) => { m[b.client_id] = (m[b.client_id] || 0) + 1; });
    return m;
  }, [biens]);

  const clientsSousSeuil = clients.filter(
    (c) => c.type_client === "conciergerie" && (nbBiensParClient[c.id] || 0) > 0 && (nbBiensParClient[c.id] || 0) < SEUIL_CONCIERGERIE,
  );

  const lignes = useMemo(() => {
    return biens
      .map((b) => ({ bien: b, client: clients.find((c) => c.id === b.client_id) }))
      .filter(({ bien, client }) => {
        if (fVille !== "all" && bien.ville !== fVille) return false;
        if (fType !== "all" && client?.type_client !== fType) return false;
        if (fService !== "all" && bien.services !== fService) return false;
        return true;
      });
  }, [biens, clients, fVille, fType, fService]);

  const [clientForm, setClientForm] = useState({
    nom: "", type_client: "conciergerie", telephone: "", email: "",
    ville: "Casablanca", mode_paiement: "passage", commercial: "", contrat_signe: false, notes: "",
  });

  const createClient = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("airbnb_clients").insert({
        ...clientForm,
        trigramme: calculerTrigramme(clientForm.nom),
        date_demarrage: new Date().toISOString().slice(0, 10),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Client créé");
      setOpenClient(false);
      setClientForm({ nom: "", type_client: "conciergerie", telephone: "", email: "", ville: "Casablanca", mode_paiement: "passage", commercial: "", contrat_signe: false, notes: "" });
      qc.invalidateQueries({ queryKey: ["airbnb_clients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [bienForm, setBienForm] = useState({
    client_id: "", quartier: "", ville: "Casablanca", typologie: "studio", adresse: "",
    acces_type: "Boîte à clés", acces_details: "", zone_eloignee: false, services: "menage",
    sets_rechange: 2, ical_url: "",
  });

  const clientBien = clients.find((c) => c.id === bienForm.client_id);
  const nbBiens = clientBien ? (nbBiensParClient[clientBien.id] || 0) : 0;
  const tarifPrevu = tarifApplicable(bienForm.typologie, nbBiens + 1);
  const lingeIndisponible = bienForm.ville !== "Casablanca";

  const createBien = useMutation({
    mutationFn: async () => {
      if (!clientBien) throw new Error("Sélectionnez un client");
      const code = codeBien(clientBien.trigramme || calculerTrigramme(clientBien.nom), nbBiens + 1);
      const { error } = await supabase.from("airbnb_biens").insert({
        ...bienForm,
        code,
        tarif_base: tarifPrevu,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bien ajouté");
      setOpenBien(false);
      qc.invalidateQueries({ queryKey: ["airbnb_biens"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const kpis = [
    { label: "Biens actifs", value: biens.length, hint: `chez ${new Set(biens.map((b) => b.client_id)).size} clients` },
    { label: "Clients conciergerie", value: clients.filter((c) => (nbBiensParClient[c.id] || 0) >= SEUIL_CONCIERGERIE).length, hint: "3 biens et plus — tarif forfait" },
    { label: "Sous le seuil", value: clientsSousSeuil.length, hint: "1–2 biens — à reclasser" },
    { label: "Biens avec service linge", value: biens.filter((b) => b.services === "menage_linge" || b.services === "tout").length, hint: "Casablanca uniquement" },
    { label: "En probatoire", value: clients.filter((c) => c.probatoire).length, hint: "facturation quinzaine" },
  ];

  return (
    <div className="space-y-4">
      {clientsSousSeuil.length > 0 && (
        <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <b>{clientsSousSeuil.length} client(s) sous le seuil des {SEUIL_CONCIERGERIE} biens</b>
            <p>Ils bénéficient encore du tarif conciergerie mais ne remplissent plus la condition. Reclassement au tarif standard possible moyennant un préavis écrit de 15 jours.</p>
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</div>
              <div className="text-2xl font-bold">{k.value}</div>
              <div className="text-xs text-muted-foreground">{k.hint}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Select value={vue} onValueChange={(v) => setVue(v as "bien" | "client")}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="bien">Vue : par bien</SelectItem>
            <SelectItem value="client">Vue : par client</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fVille} onValueChange={setFVille}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Ville" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les villes</SelectItem>
            <SelectItem value="Casablanca">Casablanca</SelectItem>
            <SelectItem value="Rabat">Rabat</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fType} onValueChange={setFType}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Type client" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {TYPES_CLIENT_AIRBNB.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fService} onValueChange={setFService}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Services" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les services</SelectItem>
            {SERVICES_BIEN.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="ml-auto flex gap-2">
          <Dialog open={openClient} onOpenChange={setOpenClient}>
            <DialogTrigger asChild>
              <Button variant="outline"><Plus className="mr-1 h-4 w-4" />Nouveau client</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Nouveau client Airbnb</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div>
                  <Label>Nom complet *</Label>
                  <Input value={clientForm.nom} onChange={(e) => setClientForm({ ...clientForm, nom: e.target.value })} placeholder="Ghali BENSOUDA" />
                  {clientForm.nom && <p className="mt-1 text-xs text-muted-foreground">Trigramme généré : <b>{calculerTrigramme(clientForm.nom)}</b></p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Type de client</Label>
                    <Select value={clientForm.type_client} onValueChange={(v) => setClientForm({ ...clientForm, type_client: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TYPES_CLIENT_AIRBNB.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Ville principale</Label>
                    <Select value={clientForm.ville} onValueChange={(v) => setClientForm({ ...clientForm, ville: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="Casablanca">Casablanca</SelectItem><SelectItem value="Rabat">Rabat</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label>Téléphone</Label><Input value={clientForm.telephone} onChange={(e) => setClientForm({ ...clientForm, telephone: e.target.value })} /></div>
                  <div><Label>Email</Label><Input value={clientForm.email} onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })} /></div>
                  <div>
                    <Label>Mode de paiement</Label>
                    <Select value={clientForm.mode_paiement} onValueChange={(v) => setClientForm({ ...clientForm, mode_paiement: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{MODES_PAIEMENT_AIRBNB.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Commercial référent</Label><Input value={clientForm.commercial} onChange={(e) => setClientForm({ ...clientForm, commercial: e.target.value })} /></div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={clientForm.contrat_signe} onCheckedChange={(v) => setClientForm({ ...clientForm, contrat_signe: v })} />
                  <Label>Contrat signé</Label>
                </div>
                <Textarea placeholder="Notes" value={clientForm.notes} onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })} />
              </div>
              <DialogFooter>
                <Button onClick={() => createClient.mutate()} disabled={!clientForm.nom}>Créer le client</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={openBien} onOpenChange={setOpenBien}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-1 h-4 w-4" />Nouveau bien</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Nouveau bien</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div>
                  <Label>Client *</Label>
                  <Select value={bienForm.client_id} onValueChange={(v) => setBienForm({ ...bienForm, client_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.nom} — {TYPES_CLIENT_AIRBNB.find((t) => t.value === c.type_client)?.label}</SelectItem>)}</SelectContent>
                  </Select>
                  {clientBien && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Code généré : <b>{codeBien(clientBien.trigramme || calculerTrigramme(clientBien.nom), nbBiens + 1)}</b> · {nbBiens + 1} bien(s) confié(s) → tarif {formatDH(tarifPrevu)}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Typologie</Label>
                    <Select value={bienForm.typologie} onValueChange={(v) => setBienForm({ ...bienForm, typologie: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TYPOLOGIES_BIEN.map((t) => <SelectItem key={t.value} value={t.value}>{t.label} — {t.tarif} DH</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Ville</Label>
                    <Select value={bienForm.ville} onValueChange={(v) => setBienForm({ ...bienForm, ville: v, services: v !== "Casablanca" ? "menage" : bienForm.services })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="Casablanca">Casablanca</SelectItem><SelectItem value="Rabat">Rabat</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Quartier</Label>
                    <Select value={bienForm.quartier} onValueChange={(v) => setBienForm({ ...bienForm, quartier: v })}>
                      <SelectTrigger><SelectValue placeholder="Quartier" /></SelectTrigger>
                      <SelectContent>{QUARTIERS_CASABLANCA.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Modalité d'accès</Label>
                    <Select value={bienForm.acces_type} onValueChange={(v) => setBienForm({ ...bienForm, acces_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ACCES_BIEN.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Adresse complète</Label><Input value={bienForm.adresse} onChange={(e) => setBienForm({ ...bienForm, adresse: e.target.value })} /></div>
                <div><Label>Détails d'accès (code, gardien…)</Label><Input value={bienForm.acces_details} onChange={(e) => setBienForm({ ...bienForm, acces_details: e.target.value })} /></div>
                <div>
                  <Label>Services souscrits</Label>
                  <Select value={bienForm.services} onValueChange={(v) => setBienForm({ ...bienForm, services: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SERVICES_BIEN.map((s) => (
                        <SelectItem key={s.value} value={s.value} disabled={lingeIndisponible && s.value !== "menage" && s.value !== "menage_reassort"}>
                          {s.label}{lingeIndisponible && (s.value === "menage_linge" || s.value === "tout") ? " — linge indisponible hors Casablanca" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 pt-6">
                    <Switch checked={bienForm.zone_eloignee} onCheckedChange={(v) => setBienForm({ ...bienForm, zone_eloignee: v })} />
                    <Label>Zone éloignée (+{SUPPLEMENT_ZONE} DH)</Label>
                  </div>
                  <div><Label>Sets de rechange chez le client</Label><Input type="number" value={bienForm.sets_rechange} onChange={(e) => setBienForm({ ...bienForm, sets_rechange: Number(e.target.value) })} /></div>
                </div>
                <div><Label>Lien calendrier iCal</Label><Input value={bienForm.ical_url} onChange={(e) => setBienForm({ ...bienForm, ical_url: e.target.value })} placeholder="https://…/calendar.ics" /></div>
              </div>
              <DialogFooter><Button onClick={() => createBien.mutate()} disabled={!bienForm.client_id}>Ajouter le bien</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {vue === "bien" ? (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Home className="h-4 w-4" />Répertoire des biens — une ligne = un appartement</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead><TableHead>Client</TableHead><TableHead>Bien</TableHead>
                  <TableHead>Typologie</TableHead><TableHead>Accès</TableHead><TableHead>Services</TableHead>
                  <TableHead>Tarif</TableHead><TableHead>Éligibilité</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lignes.length === 0 && <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Aucun bien enregistré. Créez d'abord un client, puis ajoutez ses biens.</TableCell></TableRow>}
                {lignes.map(({ bien, client }) => {
                  const nb = nbBiensParClient[bien.client_id] || 0;
                  return (
                    <TableRow key={bien.id}>
                      <TableCell className="font-mono font-semibold">{bien.code}</TableCell>
                      <TableCell>
                        <div className="font-medium">{client?.nom}</div>
                        <div className="text-xs text-muted-foreground">{TYPES_CLIENT_AIRBNB.find((t) => t.value === client?.type_client)?.label}</div>
                      </TableCell>
                      <TableCell>
                        <div>{bien.quartier}, {bien.ville}</div>
                        <div className="text-xs text-muted-foreground">{bien.adresse}</div>
                      </TableCell>
                      <TableCell>{labelTypologie(bien.typologie)}</TableCell>
                      <TableCell className="text-xs">{bien.acces_type}</TableCell>
                      <TableCell className="text-xs">{SERVICES_BIEN.find((s) => s.value === bien.services)?.label}</TableCell>
                      <TableCell className="whitespace-nowrap font-semibold">
                        {formatDH(Number(bien.tarif_base))}
                        {bien.zone_eloignee && <Badge variant="outline" className="ml-1">Zone +{SUPPLEMENT_ZONE}</Badge>}
                      </TableCell>
                      <TableCell>
                        {nb >= SEUIL_CONCIERGERIE
                          ? <Badge className="bg-green-100 text-green-800">{nb} biens ✓</Badge>
                          : <Badge variant="outline">{nb} bien(s) — standard</Badge>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {clients.map((c) => {
            const bs = biens.filter((b) => b.client_id === c.id);
            const total = bs.reduce((s, b) => s + Number(b.tarif_base), 0);
            return (
              <Card key={c.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2"><Building2 className="h-4 w-4" />{c.nom}</span>
                    <Badge variant="outline" className="font-mono">{c.trigramme}</Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {TYPES_CLIENT_AIRBNB.find((t) => t.value === c.type_client)?.label} · {c.ville} · {c.telephone || "—"}
                  </p>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex gap-4">
                    <div><div className="text-lg font-bold">{bs.length}</div><div className="text-xs text-muted-foreground">Biens confiés</div></div>
                    <div><div className="text-lg font-bold">{formatDH(total)}</div><div className="text-xs text-muted-foreground">Par tournée</div></div>
                    <div className="ml-auto self-center">
                      {bs.length >= SEUIL_CONCIERGERIE
                        ? <Badge className="bg-green-100 text-green-800">Éligible conciergerie</Badge>
                        : <Badge variant="outline">Sous le seuil</Badge>}
                    </div>
                  </div>
                  <div className="rounded-md border">
                    {bs.map((b) => (
                      <div key={b.id} className="flex justify-between border-b px-3 py-1.5 text-xs last:border-0">
                        <span className="font-mono">{b.code}</span>
                        <span>{b.quartier}</span>
                        <span>{labelTypologie(b.typologie)}</span>
                        <span className="font-semibold">{formatDH(Number(b.tarif_base))}</span>
                      </div>
                    ))}
                    {bs.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Aucun bien</div>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Règlement : {MODES_PAIEMENT_AIRBNB.find((m) => m.value === c.mode_paiement)?.label} · Commercial : {c.commercial || "—"}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Règles appliquées dans cette vue</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-xs text-muted-foreground">
          <p>· Une ligne = un appartement, jamais un client. Un client à 3 biens occupe 3 lignes.</p>
          <p>· Le tarif est calculé depuis la typologie via la grille conciergerie, et bascule sur {TARIF_STANDARD_LABEL} dès que le client passe sous {SEUIL_CONCIERGERIE} biens confiés.</p>
          <p>· Le badge Zone +{SUPPLEMENT_ZONE} s'affiche dès que le quartier appartient aux zones éloignées.</p>
          <p>· L'option linge est indisponible pour tout bien situé hors Casablanca — l'interface la grise plutôt que de la masquer.</p>
        </CardContent>
      </Card>
    </div>
  );
}

const TARIF_STANDARD_LABEL = "240 DH / 4h";
