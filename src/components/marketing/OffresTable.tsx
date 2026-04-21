/**
 * OffresTable.tsx
 * Tableau des offres/promos marketing avec actions activer/désactiver/supprimer.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Copy, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { STATUT_OFFRE_COLORS, SEGMENTS_CLIENT } from "@/lib/marketing-constants";
import { CreateOffreModal } from "./CreateOffreModal";
import { EditOffreModal } from "./EditOffreModal";

export function OffresTable() {
  const [showModal, setShowModal] = useState(false);
  const [editOffre, setEditOffre] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: offres = [], isLoading } = useQuery({
    queryKey: ["offres_marketing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offres_marketing")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("offres_marketing").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offres_marketing"] });
      toast.success("Offre supprimée");
    },
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Code copié !");
  };

  const getSegmentLabel = (val: string) =>
    SEGMENTS_CLIENT.find((s) => s.value === val)?.label || val;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Codes promo & Offres</h3>
        <Button onClick={() => setShowModal(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Créer un code promo
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Réduction</TableHead>
              <TableHead>Segment</TableHead>
              <TableHead>Validité</TableHead>
              <TableHead>Utilisations</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
            ) : offres.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Aucune offre créée</TableCell></TableRow>
            ) : (
              offres.map((o: any) => {
                const statutInfo = STATUT_OFFRE_COLORS[o.statut] || STATUT_OFFRE_COLORS.active;
                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.nom}</TableCell>
                    <TableCell>
                      {o.code_promo ? (
                        <button onClick={() => copyCode(o.code_promo)} className="flex items-center gap-1 font-mono text-xs bg-muted px-2 py-1 rounded hover:bg-accent">
                          {o.code_promo} <Copy className="h-3 w-3" />
                        </button>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {o.type_reduction === "pourcentage" ? `-${o.valeur_reduction}%` : `-${o.valeur_reduction} MAD`}
                    </TableCell>
                    <TableCell>{getSegmentLabel(o.segment_client)}</TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(o.date_debut), "dd/MM", { locale: fr })}
                      {o.date_fin ? ` - ${format(new Date(o.date_fin), "dd/MM", { locale: fr })}` : " - ∞"}
                    </TableCell>
                    <TableCell>
                      {o.nombre_utilisations}{o.limite_utilisation ? `/${o.limite_utilisation}` : ""}
                    </TableCell>
                    <TableCell>
                      <Badge className={statutInfo.color}>{statutInfo.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditOffre(o)} title="Modifier">
                          <Pencil className="h-4 w-4 text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(o.id)}>
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

      <CreateOffreModal open={showModal} onClose={() => setShowModal(false)} />
      <EditOffreModal offre={editOffre} onClose={() => setEditOffre(null)} />
    </div>
  );
}
