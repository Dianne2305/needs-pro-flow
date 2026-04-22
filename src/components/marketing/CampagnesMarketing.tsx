/**
 * CampagnesMarketing.tsx
 * Tableau des campagnes marketing avec filtres et actions.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Send, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { STATUT_CAMPAGNE_COLORS, CANAUX_CAMPAGNE, CIBLES_CAMPAGNE } from "@/lib/marketing-constants";
import { CreateCampagneModal } from "./CreateCampagneModal";

export function CampagnesMarketing() {
  const [showModal, setShowModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: campagnes = [], isLoading } = useQuery({
    queryKey: ["campagnes_marketing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campagnes_marketing")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campagnes_marketing").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campagnes_marketing"] });
      toast.success("Campagne supprimée");
    },
  });

  const markSent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campagnes_marketing").update({ statut: "envoyee", date_envoi: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campagnes_marketing"] });
      toast.success("Campagne marquée comme envoyée");
    },
  });

  const getCibleLabel = (val: string) => CIBLES_CAMPAGNE.find((c) => c.value === val)?.label || val;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Campagnes marketing</h3>
        <Button onClick={() => setShowModal(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Créer une campagne
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Titre</TableHead>
              <TableHead>Cible</TableHead>
              <TableHead>Segment</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Ville</TableHead>
              <TableHead>Date diffusion</TableHead>
              <TableHead>Dest./jour</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-28">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
            ) : campagnes.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Aucune campagne</TableCell></TableRow>
            ) : (
              campagnes.map((c: any) => {
                const statutInfo = STATUT_CAMPAGNE_COLORS[c.statut] || STATUT_CAMPAGNE_COLORS.brouillon;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs">{format(new Date(c.created_at), "dd/MM/yyyy", { locale: fr })}</TableCell>
                    <TableCell className="font-medium">{c.nom}</TableCell>
                    <TableCell>{getCibleLabel(c.cible || "client")}</TableCell>
                    <TableCell>{c.segment_cible || "—"}</TableCell>
                    <TableCell className="text-xs">{c.canal}</TableCell>
                    <TableCell>{c.ville_ciblage || "—"}</TableCell>
                    <TableCell className="text-xs">
                      {c.date_diffusion ? format(new Date(c.date_diffusion), "dd/MM/yyyy", { locale: fr }) : "—"}
                    </TableCell>
                    <TableCell>{c.nombre_destinataires_jour || c.nombre_destinataires || 0}</TableCell>
                    <TableCell>
                      <Badge className={statutInfo.color}>{statutInfo.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => toast.info("Modification à venir")}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {c.statut !== "envoyee" && (
                          <Button variant="ghost" size="icon" onClick={() => markSent.mutate(c.id)} title="Marquer envoyée">
                            <Send className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(c.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <CreateCampagneModal open={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}
