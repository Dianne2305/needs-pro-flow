/**
 * GestesCommerciaux.tsx
 * Tableau des gestes commerciaux avec filtres, archivage et actions.
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, Archive, ArchiveRestore, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { TYPES_GESTE, STATUT_GESTE_COLORS } from "@/lib/marketing-constants";
import { CreateGesteModal } from "./CreateGesteModal";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export function GestesCommerciaux() {
  const [showModal, setShowModal] = useState(false);
  const [filterCommercial, setFilterCommercial] = useState("");
  const [filterType, setFilterType] = useState("tous");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const queryClient = useQueryClient();

  const { data: allGestes = [], isLoading } = useQuery({
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

  const archivedGestes = useMemo(() => allGestes.filter((g: any) => g.archivee === true), [allGestes]);
  const activeGestes = useMemo(() => allGestes.filter((g: any) => !g.archivee), [allGestes]);

  const filteredGestes = useMemo(() => {
    return activeGestes.filter((g: any) => {
      if (filterCommercial && !(g.cree_par || "").toLowerCase().includes(filterCommercial.toLowerCase())) return false;
      if (filterType !== "tous" && g.type_geste !== filterType) return false;
      if (dateFrom && new Date(g.created_at) < new Date(dateFrom)) return false;
      if (dateTo && new Date(g.created_at) > new Date(dateTo + "T23:59:59")) return false;
      return true;
    });
  }, [activeGestes, filterCommercial, filterType, dateFrom, dateTo]);

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

  const archiveMutation = useMutation({
    mutationFn: async ({ id, archivee }: { id: string; archivee: boolean }) => {
      const { error } = await supabase.from("gestes_commerciaux").update({ archivee }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["gestes_commerciaux"] });
      toast.success(vars.archivee ? "Geste archivé" : "Geste restauré");
    },
  });

  const getTypeLabel = (val: string) => TYPES_GESTE.find((t) => t.value === val)?.label || val;

  const renderRow = (g: any, isArchive = false) => (
    <TableRow key={g.id}>
      <TableCell className="text-xs">{format(new Date(g.created_at), "dd/MM/yyyy", { locale: fr })}</TableCell>
      <TableCell>{g.cree_par || g.commercial || "—"}</TableCell>
      <TableCell className="font-medium">{g.client_nom}</TableCell>
      <TableCell>{getTypeLabel(g.type_geste)}</TableCell>
      <TableCell>
        {g.reduction_type === "pourcentage"
          ? `${g.reduction_valeur || g.pourcentage || 0}%`
          : `${g.reduction_valeur || g.montant || 0} MAD`}
      </TableCell>
      <TableCell className="font-medium">{g.total_a_payer != null ? `${g.total_a_payer} MAD` : "—"}</TableCell>
      <TableCell>{g.part_agence != null ? `${g.part_agence} MAD` : "—"}</TableCell>
      <TableCell>{g.part_profil != null ? `${g.part_profil} MAD` : "—"}</TableCell>
      <TableCell>
        {(() => {
          const s = STATUT_GESTE_COLORS[g.statut_geste];
          return s ? <Badge className={s.color}>{s.label}</Badge> : <span>{g.statut_geste || "—"}</span>;
        })()}
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          {!isArchive && (
            <Button variant="ghost" size="icon" onClick={() => toast.info("Modification à venir")}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => archiveMutation.mutate({ id: g.id, archivee: !isArchive })}>
            {isArchive ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(g.id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );

  const tableHeaders = (
    <TableRow>
      <TableHead>Date</TableHead>
      <TableHead>Commercial</TableHead>
      <TableHead>Client</TableHead>
      <TableHead>Type geste</TableHead>
      <TableHead>Réduction</TableHead>
      <TableHead>Net à payer</TableHead>
      <TableHead>Part agence</TableHead>
      <TableHead>Part profil</TableHead>
      <TableHead>Statut</TableHead>
      <TableHead className="w-28">Actions</TableHead>
    </TableRow>
  );

  return (
    <div className="space-y-4">
      {/* Archivés */}
      {archivedGestes.length > 0 && (
        <Collapsible open={showArchived} onOpenChange={setShowArchived}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span>📦 Archivés ({archivedGestes.length})</span>
              {showArchived ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="rounded-md border mt-2">
              <Table>
                <TableHeader>{tableHeaders}</TableHeader>
                <TableBody>
                  {archivedGestes.map((g: any) => renderRow(g, true))}
                </TableBody>
              </Table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Header + filters */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h3 className="text-lg font-semibold">Gestes commerciaux</h3>
        <Button onClick={() => setShowModal(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Créer un geste commercial
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input placeholder="Filtrer par commercial..." className="max-w-[200px]" value={filterCommercial} onChange={(e) => setFilterCommercial(e.target.value)} />
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous les types</SelectItem>
            {TYPES_GESTE.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Input type="date" className="w-[140px]" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <span className="text-sm">→</span>
          <Input type="date" className="w-[140px]" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      {/* Main table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>{tableHeaders}</TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
            ) : filteredGestes.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Aucun geste commercial</TableCell></TableRow>
            ) : (
              filteredGestes.map((g: any) => renderRow(g))
            )}
          </TableBody>
        </Table>
      </div>

      <CreateGesteModal open={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}
