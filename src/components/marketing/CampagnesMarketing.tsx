import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { STATUT_CAMPAGNE_COLORS, SEGMENTS_CLIENT, CANAUX_CAMPAGNE } from "@/lib/marketing-constants";
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

  const getSegmentLabel = (val: string) => SEGMENTS_CLIENT.find((s) => s.value === val)?.label || val;
  const getCanalLabel = (val: string) => CANAUX_CAMPAGNE.find((c) => c.value === val)?.label || val;

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
              <TableHead>Nom</TableHead>
              <TableHead>Segment</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Destinataires</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
            ) : campagnes.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucune campagne</TableCell></TableRow>
            ) : (
              campagnes.map((c: any) => {
                const statutInfo = STATUT_CAMPAGNE_COLORS[c.statut] || STATUT_CAMPAGNE_COLORS.brouillon;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nom}</TableCell>
                    <TableCell>{getSegmentLabel(c.segment_cible)}</TableCell>
                    <TableCell>{getCanalLabel(c.canal)}</TableCell>
                    <TableCell>{c.nombre_destinataires}</TableCell>
                    <TableCell>
                      <Badge className={statutInfo.color}>{statutInfo.label}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.date_envoi ? format(new Date(c.date_envoi), "dd/MM/yyyy", { locale: fr }) : "—"}
                    </TableCell>
                    <TableCell className="flex gap-1">
                      {c.statut !== "envoyee" && (
                        <Button variant="ghost" size="icon" onClick={() => markSent.mutate(c.id)} title="Marquer envoyée">
                          <Send className="h-4 w-4 text-primary" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
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
