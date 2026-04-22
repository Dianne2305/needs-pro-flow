/**
 * EditOffreModal.tsx
 * Modal d'édition d'une offre/promo marketing existante.
 */
import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  TYPES_REDUCTION,
  SEGMENTS_CLIENT,
  STATUTS_CLIENT,
  STATUTS_CODE_PROMO,
  SERVICES_PARTICULIER,
  SERVICES_ENTREPRISE,
  CANAUX_DIFFUSION,
} from "@/lib/marketing-constants";

/**
 * @property offre   - Offre à éditer (row Supabase `offres_marketing`), null = fermé.
 * @property onClose - Callback de fermeture.
 */
interface Props {
  offre: any | null;
  onClose: () => void;
}

/**
 * Modal d'édition d'un code promo existant, miroir du formulaire de création.
 */
export function EditOffreModal({ offre, onClose }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    nom: "",
    statut: "active",
    code_promo: "",
    type_reduction: "pourcentage",
    valeur_reduction: "",
    segment_client: "particulier",
    statut_client: "tous",
    services: [] as string[],
    canaux: [] as string[],
    message_promotionnel: "",
    date_debut: "",
    date_fin: "",
    date_indeterminee: false,
  });

  /** Pré-remplir le formulaire quand l'offre change */
  useEffect(() => {
    if (offre) {
      const hasFin = !!offre.date_fin;
      setForm({
        nom: offre.nom || "",
        statut: offre.statut || "active",
        code_promo: offre.code_promo || "",
        type_reduction: offre.type_reduction || "pourcentage",
        valeur_reduction: String(offre.valeur_reduction ?? ""),
        segment_client: offre.segment_client || "particulier",
        statut_client: offre.statut_client || "tous",
        services: Array.isArray(offre.services_concernes) ? offre.services_concernes : [],
        canaux: Array.isArray(offre.canaux_diffusion) ? offre.canaux_diffusion : [],
        message_promotionnel: offre.message_promotionnel || "",
        date_debut: offre.date_debut || "",
        date_fin: offre.date_fin || "",
        date_indeterminee: !hasFin,
      });
    }
  }, [offre]);

  const servicesDisponibles = useMemo(() => {
    if (form.segment_client === "entreprise") return [...SERVICES_ENTREPRISE];
    return [...SERVICES_PARTICULIER];
  }, [form.segment_client]);

  const handleSegmentChange = (v: string) => {
    setForm((prev) => ({ ...prev, segment_client: v, services: [] }));
  };

  const toggleService = (s: string) => {
    setForm((prev) => ({
      ...prev,
      services: prev.services.includes(s)
        ? prev.services.filter((x) => x !== s)
        : [...prev.services, s],
    }));
  };

  const isValid = useMemo(() => {
    if (!form.nom || !form.code_promo || !form.valeur_reduction) return false;
    if (form.services.length === 0) return false;
    if (!form.date_debut) return false;
    if (!form.date_indeterminee && !form.date_fin) return false;
    if (!form.date_indeterminee && form.date_fin && form.date_fin < form.date_debut) return false;
    return true;
  }, [form]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("offres_marketing")
        .update({
          nom: form.nom,
          statut: form.statut,
          code_promo: form.code_promo || null,
          type_reduction: form.type_reduction,
          valeur_reduction: Number(form.valeur_reduction),
          segment_client: form.segment_client,
          statut_client: form.statut_client,
          services_concernes: form.services,
          canaux_diffusion: form.canaux,
          message_promotionnel: form.message_promotionnel || null,
          date_debut: form.date_debut,
          date_fin: form.date_indeterminee ? null : form.date_fin || null,
        })
        .eq("id", offre?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offres_marketing"] });
      toast.success("Offre modifiée !");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || "Erreur lors de la modification"),
  });

  return (
    <Dialog open={!!offre} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le code promo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nom de l'offre *</Label>
            <Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
          </div>
          <div>
            <Label>Statut du code promo *</Label>
            <Select value={form.statut} onValueChange={(v) => setForm({ ...form, statut: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUTS_CODE_PROMO.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Code promo *</Label>
            <Input value={form.code_promo} onChange={(e) => setForm({ ...form, code_promo: e.target.value.toUpperCase() })} className="font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type de réduction *</Label>
              <Select value={form.type_reduction} onValueChange={(v) => setForm({ ...form, type_reduction: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES_REDUCTION.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valeur *</Label>
              <Input type="number" value={form.valeur_reduction} onChange={(e) => setForm({ ...form, valeur_reduction: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Segment *</Label>
            <Select value={form.segment_client} onValueChange={handleSegmentChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SEGMENTS_CLIENT.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Statut client *</Label>
            <Select value={form.statut_client} onValueChange={(v) => setForm({ ...form, statut_client: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUTS_CLIENT.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Services concernés *</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {servicesDisponibles.map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.services.includes(s)} onCheckedChange={() => toggleService(s)} />
                  {s}
                </label>
              ))}
            </div>
          </div>

          {/* Canal de diffusion (multichoix) */}
          <div>
            <Label>Canal de diffusion *</Label>
            <div className="flex flex-wrap gap-4 mt-1">
              {CANAUX_DIFFUSION.map((c) => (
                <label key={c.value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.canaux.includes(c.value)}
                    onCheckedChange={() =>
                      setForm((prev) => ({
                        ...prev,
                        canaux: prev.canaux.includes(c.value)
                          ? prev.canaux.filter((x) => x !== c.value)
                          : [...prev.canaux, c.value],
                      }))
                    }
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          {/* Message promotionnel (facultatif) */}
          <div>
            <Label>Message promotionnel <span className="text-xs text-muted-foreground">(facultatif)</span></Label>
            <Textarea
              placeholder="Profitez de 20% de réduction sur votre prochaine demande avec le code BIENVENUE20, valable jusqu'au 30/06/2026."
              value={form.message_promotionnel}
              onChange={(e) => setForm({ ...form, message_promotionnel: e.target.value })}
              rows={3}
            />
          </div>

          <div>
            <Label>Promotion valable</Label>
            <div className="grid grid-cols-2 gap-3 mt-1">
              <div>
                <Label className="text-xs text-muted-foreground">Date début *</Label>
                <Input type="date" value={form.date_debut} onChange={(e) => setForm({ ...form, date_debut: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Date fin {form.date_indeterminee ? "" : "*"}</Label>
                <Input
                  type="date"
                  value={form.date_fin}
                  onChange={(e) => setForm({ ...form, date_fin: e.target.value })}
                  disabled={form.date_indeterminee}
                  min={form.date_debut}
                  className={form.date_indeterminee ? "opacity-50" : ""}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm mt-2">
              <Checkbox
                checked={form.date_indeterminee}
                onCheckedChange={(checked) => setForm({ ...form, date_indeterminee: !!checked, date_fin: "" })}
              />
              Date indéterminée
            </label>
          </div>
          <Button onClick={() => mutation.mutate()} disabled={!isValid || mutation.isPending} className="w-full">
            ✅ Enregistrer les modifications
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
