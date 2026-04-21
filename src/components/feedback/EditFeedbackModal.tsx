/**
 * EditFeedbackModal.tsx
 * Modal d'édition d'un feedback : infos client (avant soumission) ou retour client (après soumission).
 */
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

/**
 * Props du modal d'édition de feedback.
 * @property feedback - Feedback à éditer (row Supabase `feedbacks`), null = fermé.
 * @property onClose  - Callback de fermeture.
 */
interface Props {
  feedback: any | null;
  onClose: () => void;
}

const SATISFACTION_OPTIONS = [
  "Très satisfait",
  "Satisfait",
  "Moyen",
  "Pas satisfait",
];

const QUALITE_OPTIONS = [
  "Excellent",
  "Bien",
  "Moyen",
  "Insuffisant",
];

/**
 * Modal permettant de modifier un feedback existant :
 * - Avant soumission : nom client, téléphone, ville, service, profil, date.
 * - Après soumission : satisfaction, qualité, note agence, commentaire.
 */
export function EditFeedbackModal({ feedback, onClose }: Props) {
  const queryClient = useQueryClient();
  const isSubmitted = !!feedback?.submitted_at;

  const [form, setForm] = useState({
    nom_client: "",
    telephone_client: "",
    ville: "",
    type_service: "",
    profil_nom: "",
    date_prestation: "",
    satisfaction: "",
    qualite_menage: "",
    professionnel: "",
    note_agence: "",
    commentaire: "",
  });

  /** Pré-remplir le formulaire avec les données du feedback */
  useEffect(() => {
    if (feedback) {
      setForm({
        nom_client: feedback.nom_client || "",
        telephone_client: feedback.telephone_client || "",
        ville: feedback.ville || "",
        type_service: feedback.type_service || "",
        profil_nom: feedback.profil_nom || "",
        date_prestation: feedback.date_prestation || "",
        satisfaction: feedback.satisfaction || "",
        qualite_menage: feedback.qualite_menage || "",
        professionnel: feedback.professionnel || "",
        note_agence: feedback.note_agence ? String(feedback.note_agence) : "",
        commentaire: feedback.commentaire || "",
      });
    }
  }, [feedback]);

  const mutation = useMutation({
    mutationFn: async () => {
      const updates: Record<string, any> = {};

      if (!isSubmitted) {
        // Édition des infos avant soumission
        updates.nom_client = form.nom_client;
        updates.telephone_client = form.telephone_client || null;
        updates.ville = form.ville || null;
        updates.type_service = form.type_service || null;
        updates.profil_nom = form.profil_nom || null;
        updates.date_prestation = form.date_prestation || null;
      } else {
        // Édition des réponses après soumission
        updates.satisfaction = form.satisfaction || null;
        updates.qualite_menage = form.qualite_menage || null;
        updates.professionnel = form.professionnel || null;
        updates.note_agence = form.note_agence ? Number(form.note_agence) : null;
        updates.commentaire = form.commentaire || null;
      }

      const { error } = await supabase
        .from("feedbacks")
        .update(updates)
        .eq("id", feedback?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedbacks"] });
      toast({ title: "Feedback modifié avec succès" });
      onClose();
    },
    onError: () => toast({ title: "Erreur lors de la modification", variant: "destructive" }),
  });

  return (
    <Dialog open={!!feedback} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le feedback — {feedback?.nom_client}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!isSubmitted ? (
            <>
              <div>
                <Label>Nom client</Label>
                <Input value={form.nom_client} onChange={(e) => setForm({ ...form, nom_client: e.target.value })} />
              </div>
              <div>
                <Label>Téléphone</Label>
                <Input value={form.telephone_client} onChange={(e) => setForm({ ...form, telephone_client: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ville</Label>
                  <Input value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} />
                </div>
                <div>
                  <Label>Service</Label>
                  <Input value={form.type_service} onChange={(e) => setForm({ ...form, type_service: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Profil</Label>
                  <Input value={form.profil_nom} onChange={(e) => setForm({ ...form, profil_nom: e.target.value })} />
                </div>
                <div>
                  <Label>Date prestation</Label>
                  <Input type="date" value={form.date_prestation} onChange={(e) => setForm({ ...form, date_prestation: e.target.value })} />
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <Label>Satisfaction</Label>
                <Select value={form.satisfaction} onValueChange={(v) => setForm({ ...form, satisfaction: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {SATISFACTION_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Qualité ménage</Label>
                <Select value={form.qualite_menage} onValueChange={(v) => setForm({ ...form, qualite_menage: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {QUALITE_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Professionnel</Label>
                <Select value={form.professionnel} onValueChange={(v) => setForm({ ...form, professionnel: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {QUALITE_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Note agence (1-5)</Label>
                <Input type="number" min="1" max="5" value={form.note_agence} onChange={(e) => setForm({ ...form, note_agence: e.target.value })} />
              </div>
              <div>
                <Label>Commentaire</Label>
                <Textarea value={form.commentaire} onChange={(e) => setForm({ ...form, commentaire: e.target.value })} rows={3} />
              </div>
            </>
          )}
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="w-full">
            ✅ Enregistrer les modifications
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
