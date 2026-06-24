/**
 * OffresTable.tsx
 * Tableau des codes promo selon CDC v1 :
 * - Barre de progression du quota (M-05).
 * - Workflow statuts Brouillon / Actif / Suspendu / Épuisé / Expiré / Archivé (M-09).
 * - Actions : Détails, Modifier, Dupliquer (M-10), Suspendre/Réactiver, Archiver, Supprimer.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Trash2, Copy, Pencil, Archive, ArchiveRestore,
  ChevronDown, ChevronRight, Eye, PauseCircle, PlayCircle, Files,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { STATUT_OFFRE_COLORS, SEGMENTS_CLIENT, STATUTS_CLIENT, STATUTS_CODE_PROMO } from "@/lib/marketing-constants";
import { CreateOffreModal } from "./CreateOffreModal";
import { EditOffreModal } from "./EditOffreModal";
import { OffrePromoDetailModal } from "./OffrePromoDetailModal";
import { rowToForm, PromoFormState } from "./PromoCodeForm";

/** Calcule le statut effectif (auto épuisé/expiré) sans toucher au statut stocké. */
function effectiveStatut(o: any): string {
  if (o.archivee) return "archive";
  if (o.statut === "archive" || o.statut === "suspendu" || o.statut === "brouillon") return o.statut;
  if (o.date_fin && new Date(o.date_fin) < new Date(new Date().toDateString())) return "expiree";
  if (o.limite_utilisation && o.nombre_utilisations >= o.limite_utilisation) return "epuise";
  return o.statut || "active";
}

export function OffresTable() {
  const [showModal, setShowModal] = useState(false);
  const [createVariant, setCreateVariant] = useState<"simple" | "bd">("bd");
  const [initialDuplicate, setInitialDuplicate] = useState<Partial<PromoFormState> | null>(null);
  const [editOffre, setEditOffre] = useState<any>(null);
  const [detailOffre, setDetailOffre] = useState<any>(null);
  const [showArchived, setShowArchived] = useState(false);
  const queryClient = useQueryClient();

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterSegment, setFilterSegment] = useState("tous");
  const [filterStatut, setFilterStatut] = useState("tous");

  const { data: allOffres = [], isLoading } = useQuery({
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

  // Auto-bascule en BDD vers 'epuise' / 'expiree' quand applicable
  useEffect(() => {
    (async () => {
      for (const o of allOffres as any[]) {
        if (o.archivee) continue;
        if (o.statut === "active") {
          const eff = effectiveStatut(o);
          if (eff === "epuise" || eff === "expiree") {
            await supabase.from("offres_marketing").update({ statut: eff } as any).eq("id", o.id);
          }
        }
      }
    })();
  }, [allOffres]);

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

  const archiveMutation = useMutation({
    mutationFn: async ({ id, archivee }: { id: string; archivee: boolean }) => {
      const { error } = await supabase.from("offres_marketing").update({ archivee } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["offres_marketing"] });
      toast.success(vars.archivee ? "Offre archivée" : "Offre restaurée");
    },
  });

  const statutMutation = useMutation({
    mutationFn: async ({ id, statut }: { id: string; statut: string }) => {
      const { error } = await supabase.from("offres_marketing").update({ statut } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["offres_marketing"] }),
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Code copié !");
  };

  const handleDuplicate = (o: any) => {
    const base = rowToForm(o);
    setInitialDuplicate({ ...base, code_promo: "", nom: `${base.nom} (copie)` });
    setCreateVariant("bd");
    setShowModal(true);
  };

  const getSegmentLabel = (val: string) => SEGMENTS_CLIENT.find((s) => s.value === val)?.label || val;
  const getStatutClientLabel = (val: string) => STATUTS_CLIENT.find((s) => s.value === val)?.label || val;

  const archivedOffres = (allOffres as any[]).filter((o) => o.archivee === true);
  const activeOffres = (allOffres as any[]).filter((o) => !o.archivee);

  const filteredOffres = activeOffres.filter((o) => {
    const eff = effectiveStatut(o);
    if (filterSegment !== "tous" && o.segment_client !== filterSegment) return false;
    if (filterStatut !== "tous" && eff !== filterStatut) return false;
    if (dateFrom && new Date(o.created_at) < new Date(dateFrom)) return false;
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59);
      if (new Date(o.created_at) > to) return false;
    }
    return true;
  });

  const renderUsageBar = (o: any) => {
    const used = o.nombre_utilisations || 0;
    if (!o.limite_utilisation) {
      return <div className="text-xs text-muted-foreground">{used} utilisation{used > 1 ? "s" : ""} (illimité)</div>;
    }
    const pct = Math.min(100, Math.round((used / o.limite_utilisation) * 100));
    const color = pct >= 90 ? "bg-red-500" : pct >= 60 ? "bg-orange-500" : "bg-emerald-500";
    return (
      <div className="min-w-[120px]">
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">{used} / {o.limite_utilisation}</p>
      </div>
    );
  };

  const renderRow = (o: any, isArchived = false) => {
    const eff = effectiveStatut(o);
    const statutInfo = STATUT_OFFRE_COLORS[eff] || STATUT_OFFRE_COLORS.active;
    const canSuspend = eff === "active";
    const canReactivate = eff === "suspendu";

    return (
      <TableRow key={o.id}>
        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
          {format(new Date(o.created_at), "dd/MM/yyyy", { locale: fr })}
        </TableCell>
        <TableCell className="font-medium">{o.nom}</TableCell>
        <TableCell>
          {o.code_promo ? (
            <button onClick={() => copyCode(o.code_promo)} className="flex items-center gap-1 font-mono text-xs bg-muted px-2 py-1 rounded hover:bg-accent">
              {o.code_promo} <Copy className="h-3 w-3" />
            </button>
          ) : "—"}
        </TableCell>
        <TableCell>
          {o.type_reduction === "abonnement_offert"
            ? "1 mois offert"
            : o.type_reduction === "pourcentage"
              ? `-${o.valeur_reduction}%`
              : `-${o.valeur_reduction} MAD`}
        </TableCell>
        <TableCell>{getSegmentLabel(o.segment_client)}</TableCell>
        <TableCell className="text-xs">{getStatutClientLabel(o.statut_client || "tous")}</TableCell>
        <TableCell>{renderUsageBar(o)}</TableCell>
        <TableCell className="text-xs whitespace-nowrap">
          {format(new Date(o.date_debut), "dd/MM/yy", { locale: fr })}
          {o.date_fin ? ` → ${format(new Date(o.date_fin), "dd/MM/yy", { locale: fr })}` : " → ∞"}
        </TableCell>
        <TableCell>
          <Badge className={statutInfo.color}>{statutInfo.label}</Badge>
        </TableCell>
        <TableCell>
          <div className="flex gap-0.5">
            <Button variant="ghost" size="icon" onClick={() => setDetailOffre(o)} title="Détails">
              <Eye className="h-4 w-4 text-blue-600" />
            </Button>
            {!isArchived && (
              <Button variant="ghost" size="icon" onClick={() => setEditOffre(o)} title="Modifier">
                <Pencil className="h-4 w-4 text-primary" />
              </Button>
            )}
            {!isArchived && (
              <Button variant="ghost" size="icon" onClick={() => handleDuplicate(o)} title="Dupliquer">
                <Files className="h-4 w-4 text-violet-600" />
              </Button>
            )}
            {!isArchived && canSuspend && (
              <Button variant="ghost" size="icon" onClick={() => statutMutation.mutate({ id: o.id, statut: "suspendu" })} title="Suspendre">
                <PauseCircle className="h-4 w-4 text-amber-600" />
              </Button>
            )}
            {!isArchived && canReactivate && (
              <Button variant="ghost" size="icon" onClick={() => statutMutation.mutate({ id: o.id, statut: "active" })} title="Réactiver">
                <PlayCircle className="h-4 w-4 text-emerald-600" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => archiveMutation.mutate({ id: o.id, archivee: !isArchived })}
              title={isArchived ? "Restaurer" : "Archiver"}
            >
              {isArchived ? <ArchiveRestore className="h-4 w-4 text-blue-600" /> : <Archive className="h-4 w-4 text-amber-600" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(o.id)} title="Supprimer">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const tableHeaders = (
    <TableHeader>
      <TableRow>
        <TableHead>Date création</TableHead>
        <TableHead>Nom de la promo</TableHead>
        <TableHead>Code</TableHead>
        <TableHead>Réduction</TableHead>
        <TableHead>Segment</TableHead>
        <TableHead>Statut client</TableHead>
        <TableHead>Utilisation</TableHead>
        <TableHead>Validité</TableHead>
        <TableHead>Statut</TableHead>
        <TableHead className="w-44">Actions</TableHead>
      </TableRow>
    </TableHeader>
  );

  return (
    <div className="space-y-4">
      {/* Archived section */}
      {archivedOffres.length > 0 && (
        <div className="rounded-md border bg-muted/30">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 w-full px-4 py-3 text-left font-semibold text-sm hover:bg-muted/50 transition-colors"
          >
            {showArchived ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <Archive className="h-4 w-4 text-amber-600" />
            Archivés ({archivedOffres.length})
          </button>
          {showArchived && (
            <div className="px-2 pb-2 overflow-x-auto">
              <Table>
                {tableHeaders}
                <TableBody>{archivedOffres.map((o: any) => renderRow(o, true))}</TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Codes promo & Offres</h3>
        <Button onClick={() => { setInitialDuplicate(null); setShowModal(true); }} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Créer un code promo
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Date du</label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36 h-9" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Au</label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36 h-9" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Segment</label>
          <Select value={filterSegment} onValueChange={setFilterSegment}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous</SelectItem>
              {SEGMENTS_CLIENT.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Statut</label>
          <Select value={filterStatut} onValueChange={setFilterStatut}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous</SelectItem>
              {STATUTS_CODE_PROMO.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(dateFrom || dateTo || filterSegment !== "tous" || filterStatut !== "tous") && (
          <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); setFilterSegment("tous"); setFilterStatut("tous"); }}>
            Réinitialiser
          </Button>
        )}
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          {tableHeaders}
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
            ) : filteredOffres.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Aucune offre trouvée</TableCell></TableRow>
            ) : (
              filteredOffres.map((o: any) => renderRow(o))
            )}
          </TableBody>
        </Table>
      </div>

      <CreateOffreModal
        open={showModal}
        onClose={() => { setShowModal(false); setInitialDuplicate(null); }}
        initial={initialDuplicate}
      />
      <EditOffreModal offre={editOffre} onClose={() => setEditOffre(null)} />
      <OffrePromoDetailModal offre={detailOffre} onClose={() => setDetailOffre(null)} />
    </div>
  );
}
