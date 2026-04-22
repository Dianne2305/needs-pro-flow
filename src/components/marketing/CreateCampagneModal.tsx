/**
 * CreateCampagneModal.tsx
 * Modal complet de création d'une campagne marketing.
 */
import { useState } from "react";
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
  STATUTS_CAMPAGNE,
  CIBLES_CAMPAGNE,
  SEGMENTS_CLIENT,
  CRITERES_CLIENT,
  CRITERES_PROFIL,
  CANAUX_CAMPAGNE,
} from "@/lib/marketing-constants";

interface Props {
  open: boolean;
  onClose: () => void;
}

const initialForm = {
  nom: "",
  message: "",
  statut: "brouillon",
  cible: "client",
  segment_cible: "tous",
  critere_ciblage: "tous",
  canal: [] as string[],
  ville_ciblage: "Casablanca",
  heure_debut: "",
  heure_fin: "",
  date_diffusion: "",
  nombre_destinataires_jour: "",
};

export function CreateCampagneModal({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...initialForm });

  const toggleCanal = (val: string) => {
    setForm((prev) => ({
      ...prev,
      canal: prev.canal.includes(val)
        ? prev.canal.filter((v) => v !== val)
        : [...prev.canal, val],
    }));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("campagnes_marketing").insert({
        nom: form.nom,
        message: form.message || null,
        statut: form.statut,
        cible: form.cible,
        segment_cible: form.cible === "client" ? form.segment_cible : "tous",
        critere_ciblage: form.critere_ciblage,
        canal: form.canal.length > 0 ? form.canal.join(",") : "whatsapp",
        ville_ciblage: form.ville_ciblage || null,
        heure_debut: form.heure_debut || null,
        heure_fin: form.heure_fin || null,
        date_diffusion: form.date_diffusion || null,
        nombre_destinataires_jour: Number(form.nombre_destinataires_jour) || 0,
        nombre_destinataires: Number(form.nombre_destinataires_jour) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campagnes_marketing"] });
      toast.success("Campagne créée !");
      onClose();
      setForm({ ...initialForm });
    },
    onError: () => toast.error("Erreur lors de la création"),
  });

  const criteres = form.cible === "client" ? CRITERES_CLIENT : CRITERES_PROFIL;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer une campagne</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Titre */}
          <div>
            <Label>Titre de la campagne *</Label>
            <Input placeholder="ex: Relance clients inactifs" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
          </div>

          {/* Message */}
          <div>
            <Label>Message de la campagne</Label>
            <Textarea rows={4} placeholder="Bonjour, profitez de 15% de réduction sur votre prochaine prestation..." value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          </div>

          {/* Statut */}
          <div>
            <Label>Statut de la campagne</Label>
            <Select value={form.statut} onValueChange={(v) => setForm({ ...form, statut: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUTS_CAMPAGNE.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Cible */}
          <div>
            <Label>Cible *</Label>
            <Select value={form.cible} onValueChange={(v) => setForm({ ...form, cible: v, critere_ciblage: "tous", segment_cible: "tous" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CIBLES_CAMPAGNE.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Segment (si client) */}
          {form.cible === "client" && (
            <div>
              <Label>Segment</Label>
              <Select value={form.segment_cible} onValueChange={(v) => setForm({ ...form, segment_cible: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous</SelectItem>
                  {SEGMENTS_CLIENT.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Critère de ciblage */}
          <div>
            <Label>Critère de ciblage</Label>
            <Select value={form.critere_ciblage} onValueChange={(v) => setForm({ ...form, critere_ciblage: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {criteres.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Canal de diffusion (multichoix) */}
          <div>
            <Label>Canal de diffusion *</Label>
            <div className="flex gap-4 mt-1">
              {CANAUX_CAMPAGNE.map((c) => (
                <label key={c.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox checked={form.canal.includes(c.value)} onCheckedChange={() => toggleCanal(c.value)} />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          {/* Ville */}
          <div>
            <Label>Ville de ciblage</Label>
            <Input value={form.ville_ciblage} onChange={(e) => setForm({ ...form, ville_ciblage: e.target.value })} placeholder="Casablanca" />
          </div>

          {/* Heure de diffusion */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Heure de début</Label>
              <Input type="time" value={form.heure_debut} onChange={(e) => setForm({ ...form, heure_debut: e.target.value })} />
            </div>
            <div>
              <Label>Heure de fin</Label>
              <Input type="time" value={form.heure_fin} onChange={(e) => setForm({ ...form, heure_fin: e.target.value })} />
            </div>
          </div>

          {/* Date de diffusion */}
          <div>
            <Label>Date de diffusion</Label>
            <Input type="date" value={form.date_diffusion} onChange={(e) => setForm({ ...form, date_diffusion: e.target.value })} />
          </div>

          {/* Nombre estimé de destinataires par jour */}
          <div>
            <Label>Nombre estimé de destinataires par jour</Label>
            <Input type="number" value={form.nombre_destinataires_jour} onChange={(e) => setForm({ ...form, nombre_destinataires_jour: e.target.value })} placeholder="0" />
          </div>

          {/* Bouton */}
          <Button
            onClick={() => {
              if (!form.nom) { toast.error("Veuillez saisir un titre"); return; }
              if (form.canal.length === 0) { toast.error("Veuillez choisir au moins un canal"); return; }
              mutation.mutate();
            }}
            disabled={mutation.isPending}
            className="w-full"
          >
            🚀 Créer la campagne
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
