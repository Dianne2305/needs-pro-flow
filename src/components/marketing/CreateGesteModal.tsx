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
import { TYPES_GESTE } from "@/lib/marketing-constants";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateGesteModal({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    client_nom: "",
    client_telephone: "",
    type_geste: "reduction_prochaine",
    montant: "",
    pourcentage: "",
    raison: "",
    commentaire: "",
    cree_par: "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("gestes_commerciaux").insert({
        client_nom: form.client_nom,
        client_telephone: form.client_telephone || null,
        type_geste: form.type_geste,
        montant: form.montant ? Number(form.montant) : null,
        pourcentage: form.pourcentage ? Number(form.pourcentage) : null,
        raison: form.raison || null,
        commentaire: form.commentaire || null,
        cree_par: form.cree_par || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gestes_commerciaux"] });
      toast.success("Geste commercial créé !");
      onClose();
      setForm({ client_nom: "", client_telephone: "", type_geste: "reduction_prochaine", montant: "", pourcentage: "", raison: "", commentaire: "", cree_par: "" });
    },
    onError: () => toast.error("Erreur lors de la création"),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer un geste commercial</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Client concerné</Label>
            <Input placeholder="Nom du client" value={form.client_nom} onChange={(e) => setForm({ ...form, client_nom: e.target.value })} />
          </div>
          <div>
            <Label>Téléphone client</Label>
            <Input placeholder="06..." value={form.client_telephone} onChange={(e) => setForm({ ...form, client_telephone: e.target.value })} />
          </div>
          <div>
            <Label>Type de geste</Label>
            <Select value={form.type_geste} onValueChange={(v) => setForm({ ...form, type_geste: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES_GESTE.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Montant (MAD)</Label>
              <Input type="number" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} />
            </div>
            <div>
              <Label>Pourcentage (%)</Label>
              <Input type="number" value={form.pourcentage} onChange={(e) => setForm({ ...form, pourcentage: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Raison</Label>
            <Input placeholder="ex: Client mécontent, retard intervention..." value={form.raison} onChange={(e) => setForm({ ...form, raison: e.target.value })} />
          </div>
          <div>
            <Label>Commentaire</Label>
            <Textarea placeholder="Détails supplémentaires..." value={form.commentaire} onChange={(e) => setForm({ ...form, commentaire: e.target.value })} />
          </div>
          <div>
            <Label>Créé par</Label>
            <Input placeholder="Nom de l'opérateur" value={form.cree_par} onChange={(e) => setForm({ ...form, cree_par: e.target.value })} />
          </div>
          <Button onClick={() => mutation.mutate()} disabled={!form.client_nom || !form.type_geste || mutation.isPending} className="w-full">
            ✅ Créer le geste commercial
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
