import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Search, Send, ArrowLeft, Eye, User, MapPin, Calendar, Phone } from "lucide-react";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profil: any;
}

export function PostulerModal({ open, onOpenChange, profil }: Props) {
  const [search, setSearch] = useState("");
  const [selectedDemande, setSelectedDemande] = useState<any>(null);
  const [step, setStep] = useState<"list" | "preview">("list");
  const [sending, setSending] = useState(false);

  const { data: demandes = [] } = useQuery({
    queryKey: ["demandes_en_cours"],
    queryFn: async () => {
      const { data } = await supabase
        .from("demandes")
        .select("*")
        .in("statut", ["en_attente", "confirmee"])
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: open,
  });

  const filtered = demandes.filter((d: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return d.nom?.toLowerCase().includes(s) || d.type_service?.toLowerCase().includes(s) || String(d.num_demande).includes(s);
  });

  const handleSend = async () => {
    if (!selectedDemande || !profil) return;
    setSending(true);
    try {
      const { error } = await supabase.from("demandes").update({
        candidat_nom: `${profil.prenom} ${profil.nom}`,
        candidat_telephone: profil.telephone,
        candidat_photo_url: profil.photo_url,
        statut_candidature: "envoye",
      }).eq("id", selectedDemande.id);
      if (error) throw error;

      // Log in history
      await supabase.from("profil_historique").insert({
        profil_id: profil.id,
        action: `Profil envoyé pour la demande #${selectedDemande.num_demande} — ${selectedDemande.nom}`,
        utilisateur: "Opérateur",
      });

      toast({ title: "Profil envoyé avec succès", description: `Demande #${selectedDemande.num_demande}` });
      onOpenChange(false);
      setStep("list");
      setSelectedDemande(null);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setStep("list");
    setSelectedDemande(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-lg font-bold">
            {step === "list" ? "Postuler — Choisir une demande" : "Aperçu avant envoi"}
          </DialogTitle>
        </DialogHeader>

        {step === "list" && (
          <div className="px-6 pb-6 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher par nom, service, numéro..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <ScrollArea className="max-h-[55vh]">
              <div className="space-y-2">
                {filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Aucune demande en cours</p>
                ) : filtered.map((d: any) => (
                  <div
                    key={d.id}
                    onClick={() => { setSelectedDemande(d); setStep("preview"); }}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 cursor-pointer transition-colors"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">#{d.num_demande}</span>
                        <span className="font-medium text-sm">{d.nom}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{d.type_service}</span>
                        <span>•</span>
                        <span>{d.ville}</span>
                        {d.date_prestation && (
                          <>
                            <span>•</span>
                            <span>{format(new Date(d.date_prestation), "dd/MM/yyyy")}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {d.statut === "en_attente" ? "En attente" : "Confirmée"}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {step === "preview" && selectedDemande && (
          <div className="px-6 pb-6 space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setStep("list")} className="gap-1.5 -ml-2">
              <ArrowLeft className="h-4 w-4" /> Retour à la liste
            </Button>

            {/* Demande info */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Demande sélectionnée</p>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs">#{selectedDemande.num_demande}</span>
                <span className="font-semibold">{selectedDemande.nom}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{selectedDemande.type_service}</span>
                <span>•</span>
                <span>{selectedDemande.ville}</span>
              </div>
            </div>

            <Separator />

            {/* Profil preview */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Profil à envoyer</p>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={profil.photo_url || ""} />
                  <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xl">
                    {profil.prenom?.charAt(0)}{profil.nom?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold text-lg">{profil.prenom} {profil.nom}</p>
                  <p className="text-sm text-muted-foreground">{profil.type_profil || "Non défini"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />{profil.telephone || "—"}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />{profil.quartier || profil.ville || "—"}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  {profil.experience_annees || 0} an(s) {profil.experience_mois || 0} mois d'expérience
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-3.5 w-3.5" />{profil.nationalite || "—"}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep("list")}>Annuler</Button>
              <Button onClick={handleSend} disabled={sending} className="gap-1.5">
                <Send className="h-4 w-4" /> Envoyer le profil
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
