/**
 * FeedbackForm.tsx
 * Formulaire public de feedback client (7 critères) accessible via token.
 */
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Star, CheckCircle2 } from "lucide-react";

export default function FeedbackForm() {
  const { token } = useParams<{ token: string }>();
  const [satisfaction, setSatisfaction] = useState("");
  const [qualiteMenage, setQualiteMenage] = useState("");
  const [professionnel, setProfessionnel] = useState("");
  const [recommandeProfil, setRecommandeProfil] = useState("");
  const [recommandeAgence, setRecommandeAgence] = useState("");
  const [noteAgence, setNoteAgence] = useState(0);
  const [commentaire, setCommentaire] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: feedback, isLoading, error } = useQuery({
    queryKey: ["feedback-form", token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedbacks")
        .select("*")
        .eq("token", token!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const isPositif = satisfaction === "Très satisfait" || satisfaction === "Satisfait";
      const { error } = await supabase
        .from("feedbacks")
        .update({
          satisfaction,
          qualite_menage: qualiteMenage,
          professionnel,
          recommande_profil: recommandeProfil === "oui",
          recommande_agence: recommandeAgence === "oui",
          note_agence: noteAgence,
          commentaire: commentaire.trim() || null,
          statut: isPositif ? "positif" : "negatif",
          submitted_at: new Date().toISOString(),
        })
        .eq("id", feedback!.id);
      if (error) throw error;
    },
    onSuccess: () => setSubmitted(true),
  });

  if (isLoading) return <div className="flex items-center justify-center min-h-screen bg-gray-50"><p>Chargement...</p></div>;
  if (error || !feedback) return <div className="flex items-center justify-center min-h-screen bg-gray-50"><p className="text-red-500">Lien invalide ou expiré.</p></div>;
  if (feedback.submitted_at || submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-center">
        <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Merci pour votre avis !</h1>
        <p className="text-gray-600">Votre retour nous aide à améliorer nos services.</p>
      </div>
    );
  }

  const canSubmit = satisfaction && qualiteMenage && professionnel && recommandeProfil && recommandeAgence && noteAgence > 0;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Votre avis nous intéresse</h1>
          <p className="text-gray-500 text-sm">
            Merci d'avoir fait appel à nos services. Votre retour est précieux.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-8">
          {/* Q1 */}
          <div>
            <p className="font-medium text-gray-700 mb-3">1. Êtes-vous satisfait de la prestation ?</p>
            <RadioGroup value={satisfaction} onValueChange={setSatisfaction} className="space-y-2">
              {["Très satisfait", "Satisfait", "Moyennement satisfait", "Pas satisfait"].map((opt) => (
                <div key={opt} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                  <RadioGroupItem value={opt} id={`sat-${opt}`} />
                  <Label htmlFor={`sat-${opt}`} className="cursor-pointer">{opt}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Q2 */}
          <div>
            <p className="font-medium text-gray-700 mb-3">2. La qualité du ménage était-elle à la hauteur ?</p>
            <RadioGroup value={qualiteMenage} onValueChange={setQualiteMenage} className="space-y-2">
              {["Oui", "Moyennement", "Non"].map((opt) => (
                <div key={opt} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                  <RadioGroupItem value={opt} id={`q-${opt}`} />
                  <Label htmlFor={`q-${opt}`} className="cursor-pointer">{opt}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Q3 */}
          <div>
            <p className="font-medium text-gray-700 mb-3">3. Le profil intervenant était-il professionnel ?</p>
            <RadioGroup value={professionnel} onValueChange={setProfessionnel} className="space-y-2">
              {["Oui", "Moyennement", "Non"].map((opt) => (
                <div key={opt} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                  <RadioGroupItem value={opt} id={`p-${opt}`} />
                  <Label htmlFor={`p-${opt}`} className="cursor-pointer">{opt}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Q4 */}
          <div>
            <p className="font-medium text-gray-700 mb-3">4. Recommanderiez-vous cette personne ?</p>
            <RadioGroup value={recommandeProfil} onValueChange={setRecommandeProfil} className="space-y-2">
              {[{ v: "oui", l: "Oui" }, { v: "non", l: "Non" }].map((opt) => (
                <div key={opt.v} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                  <RadioGroupItem value={opt.v} id={`rp-${opt.v}`} />
                  <Label htmlFor={`rp-${opt.v}`} className="cursor-pointer">{opt.l}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Q5 */}
          <div>
            <p className="font-medium text-gray-700 mb-3">5. Recommanderiez-vous notre agence ?</p>
            <RadioGroup value={recommandeAgence} onValueChange={setRecommandeAgence} className="space-y-2">
              {[{ v: "oui", l: "Oui" }, { v: "non", l: "Non" }].map((opt) => (
                <div key={opt.v} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                  <RadioGroupItem value={opt.v} id={`ra-${opt.v}`} />
                  <Label htmlFor={`ra-${opt.v}`} className="cursor-pointer">{opt.l}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Q6 - Stars */}
          <div>
            <p className="font-medium text-gray-700 mb-3">6. Comment évaluez-vous l'agence ?</p>
            <div className="flex gap-2 justify-center py-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setNoteAgence(n)} className="focus:outline-none transition-transform hover:scale-110">
                  <Star className={`h-10 w-10 ${n <= noteAgence ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                </button>
              ))}
            </div>
          </div>

          {/* Q7 - Comment */}
          <div>
            <p className="font-medium text-gray-700 mb-3">7. Votre commentaire</p>
            <Textarea
              placeholder="Donnez votre avis ou vos remarques..."
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              rows={4}
            />
          </div>

          <Button
            onClick={() => submitMutation.mutate()}
            disabled={!canSubmit || submitMutation.isPending}
            className="w-full h-12 text-base font-semibold"
          >
            {submitMutation.isPending ? "Envoi..." : "Envoyer mon avis"}
          </Button>
        </div>
      </div>
    </div>
  );
}
