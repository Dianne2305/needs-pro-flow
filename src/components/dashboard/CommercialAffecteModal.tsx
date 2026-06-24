/**
 * CommercialAffecteModal.tsx
 * Modal de gestion de l'affectation commerciale d'un client/demande.
 * - Affiche le commercial actuellement affecté + commercial créateur + date d'affectation.
 * - Permet de retirer l'affectation, de sélectionner un autre commercial et d'enregistrer.
 * - Trace l'historique des affectations (table client_commercial_historique).
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { UserCog, History, X, Save } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { Tables } from "@/integrations/supabase/types";

type Demande = Tables<"demandes">;

interface Props {
  demande: Demande;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommercialAffecteModal({ demande, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const d = demande as any;
  const currentCommercial: string | null = demande.commercial || null;
  const createur: string | null = d.commercial_createur || null;
  const affecteAt: string | null = d.commercial_affecte_at || null;

  const [selected, setSelected] = useState<string>(currentCommercial || "");
  const [customName, setCustomName] = useState("");
  const [effectuePar, setEffectuePar] = useState("");
  const [note, setNote] = useState("");

  // Liste des commerciaux : distinct depuis demandes.commercial + historique
  const { data: commerciaux = [] } = useQuery({
    queryKey: ["commerciaux_list"],
    queryFn: async () => {
      const [{ data: dem }, { data: hist }] = await Promise.all([
        supabase.from("demandes").select("commercial").not("commercial", "is", null),
        supabase.from("client_commercial_historique").select("nouveau_commercial"),
      ]);
      const set = new Set<string>();
      (dem || []).forEach((r: any) => r.commercial && set.add(r.commercial));
      (hist || []).forEach((r: any) => r.nouveau_commercial && set.add(r.nouveau_commercial));
      return Array.from(set).sort();
    },
  });

  // Historique d'affectation pour cette demande
  const { data: historique = [] } = useQuery({
    queryKey: ["client_commercial_historique", demande.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_commercial_historique")
        .select("*")
        .eq("demande_id", demande.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: async (payload: { nouveau: string | null; action: string }) => {
      const ancien = currentCommercial;
      // 1) Mettre à jour la demande
      const { error: upErr } = await supabase
        .from("demandes")
        .update({
          commercial: payload.nouveau,
          commercial_affecte_at: payload.nouveau ? new Date().toISOString() : null,
          // Premier commercial -> définir le créateur si vide
          commercial_createur: createur || payload.nouveau || null,
        } as any)
        .eq("id", demande.id);
      if (upErr) throw upErr;

      // 2) Insérer dans l'historique
      const { error: hErr } = await supabase.from("client_commercial_historique").insert({
        demande_id: demande.id,
        client_nom: demande.nom,
        ancien_commercial: ancien,
        nouveau_commercial: payload.nouveau,
        action: payload.action,
        effectue_par: effectuePar || null,
        note: note || null,
      } as any);
      if (hErr) throw hErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["demande", demande.id] });
      qc.invalidateQueries({ queryKey: ["demandes"] });
      qc.invalidateQueries({ queryKey: ["client_commercial_historique", demande.id] });
      qc.invalidateQueries({ queryKey: ["commerciaux_list"] });
      toast({ title: "Affectation mise à jour" });
      setNote("");
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const handleSave = () => {
    const nouveau = (selected === "__custom__" ? customName.trim() : selected.trim()) || null;
    if (!nouveau) {
      toast({ title: "Sélectionnez un commercial", variant: "destructive" });
      return;
    }
    if (nouveau === currentCommercial) {
      toast({ title: "Aucun changement", description: "Ce commercial est déjà affecté." });
      return;
    }
    mutation.mutate({
      nouveau,
      action: currentCommercial ? "reaffectation" : "affectation",
    });
  };

  const handleRetirer = () => {
    if (!currentCommercial) return;
    mutation.mutate({ nouveau: null, action: "retrait" });
    setSelected("");
  };

  const actionLabel = (a: string) => {
    switch (a) {
      case "affectation": return { label: "Affectation", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" };
      case "reaffectation": return { label: "Réaffectation", cls: "bg-amber-100 text-amber-800 border-amber-200" };
      case "retrait": return { label: "Retrait", cls: "bg-rose-100 text-rose-800 border-rose-200" };
      case "creation": return { label: "Création", cls: "bg-sky-100 text-sky-800 border-sky-200" };
      default: return { label: a, cls: "bg-muted text-muted-foreground border-border" };
    }
  };

  // Historique trié du plus récent au plus ancien (anti-chronologique)
  const sortedHistorique = useMemo(() => {
    return [...historique].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [historique]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Commercial affecté — {demande.nom}
          </DialogTitle>
          <DialogDescription>
            Gérez l'affectation commerciale du client et consultez l'historique chronologique des changements.
          </DialogDescription>
        </DialogHeader>

        {/* Résumé */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-lg bg-muted/40 border">
          <div>
            <p className="text-xs text-muted-foreground">Commercial actuel</p>
            {currentCommercial ? (
              <Badge className="mt-1 bg-emerald-600 hover:bg-emerald-600">{currentCommercial}</Badge>
            ) : (
              <p className="text-sm font-medium text-muted-foreground mt-1">Non affecté</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Créé par</p>
            <p className="text-sm font-medium mt-1">{createur || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Date d'affectation</p>
            <p className="text-sm font-medium mt-1">
              {affecteAt ? format(new Date(affecteAt), "dd/MM/yyyy HH:mm", { locale: fr }) : "—"}
            </p>
          </div>
        </div>

        <Separator />

        {/* Modifier l'affectation */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Modifier l'affectation</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Sélectionner un commercial</Label>
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                <SelectContent>
                  {commerciaux.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                  <SelectItem value="__custom__">+ Nouveau commercial...</SelectItem>
                </SelectContent>
              </Select>
              {selected === "__custom__" && (
                <Input
                  className="mt-1.5"
                  placeholder="Nom du commercial"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Effectué par (optionnel)</Label>
              <Input
                placeholder="Votre nom"
                value={effectuePar}
                onChange={(e) => setEffectuePar(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Note / Motif (optionnel)</Label>
            <Input
              placeholder="Motif de la réaffectation, contexte..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={handleSave} disabled={mutation.isPending} className="gap-1.5">
              <Save className="h-4 w-4" /> Enregistrer l'affectation
            </Button>
            {currentCommercial && (
              <Button variant="outline" onClick={handleRetirer} disabled={mutation.isPending}
                className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10">
                <X className="h-4 w-4" /> Retirer l'affectation
              </Button>
            )}
          </div>
        </div>

        <Separator />

        {/* Historique chronologique */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <History className="h-4 w-4" /> Historique des affectations
          </h3>
          {sortedHistorique.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center bg-muted/30 rounded-lg border border-dashed">
              Aucun changement enregistré.
            </p>
          ) : (
            <div className="relative pl-5 space-y-3 max-h-72 overflow-y-auto pr-1">
              {/* Ligne verticale de timeline */}
              <div className="absolute left-[11px] top-2 bottom-3 w-px bg-border" />

              {sortedHistorique.map((h: any, idx: number) => {
                const a = actionLabel(h.action);
                const isLast = idx === sortedHistorique.length - 1;
                return (
                  <div key={h.id} className="relative">
                    {/* Point timeline */}
                    <div className="absolute -left-[21px] top-2 h-3 w-3 rounded-full border-2 border-background bg-primary" />

                    <div className="rounded-lg border bg-card p-3 text-sm hover:bg-accent/40 transition-colors">
                      {/* Header : action + date */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <Badge variant="outline" className={`text-[10px] font-semibold ${a.cls}`}>
                          {a.label}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {format(new Date(h.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                        </span>
                      </div>

                      {/* Transition commercial */}
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        <div className="rounded bg-muted/50 px-2.5 py-1.5">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Ancien commercial</p>
                          <p className="font-medium truncate">{h.ancien_commercial || "Non affecté"}</p>
                        </div>
                        <div className="rounded bg-emerald-50/60 px-2.5 py-1.5">
                          <p className="text-[10px] uppercase tracking-wide text-emerald-700">Nouveau commercial</p>
                          <p className="font-medium text-emerald-900 truncate">{h.nouveau_commercial || "Retiré"}</p>
                        </div>
                      </div>

                      {/* Motif / Effectué par */}
                      {(h.effectue_par || h.note) && (
                        <div className="space-y-1 border-t pt-2 mt-1">
                          {h.effectue_par && (
                            <p className="text-xs text-muted-foreground">
                              Effectué par <span className="font-medium text-foreground">{h.effectue_par}</span>
                            </p>
                          )}
                          {h.note && (
                            <div className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">Motif :</span> {h.note}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
