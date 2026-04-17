/**
 * CreateCampagneModal.tsx
 * Modal de création d'une campagne marketing (nom, segment, canal, message).
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
import { toast } from "sonner";
import { SEGMENTS_CLIENT, CANAUX_CAMPAGNE } from "@/lib/marketing-constants";

/**
 * Props du modal de création de campagne marketing.
 * @property open    - État ouvert/fermé.
 * @property onClose - Callback de fermeture.
 */
interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Modal de création d'une campagne marketing multi-canal (WhatsApp/Email/SMS).
 * Insère dans `campagnes_marketing` avec segment ciblé, message et destinataires estimés.
 */
export function CreateCampagneModal({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    nom: "",
    segment_cible: "tous",
    canal: "whatsapp",
    message: "",
    nombre_destinataires: "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("campagnes_marketing").insert({
        nom: form.nom,
        segment_cible: form.segment_cible,
        canal: form.canal,
        message: form.message || null,
        nombre_destinataires: form.nombre_destinataires ? Number(form.nombre_destinataires) : 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campagnes_marketing"] });
      toast.success("Campagne créée !");
      onClose();
      setForm({ nom: "", segment_cible: "tous", canal: "whatsapp", message: "", nombre_destinataires: "" });
    },
    onError: () => toast.error("Erreur lors de la création"),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer une campagne</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nom de la campagne</Label>
            <Input placeholder="ex: Relance clients inactifs" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
          </div>
          <div>
            <Label>Segment ciblé</Label>
            <Select value={form.segment_cible} onValueChange={(v) => setForm({ ...form, segment_cible: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SEGMENTS_CLIENT.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Canal d'envoi</Label>
            <Select value={form.canal} onValueChange={(v) => setForm({ ...form, canal: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CANAUX_CAMPAGNE.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nombre de destinataires estimé</Label>
            <Input type="number" value={form.nombre_destinataires} onChange={(e) => setForm({ ...form, nombre_destinataires: e.target.value })} />
          </div>
          <div>
            <Label>Message</Label>
            <Textarea rows={5} placeholder="Bonjour, profitez de 15% de réduction sur votre prochaine prestation..." value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          </div>
          <Button onClick={() => mutation.mutate()} disabled={!form.nom || mutation.isPending} className="w-full">
            🚀 Créer la campagne
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
