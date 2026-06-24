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
      case "affectation": return { label: "Affectation", cls: "bg-emerald-100 text-emerald-800" };
      case "reaffectation": return { label: "Réaffectation", cls: "bg-amber-100 text-amber-800" };
      case "retrait": return { label: "Retrait", cls: "bg-rose-100 text-rose-800" };
      case "creation": return { label: "Création", cls: "bg-sky-100 text-sky-800" };
      default: return { label: a, cls: "bg-muted text-muted-foreground" };
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Commercial affecté — {demande.nom}
          </DialogTitle>
          <DialogDescription>
            Gérez l'affectation commerciale du client et consultez l'historique des changements.
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
            <Label>Note (optionnel)</Label>
            <Input
              placeholder="Motif du changement..."
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

        {/* Historique */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <History className="h-4 w-4" /> Historique des affectations
          </h3>
          {historique.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">Aucun changement enregistré.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {historique.map((h: any) => {
                const a = actionLabel(h.action);
                return (
                  <div key={h.id} className="p-2.5 rounded-md border bg-card text-sm">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] ${a.cls} border-0`}>{a.label}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {h.ancien_commercial || "—"} → <strong className="text-foreground">{h.nouveau_commercial || "—"}</strong>
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {format(new Date(h.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                      </span>
                    </div>
                    {(h.effectue_par || h.note) && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {h.effectue_par && <span>Par <strong>{h.effectue_par}</strong></span>}
                        {h.effectue_par && h.note && " — "}
                        {h.note}
                      </p>
                    )}
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
