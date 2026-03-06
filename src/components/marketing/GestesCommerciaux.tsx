import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { TYPES_GESTE } from "@/lib/marketing-constants";
import { CreateGesteModal } from "./CreateGesteModal";

export function GestesCommerciaux() {
  const [showModal, setShowModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: gestes = [], isLoading } = useQuery({
    queryKey: ["gestes_commerciaux"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gestes_commerciaux")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gestes_commerciaux").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gestes_commerciaux"] });
      toast.success("Geste supprimé");
    },
  });

  const getTypeLabel = (val: string) => TYPES_GESTE.find((t) => t.value === val)?.label || val;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Gestes commerciaux</h3>
        <Button onClick={() => setShowModal(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Créer un geste commercial
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Raison</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Créé par</TableHead>
              <TableHead className="w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
            ) : gestes.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun geste commercial</TableCell></TableRow>
            ) : (
              gestes.map((g: any) => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">{g.client_nom}</TableCell>
                  <TableCell>{getTypeLabel(g.type_geste)}</TableCell>
                  <TableCell>
                    {g.pourcentage ? `-${g.pourcentage}%` : g.montant ? `${g.montant} MAD` : "—"}
                  </TableCell>
                  <TableCell className="max-w-48 truncate">{g.raison || "—"}</TableCell>
                  <TableCell className="text-xs">{format(new Date(g.created_at), "dd/MM/yyyy", { locale: fr })}</TableCell>
                  <TableCell>{g.cree_par || "—"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(g.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CreateGesteModal open={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}
