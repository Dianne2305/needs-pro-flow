/**
 * EditOffreModal.tsx
 * Modal d'édition d'une offre/promo marketing existante.
 */
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { TYPES_REDUCTION, SEGMENTS_CLIENT, SERVICES_MARKETING, STATUT_OFFRE_COLORS } from "@/lib/marketing-constants";

/**
 * Props du modal d'édition d'offre marketing.
 * @property offre   - Offre à éditer (row Supabase `offres_marketing`), null = fermé.
 * @property onClose - Callback de fermeture.
 */
interface Props {
  offre: any | null;
  onClose: () => void;
}

/**
 * Modal permettant de modifier une offre/promo existante :
 * nom, code promo, réduction, segment, services, dates, limite, statut.
 */
export function EditOffreModal({ offre, onClose }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    nom: "",
    code_promo: "",
    type_reduction: "pourcentage",
    valeur_reduction: "",
    segment_client: "tous",
    services: [] as string[],
    limite: "",
    date_debut: "",
    date_fin: "",
    statut: "active",
  });

  /** Pré-remplir le formulaire quand l'offre change */
  useEffect(() => {
    if (offre) {
      setForm({
        nom: offre.nom || "",
        code_promo: offre.code_promo || "",
        type_reduction: offre.type_reduction || "pourcentage",
        valeur_reduction: String(offre.valeur_reduction ?? ""),
        segment_client: offre.segment_client || "tous",
        services: Array.isArray(offre.services_concernes) ? offre.services_concernes : [],
        limite: offre.limite_utilisation ? String(offre.limite_utilisation) : "",
        date_debut: offre.date_debut || "",
        date_fin: offre.date_fin || "",
        statut: offre.statut || "active",
      });
    }
  }, [offre]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("offres_marketing")
        .update({
          nom: form.nom,
          code_promo: form.code_promo || null,
          type_reduction: form.type_reduction,
          valeur_reduction: Number(form.valeur_reduction),
          segment_client: form.segment_client,
          services_concernes: form.services,
          limite_utilisation: form.limite ? Number(form.limite) : null,
          date_debut: form.date_debut,
          date_fin: form.date_fin || null,
          statut: form.statut,
        })
        .eq("id", offre?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offres_marketing"] });
      toast.success("Offre modifiée !");
      onClose();
    },
    onError: () => toast.error("Erreur lors de la modification"),
  });

  const toggleService = (s: string) => {
    setForm((prev) => ({
      ...prev,
      services: prev.services.includes(s) ? prev.services.filter((x) => x !== s) : [...prev.services, s],
    }));
  };

  const statutOptions = Object.entries(STATUT_OFFRE_COLORS).map(([value, { label }]) => ({ value, label }));

  return (
    <Dialog open={!!offre} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier l'offre</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nom de l'offre</Label>
            <Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
          </div>
          <div>
            <Label>Code promo</Label>
            <Input value={form.code_promo} onChange={(e) => setForm({ ...form, code_promo: e.target.value.toUpperCase() })} className="font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type de réduction</Label>
              <Select value={form.type_reduction} onValueChange={(v) => setForm({ ...form, type_reduction: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES_REDUCTION.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valeur</Label>
              <Input type="number" value={form.valeur_reduction} onChange={(e) => setForm({ ...form, valeur_reduction: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Segment client</Label>
            <Select value={form.segment_client} onValueChange={(v) => setForm({ ...form, segment_client: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SEGMENTS_CLIENT.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Services concernés</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {SERVICES_MARKETING.map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.services.includes(s)} onCheckedChange={() => toggleService(s)} />
                  {s}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label>Limite d'utilisation (vide = illimité)</Label>
            <Input type="number" placeholder="Illimité" value={form.limite} onChange={(e) => setForm({ ...form, limite: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date début</Label>
              <Input type="date" value={form.date_debut} onChange={(e) => setForm({ ...form, date_debut: e.target.value })} />
            </div>
            <div>
              <Label>Date fin</Label>
              <Input type="date" value={form.date_fin} onChange={(e) => setForm({ ...form, date_fin: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Statut</Label>
            <Select value={form.statut} onValueChange={(v) => setForm({ ...form, statut: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {statutOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => mutation.mutate()} disabled={!form.nom || !form.valeur_reduction || mutation.isPending} className="w-full">
            ✅ Enregistrer les modifications
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
