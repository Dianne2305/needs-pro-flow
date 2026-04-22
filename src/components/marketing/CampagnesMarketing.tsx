/**
 * CampagnesMarketing.tsx
 * Tableau des campagnes marketing avec filtres, archivage et actions.
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Send, Pencil, Archive, ArchiveRestore, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { STATUT_CAMPAGNE_COLORS, CIBLES_CAMPAGNE } from "@/lib/marketing-constants";
import { CreateCampagneModal } from "./CreateCampagneModal";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export function CampagnesMarketing() {
  const [showModal, setShowModal] = useState(false);
  const [filterCible, setFilterCible] = useState("tous");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const queryClient = useQueryClient();

  const { data: allCampagnes = [], isLoading } = useQuery({
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

  const archivedCampagnes = useMemo(() => allCampagnes.filter((c: any) => c.archivee === true), [allCampagnes]);
  const activeCampagnes = useMemo(() => allCampagnes.filter((c: any) => !c.archivee), [allCampagnes]);

  const filteredCampagnes = useMemo(() => {
    return activeCampagnes.filter((c: any) => {
      if (filterCible !== "tous" && (c.cible || "client") !== filterCible) return false;
      if (dateFrom && new Date(c.created_at) < new Date(dateFrom)) return false;
      if (dateTo && new Date(c.created_at) > new Date(dateTo + "T23:59:59")) return false;
      return true;
    });
  }, [activeCampagnes, filterCible, dateFrom, dateTo]);

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

  const archiveMutation = useMutation({
    mutationFn: async ({ id, archivee }: { id: string; archivee: boolean }) => {
      const { error } = await supabase.from("campagnes_marketing").update({ archivee }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["campagnes_marketing"] });
      toast.success(vars.archivee ? "Campagne archivée" : "Campagne restaurée");
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

  const tableHeaders = (
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
  );

  const renderRow = (c: any, isArchive = false) => {
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
            {!isArchive && (
              <Button variant="ghost" size="icon" onClick={() => toast.info("Modification à venir")}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {!isArchive && c.statut !== "envoyee" && (
              <Button variant="ghost" size="icon" onClick={() => markSent.mutate(c.id)} title="Marquer envoyée">
                <Send className="h-4 w-4 text-primary" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => archiveMutation.mutate({ id: c.id, archivee: !isArchive })}>
              {isArchive ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(c.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-4">
      {/* Archivés */}
      {archivedCampagnes.length > 0 && (
        <Collapsible open={showArchived} onOpenChange={setShowArchived}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span>📦 Archivées ({archivedCampagnes.length})</span>
              {showArchived ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="rounded-md border mt-2">
              <Table>
                <TableHeader>{tableHeaders}</TableHeader>
                <TableBody>
                  {archivedCampagnes.map((c: any) => renderRow(c, true))}
                </TableBody>
              </Table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Header + filters */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h3 className="text-lg font-semibold">Campagnes marketing</h3>
        <Button onClick={() => setShowModal(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Créer une campagne
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={filterCible} onValueChange={setFilterCible}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Toutes les cibles</SelectItem>
            {CIBLES_CAMPAGNE.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
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
            ) : filteredCampagnes.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Aucune campagne</TableCell></TableRow>
            ) : (
              filteredCampagnes.map((c: any) => renderRow(c))
            )}
          </TableBody>
        </Table>
      </div>

      <CreateCampagneModal open={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}
