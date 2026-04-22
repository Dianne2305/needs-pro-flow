/**
 * CreateGesteModal.tsx
 * Modal complet de création d'un geste commercial avec lookup client,
 * calcul tarifaire HT/TVA/TTC, répartition profil/agence, et envoi message.
 */
import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { TYPES_GESTE, STATUTS_GESTE, CANAUX_DIFFUSION } from "@/lib/marketing-constants";
import { Search } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

const initialForm = {
  client_nom: "",
  client_telephone: "",
  ville: "",
  quartier: "",
  demande_id: "",
  date_geste: new Date().toISOString().split("T")[0],
  statut_geste: "en_attente",
  type_geste: "reduction_tarif",
  montant_ht: "",
  tva_active: false,
  reduction_type: "montant",
  reduction_valeur: "",
  part_profil: "",
  part_agence: "",
  motif: "",
  envoyer_message: false,
  message_client: "",
  canal_diffusion: [] as string[],
  commercial: "",
  cree_par: "",
};

export function CreateGesteModal({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...initialForm });
  const [clientSearch, setClientSearch] = useState("");
  const [showClientList, setShowClientList] = useState(false);
  const [showRepartition, setShowRepartition] = useState(false);

  // Fetch clients (unique from demandes)
  const { data: demandes = [] } = useQuery({
    queryKey: ["demandes_for_geste"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandes")
        .select("id, nom, telephone_direct, ville, quartier, frequence, num_demande, statut")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Unique clients
  const uniqueClients = useMemo(() => {
    const map = new Map<string, { nom: string; telephone: string; ville: string; quartier: string; count: number; frequence: string }>();
    demandes.forEach((d: any) => {
      const key = d.nom?.toLowerCase();
      if (!key) return;
      if (map.has(key)) {
        map.get(key)!.count++;
      } else {
        map.set(key, {
          nom: d.nom,
          telephone: d.telephone_direct || "",
          ville: d.ville || "",
          quartier: d.quartier || "",
          count: 1,
          frequence: d.frequence || "ponctuel",
        });
      }
    });
    return Array.from(map.values());
  }, [demandes]);

  const filteredClients = useMemo(() => {
    if (!clientSearch) return uniqueClients.slice(0, 20);
    return uniqueClients.filter((c) => c.nom.toLowerCase().includes(clientSearch.toLowerCase())).slice(0, 20);
  }, [uniqueClients, clientSearch]);

  // Client demands for reference dropdown
  const clientDemandes = useMemo(() => {
    return demandes.filter((d: any) => d.nom?.toLowerCase() === form.client_nom.toLowerCase());
  }, [demandes, form.client_nom]);

  // Tariff calculations
  const montantHT = Number(form.montant_ht) || 0;
  const tvaMontant = form.tva_active ? montantHT * 0.2 : 0;
  const montantTTC = montantHT + tvaMontant;
  const reductionAmount = form.reduction_type === "pourcentage"
    ? montantTTC * (Number(form.reduction_valeur) || 0) / 100
    : Number(form.reduction_valeur) || 0;
  const totalAPayer = Math.max(0, montantTTC - reductionAmount);

  const selectClient = (c: typeof uniqueClients[0]) => {
    setForm({
      ...form,
      client_nom: c.nom,
      client_telephone: c.telephone,
      ville: c.ville,
      quartier: c.quartier,
    });
    setShowClientList(false);
    setClientSearch("");
  };

  const toggleCanal = (val: string) => {
    setForm((prev) => ({
      ...prev,
      canal_diffusion: prev.canal_diffusion.includes(val)
        ? prev.canal_diffusion.filter((v) => v !== val)
        : [...prev.canal_diffusion, val],
    }));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const isAnnulation = form.type_geste === "facturation_annulee" || form.type_geste === "intervention_gratuite";
      const { error } = await supabase.from("gestes_commerciaux").insert({
        client_nom: form.client_nom,
        client_telephone: form.client_telephone || null,
        ville: form.ville || null,
        quartier: form.quartier || null,
        demande_id: form.demande_id || null,
        date_geste: form.date_geste,
        statut_geste: form.statut_geste,
        type_geste: form.type_geste,
        montant_ht: montantHT,
        tva_active: form.tva_active,
        tva_montant: tvaMontant,
        montant_ttc: montantTTC,
        reduction_type: form.reduction_type,
        reduction_valeur: Number(form.reduction_valeur) || 0,
        total_a_payer: isAnnulation ? 0 : totalAPayer,
        part_profil: Number(form.part_profil) || 0,
        part_agence: Number(form.part_agence) || 0,
        motif: form.motif || null,
        envoyer_message: form.envoyer_message,
        message_client: form.envoyer_message ? form.message_client || null : null,
        canal_diffusion: form.envoyer_message ? form.canal_diffusion : [],
        commercial: form.commercial || null,
        cree_par: form.cree_par || null,
        montant: isAnnulation ? montantTTC : totalAPayer,
        pourcentage: form.reduction_type === "pourcentage" ? Number(form.reduction_valeur) || null : null,
        raison: form.motif || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gestes_commerciaux"] });
      toast.success("Geste commercial créé !");
      onClose();
      setForm({ ...initialForm });
    },
    onError: () => toast.error("Erreur lors de la création"),
  });

  const isAnnulation = form.type_geste === "facturation_annulee" || form.type_geste === "intervention_gratuite";
  const repartitionValid = isAnnulation || (Number(form.part_profil || 0) + Number(form.part_agence || 0) === totalAPayer);

  const clientInfo = useMemo(() => {
    const c = uniqueClients.find((cl) => cl.nom.toLowerCase() === form.client_nom.toLowerCase());
    if (!c) return null;
    return c;
  }, [uniqueClients, form.client_nom]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer un geste commercial</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* 1. Client */}
          <div className="relative">
            <Label>Nom du client *</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un client..."
                className="pl-8"
                value={showClientList ? clientSearch : form.client_nom}
                onFocus={() => { setShowClientList(true); setClientSearch(""); }}
                onChange={(e) => { setClientSearch(e.target.value); setShowClientList(true); }}
              />
            </div>
            {showClientList && (
              <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                {filteredClients.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">Aucun client trouvé</div>
                ) : (
                  filteredClients.map((c, i) => (
                    <button key={i} className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex justify-between items-center" onClick={() => selectClient(c)}>
                      <span className="font-medium">{c.nom}</span>
                      <span className="text-xs text-muted-foreground">{c.ville} — {c.count} demande(s)</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Client info auto */}
          {form.client_nom && clientInfo && (
            <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
              <div className="flex gap-4 flex-wrap">
                <span><strong>Tél :</strong> {form.client_telephone || "—"}</span>
                <span><strong>Ville :</strong> {form.ville || "—"}</span>
                <span><strong>Quartier :</strong> {form.quartier || "—"}</span>
              </div>
              <div className="flex gap-4 flex-wrap">
                <span><strong>Fidélité :</strong> {clientInfo.count === 1 ? "Nouveau client" : `${clientInfo.count} demandes`}</span>
                <span><strong>Fréquence :</strong> {clientInfo.frequence === "ponctuel" ? "Une seule fois" : "Abonnement"}</span>
              </div>
            </div>
          )}

          {/* 2. Date */}
          <div>
            <Label>Date du geste commercial</Label>
            <Input type="date" value={form.date_geste} onChange={(e) => setForm({ ...form, date_geste: e.target.value })} />
          </div>

          {/* 3. Référence demande */}
          <div>
            <Label>Référence de la demande</Label>
            <Select value={form.demande_id} onValueChange={(v) => setForm({ ...form, demande_id: v })}>
              <SelectTrigger><SelectValue placeholder="Sélectionner une demande" /></SelectTrigger>
              <SelectContent>
                {clientDemandes.length === 0 ? (
                  <SelectItem value="none" disabled>Aucune demande</SelectItem>
                ) : (
                  clientDemandes.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>#{d.num_demande} — {d.statut}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* 4. Statut */}
          <div>
            <Label>Statut du geste commercial</Label>
            <Select value={form.statut_geste} onValueChange={(v) => setForm({ ...form, statut_geste: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUTS_GESTE.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* 5. Type */}
          <div>
            <Label>Type de geste commercial *</Label>
            <Select value={form.type_geste} onValueChange={(v) => setForm({ ...form, type_geste: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES_GESTE.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* 6. Tarif */}
          <div className="border rounded-md p-4 space-y-3 bg-muted/30">
            <h4 className="font-semibold text-sm">Tarification</h4>
            <div>
              <Label>Montant HT (MAD)</Label>
              <Input type="number" value={form.montant_ht} onChange={(e) => setForm({ ...form, montant_ht: e.target.value })} placeholder="0" />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.tva_active} onCheckedChange={(v) => setForm({ ...form, tva_active: v })} />
              <Label>TVA 20%</Label>
              {form.tva_active && <span className="text-sm text-muted-foreground">TVA : {tvaMontant.toFixed(2)} MAD</span>}
            </div>
            {form.tva_active && (
              <div className="text-sm"><strong>Montant TTC :</strong> {montantTTC.toFixed(2)} MAD</div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type de réduction</Label>
                <Select value={form.reduction_type} onValueChange={(v) => setForm({ ...form, reduction_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="montant">Montant (MAD)</SelectItem>
                    <SelectItem value="pourcentage">Pourcentage (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valeur de la réduction</Label>
                <Input type="number" value={form.reduction_valeur} onChange={(e) => setForm({ ...form, reduction_valeur: e.target.value })} placeholder="0" />
              </div>
            </div>
            {reductionAmount > 0 && (
              <div className="text-sm text-muted-foreground">Réduction : -{reductionAmount.toFixed(2)} MAD</div>
            )}
            <div className="text-base font-bold border-t pt-2">
              Total à payer : {isAnnulation ? "0.00" : totalAPayer.toFixed(2)} MAD
              {isAnnulation && <span className="ml-2 text-xs font-normal text-destructive">(Perte agence)</span>}
            </div>
          </div>

          {/* 7. Répartition */}
          {!isAnnulation && totalAPayer > 0 && (
            <div className="border rounded-md p-4 space-y-3 bg-muted/30">
              <h4 className="font-semibold text-sm">Répartition du montant</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Part du profil (MAD)</Label>
                  <Input type="number" value={form.part_profil} onChange={(e) => setForm({ ...form, part_profil: e.target.value })} placeholder="0" />
                </div>
                <div>
                  <Label>Part de l'agence (MAD)</Label>
                  <Input type="number" value={form.part_agence} onChange={(e) => setForm({ ...form, part_agence: e.target.value })} placeholder="0" />
                </div>
              </div>
              {!repartitionValid && (
                <p className="text-xs text-destructive">
                  Part profil ({form.part_profil || 0}) + Part agence ({form.part_agence || 0}) doit être = {totalAPayer.toFixed(2)} MAD
                </p>
              )}
            </div>
          )}

          {isAnnulation && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
              ⚠️ Facturation annulée / Intervention gratuite : l'agence doit le montant au profil. Ce montant sera comptabilisé en perte et ajouté au Crédit.
            </div>
          )}

          {/* 8. Motif */}
          <div>
            <Label>Motif du geste *</Label>
            <Textarea placeholder="Raison du geste commercial..." value={form.motif} onChange={(e) => setForm({ ...form, motif: e.target.value })} rows={2} />
          </div>

          {/* 9. Message */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Label>Envoyer un message au client ?</Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant={!form.envoyer_message ? "default" : "outline"} size="sm" onClick={() => setForm({ ...form, envoyer_message: false })}>Non</Button>
                <Button type="button" variant={form.envoyer_message ? "default" : "outline"} size="sm" onClick={() => setForm({ ...form, envoyer_message: true })}>Oui</Button>
              </div>
            </div>
            <div className={!form.envoyer_message ? "opacity-40 pointer-events-none" : ""}>
              <Label>Message</Label>
              <Textarea placeholder="Rédigez le message à envoyer au client..." value={form.message_client} onChange={(e) => setForm({ ...form, message_client: e.target.value })} rows={3} />
              <div className="flex gap-3 mt-2">
                {CANAUX_DIFFUSION.map((c) => (
                  <label key={c.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox checked={form.canal_diffusion.includes(c.value)} onCheckedChange={() => toggleCanal(c.value)} />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* 10. Créé par */}
          <div>
            <Label>Créé par</Label>
            <Input placeholder="Nom du commercial" value={form.cree_par} onChange={(e) => setForm({ ...form, cree_par: e.target.value })} />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={() => mutation.mutate()}
              disabled={!form.client_nom || !form.type_geste || !form.motif || (!isAnnulation && totalAPayer > 0 && !repartitionValid) || mutation.isPending}
              className="flex-1"
            >
              ✅ Enregistrer le geste commercial
            </Button>
            {form.envoyer_message && form.message_client && (
              <Button variant="outline" onClick={() => toast.info("Fonctionnalité d'envoi à venir")} className="whitespace-nowrap">
                📩 Envoyer le message
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
