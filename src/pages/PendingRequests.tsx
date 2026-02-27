import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Check, X, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TYPES_PRESTATION, TYPES_BIEN, FREQUENCES, QUARTIERS_CASABLANCA } from "@/lib/constants";

type Demande = Tables<"demandes">;

const emptyForm = {
  nom: "", telephone_direct: "+212", telephone_whatsapp: "+212",
  type_service: "SPP" as string, type_prestation: "" as string, type_bien: "" as string,
  frequence: "ponctuel", duree_heures: "" as string, nombre_intervenants: "1",
  date_prestation: "", heure_prestation: "", quartier: "", adresse: "",
  montant_total: "", notes_client: "",
};

export default function PendingRequests() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: demandes = [], isLoading } = useQuery({
    queryKey: ["demandes", "en_attente"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandes")
        .select("*")
        .eq("statut", "en_attente")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Demande[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("demandes").insert({
        nom: form.nom,
        telephone_direct: form.telephone_direct,
        telephone_whatsapp: form.telephone_whatsapp,
        type_service: form.type_service,
        type_prestation: form.type_prestation,
        type_bien: form.type_bien || null,
        frequence: form.frequence,
        duree_heures: form.duree_heures ? Number(form.duree_heures) : null,
        nombre_intervenants: Number(form.nombre_intervenants) || 1,
        date_prestation: form.date_prestation || null,
        heure_prestation: form.heure_prestation || null,
        quartier: form.quartier || null,
        adresse: form.adresse || null,
        montant_total: form.montant_total ? Number(form.montant_total) : null,
        notes_client: form.notes_client || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demandes"] });
      setForm(emptyForm);
      setDialogOpen(false);
      toast({ title: "Demande ajoutée avec succès" });
    },
    onError: (e) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, statut }: { id: string; statut: string }) => {
      const updates: Record<string, unknown> = { statut };
      if (statut === "confirmee") updates.confirmed_at = new Date().toISOString();
      const { error } = await supabase.from("demandes").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demandes"] });
      toast({ title: "Statut mis à jour" });
    },
  });

  const filtered = demandes.filter((d) =>
    d.nom.toLowerCase().includes(search.toLowerCase()) ||
    d.type_prestation.toLowerCase().includes(search.toLowerCase())
  );

  const updateField = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Demandes en attente</h1>
          <p className="text-muted-foreground text-sm">{filtered.length} demande(s) en attente de confirmation</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nouvelle demande</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Ajouter une demande client</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div><Label>Nom *</Label><Input value={form.nom} onChange={(e) => updateField("nom", e.target.value)} /></div>
              <div><Label>Tél. direct</Label><Input value={form.telephone_direct} onChange={(e) => updateField("telephone_direct", e.target.value)} /></div>
              <div><Label>Tél. WhatsApp</Label><Input value={form.telephone_whatsapp} onChange={(e) => updateField("telephone_whatsapp", e.target.value)} /></div>
              <div>
                <Label>Type de service *</Label>
                <Select value={form.type_service} onValueChange={(v) => updateField("type_service", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SPP">Service pour Particuliers (SPP)</SelectItem>
                    <SelectItem value="SPE">Service pour Entreprises (SPE)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type de prestation *</Label>
                <Select value={form.type_prestation} onValueChange={(v) => updateField("type_prestation", v)}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>{TYPES_PRESTATION.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type de bien</Label>
                <Select value={form.type_bien} onValueChange={(v) => updateField("type_bien", v)}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>{TYPES_BIEN.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fréquence</Label>
                <Select value={form.frequence} onValueChange={(v) => updateField("frequence", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FREQUENCES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Durée (heures)</Label><Input type="number" value={form.duree_heures} onChange={(e) => updateField("duree_heures", e.target.value)} /></div>
              <div><Label>Nb intervenants</Label><Input type="number" value={form.nombre_intervenants} onChange={(e) => updateField("nombre_intervenants", e.target.value)} /></div>
              <div><Label>Date prestation</Label><Input type="date" value={form.date_prestation} onChange={(e) => updateField("date_prestation", e.target.value)} /></div>
              <div><Label>Heure</Label><Input type="time" value={form.heure_prestation} onChange={(e) => updateField("heure_prestation", e.target.value)} /></div>
              <div>
                <Label>Quartier</Label>
                <Select value={form.quartier} onValueChange={(v) => updateField("quartier", v)}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>{QUARTIERS_CASABLANCA.map((q) => <SelectItem key={q} value={q}>{q}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Adresse</Label><Input value={form.adresse} onChange={(e) => updateField("adresse", e.target.value)} /></div>
              <div>
                <Label>Montant total (MAD)</Label>
                <Input type="number" value={form.montant_total} onChange={(e) => updateField("montant_total", e.target.value)} />
                {form.montant_total && (
                  <p className="text-xs text-muted-foreground mt-1">Montant candidat : {(Number(form.montant_total) / 2).toFixed(2)} MAD</p>
                )}
              </div>
              <div className="md:col-span-2"><Label>Notes client</Label><Textarea value={form.notes_client} onChange={(e) => updateField("notes_client", e.target.value)} /></div>
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={() => addMutation.mutate()} disabled={!form.nom || !form.type_prestation || addMutation.isPending}>
                {addMutation.isPending ? "Ajout..." : "Ajouter la demande"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Chargement...</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Aucune demande en attente</CardContent></Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Prestation</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-xs">#{d.num_demande}</TableCell>
                  <TableCell className="font-medium">{d.nom}</TableCell>
                  <TableCell className="text-sm">{d.telephone_direct}</TableCell>
                  <TableCell>
                    <Badge className={d.type_service === "SPP" ? "bg-primary text-primary-foreground" : "bg-spe text-spe-foreground"}>
                      {d.type_service}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{d.type_prestation}</TableCell>
                  <TableCell className="text-sm">{d.date_prestation || "—"}</TableCell>
                  <TableCell className="text-sm">{d.montant_total ? `${d.montant_total} MAD` : "—"}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="ghost" className="text-emerald-600 hover:text-emerald-700" onClick={() => statusMutation.mutate({ id: d.id, statut: "confirmee" })}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive/80" onClick={() => statusMutation.mutate({ id: d.id, statut: "rejetee" })}>
                      <X className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
