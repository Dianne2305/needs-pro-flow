/**
 * Profils.tsx
 * Page Profils : listing candidats avec filtres, recherche, et actions (ajout/édition/postuler).
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RefreshCw, Search, Plus, CalendarIcon, UserCheck, Trash2, UserPlus, Pause, ShieldBan, PlayCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { PostulerModal } from "@/components/profils/PostulerModal";
import { STATUT_PROFIL_OPTIONS, computeStatutEffectif, JOURS_SEMAINE, DISPONIBILITE_INTERVENTION_OPTIONS, FUME_OPTIONS } from "@/lib/profil-constants";
import { TYPES_PRESTATION } from "@/lib/constants";
import { AddProfilModal } from "@/components/profils/AddProfilModal";

const DISPO_OPTIONS = [
  { value: "all", label: "Toutes disponibilités" },
  { value: "jours_feries", label: "Jours fériés" },
  { value: "soiree", label: "Soirée" },
  { value: "urgences", label: "Urgences" },
] as const;

const SEGMENT_OPTIONS = [
  { value: "all", label: "Tous segments" },
  { value: "tout", label: "Tout" },
  { value: "particulier", label: "Particulier" },
  { value: "entreprise", label: "Entreprise" },
] as const;

export default function Profils() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState("all");
  const [dispoFilter, setDispoFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [jourFilter, setJourFilter] = useState("all");
  const [dispoInterventionFilter, setDispoInterventionFilter] = useState("all");
  const [fumeFilter, setFumeFilter] = useState("all");
  

  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteProfilId, setDeleteProfilId] = useState<string | null>(null);
  const [postulerProfil, setPostulerProfil] = useState<any | null>(null);
  const [standbyProfilId, setStandbyProfilId] = useState<string | null>(null);
  const [standbyDays, setStandbyDays] = useState<string>("7");


  const deleteProfilMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("profils").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profils"] });
      toast({ title: "Profil supprimé" });
      setDeleteProfilId(null);
    },
  });

  const pauseMutation = useMutation({
    mutationFn: async ({ id, statut, jours }: { id: string; statut: "blackliste" | "stand_by" | "disponible"; jours?: number | null }) => {
      const updates: any = { statut_profil: statut };
      if (statut === "stand_by") { updates.standby_debut = new Date().toISOString(); updates.standby_jours = jours ?? null; }
      else { updates.standby_debut = null; updates.standby_jours = null; }
      const { error } = await supabase.from("profils").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      queryClient.invalidateQueries({ queryKey: ["profils"] });
      toast({ title: v.statut === "disponible" ? "Profil réactivé" : v.statut === "blackliste" ? "Profil blacklisté" : "Profil mis en stand-by" });
    },
  });

  const { data: profils = [], isLoading, refetch } = useQuery({
    queryKey: ["profils"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profils")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    let result = profils as any[];

    // Statut
    if (statutFilter !== "all") {
      result = result.filter((p: any) => computeStatutEffectif(p) === statutFilter);
    }

    // Disponibilité d'intervention
    if (dispoInterventionFilter !== "all") {
      result = result.filter((p: any) => (p.disponibilite_intervention || "disponible") === dispoInterventionFilter);
    }

    // Fume
    if (fumeFilter !== "all") {
      result = result.filter((p: any) => (p.fume || "non") === fumeFilter);
    }

    // Disponibilité
    if (dispoFilter === "jours_feries") result = result.filter((p: any) => p.dispo_jours_feries);
    else if (dispoFilter === "soiree") result = result.filter((p: any) => p.dispo_soiree);
    else if (dispoFilter === "urgences") result = result.filter((p: any) => p.dispo_urgences);

    // Service affectable
    if (serviceFilter !== "all") {
      result = result.filter((p: any) => Array.isArray(p.services_affectables) && p.services_affectables.includes(serviceFilter));
    }

    // Segment affectable
    if (segmentFilter !== "all") {
      result = result.filter((p: any) => (p.segment_affectable || "tout") === segmentFilter);
    }

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((p: any) =>
        p.nom?.toLowerCase().includes(q) ||
        p.prenom?.toLowerCase().includes(q) ||
        p.telephone?.includes(q) ||
        p.ville?.toLowerCase().includes(q) ||
        p.quartier?.toLowerCase().includes(q) ||
        p.numero_cin?.includes(q)
      );
    }

    // Date range
    if (dateFrom) result = result.filter((p: any) => new Date(p.created_at) >= dateFrom!);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59);
      result = result.filter((p: any) => new Date(p.created_at) <= end);
    }

    // Jour de disponibilité
    if (jourFilter !== "all") {
      result = result.filter((p: any) => p.disponibilite_calendrier?.[jourFilter]?.actif);
    }

    return result;
  }, [profils, statutFilter, dispoFilter, serviceFilter, segmentFilter, jourFilter, dispoInterventionFilter, fumeFilter, search, dateFrom, dateTo]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Liste des femmes de ménage</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Actualiser
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Ajouter Profil
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher par nom, numéro, ville, quartier..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        <Select value={statutFilter} onValueChange={setStatutFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            {STATUT_PROFIL_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={dispoInterventionFilter} onValueChange={setDispoInterventionFilter}>
          <SelectTrigger className="w-[190px]"><SelectValue placeholder="Dispo. intervention" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes dispos. intervention</SelectItem>
            {DISPONIBILITE_INTERVENTION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={dispoFilter} onValueChange={setDispoFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Disponibilité" /></SelectTrigger>
          <SelectContent>
            {DISPO_OPTIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={fumeFilter} onValueChange={setFumeFilter}>
          <SelectTrigger className="w-[120px]"><SelectValue placeholder="Fume" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Fume ?</SelectItem>
            {FUME_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={serviceFilter} onValueChange={setServiceFilter}>
          <SelectTrigger className="w-[190px]"><SelectValue placeholder="Domaine d'intervention" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous services</SelectItem>
            {TYPES_PRESTATION.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={segmentFilter} onValueChange={setSegmentFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Segment" /></SelectTrigger>
          <SelectContent>
            {SEGMENT_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={jourFilter} onValueChange={setJourFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Jour dispo." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les jours</SelectItem>
            {JOURS_SEMAINE.map(j => <SelectItem key={j.key} value={j.key}>{j.label}</SelectItem>)}
          </SelectContent>
        </Select>


        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs", !dateFrom && "text-muted-foreground")}>
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Du"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs", !dateTo && "text-muted-foreground")}>
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateTo ? format(dateTo, "dd/MM/yyyy") : "Au"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateTo} onSelect={setDateTo} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        {(dateFrom || dateTo || statutFilter !== "all" || dispoFilter !== "all" || serviceFilter !== "all" || segmentFilter !== "all" || jourFilter !== "all" || dispoInterventionFilter !== "all") && (
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => {
            setDateFrom(undefined); setDateTo(undefined);
            setStatutFilter("all"); setDispoFilter("all"); setServiceFilter("all"); setSegmentFilter("all"); setJourFilter("all"); setDispoInterventionFilter("all");
          }}>
            Réinitialiser
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Photo</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Prénom</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Situation</TableHead>
              <TableHead>Nationalité</TableHead>
              <TableHead>CIN</TableHead>
              <TableHead>Quartier / Ville</TableHead>
              <TableHead>Statut profil</TableHead>
              <TableHead>Disponibilité d'intervention</TableHead>
              <TableHead>Langue</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={14} className="text-center py-10 text-muted-foreground">Chargement...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={14} className="text-center py-10 text-muted-foreground">Aucun profil trouvé</TableCell></TableRow>
            ) : filtered.map((p: any) => {
              const statutEff = computeStatutEffectif(p);
              const statutOpt = STATUT_PROFIL_OPTIONS.find(s => s.value === statutEff);
              const languesArr: string[] = Array.isArray(p.langue) ? p.langue : [];
              return (
                <TableRow key={p.id} className="hover:bg-muted/50">
                  <TableCell>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={p.photo_url || ""} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {p.prenom?.charAt(0)}{p.nom?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium text-sm">{p.nom}</TableCell>
                  <TableCell className="text-sm">{p.prenom}</TableCell>
                  <TableCell className="text-sm">{p.telephone || "—"}</TableCell>
                  <TableCell className="text-sm">{p.whatsapp || "—"}</TableCell>
                  <TableCell className="text-xs">{p.situation_matrimoniale || "—"}</TableCell>
                  <TableCell className="text-xs">{p.nationalite || "—"}</TableCell>
                  <TableCell className="text-xs font-mono">{p.numero_cin || "—"}</TableCell>
                  <TableCell>
                    <div className="text-sm leading-tight">
                      {p.quartier && <span className="font-medium">{p.quartier}</span>}
                      {p.quartier && <br />}
                      <span className="text-muted-foreground text-xs">{p.ville}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {statutOpt ? (
                      <Badge variant="outline" className={cn("border-0 text-xs", statutOpt.color)}>{statutOpt.label}</Badge>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const dispoOpt = DISPONIBILITE_INTERVENTION_OPTIONS.find(o => o.value === (p.disponibilite_intervention || "disponible"));
                      return dispoOpt ? (
                        <Badge variant="outline" className={cn("border-0 text-xs", dispoOpt.color)}>{dispoOpt.label}</Badge>
                      ) : <span className="text-xs text-muted-foreground">—</span>;
                    })()}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {languesArr.length > 0 ? languesArr.map(l => (
                        <Badge key={l} variant="secondary" className="text-[10px] px-1.5">{l}</Badge>
                      )) : <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => navigate(`/compte-profil?id=${p.id}`)}>
                        <UserCheck className="h-3.5 w-3.5" /> Compte Profil
                      </Button>
                      <Button size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setPostulerProfil(p)}>
                        <UserPlus className="h-3.5 w-3.5" /> Affectation
                      </Button>
                      {p.statut_profil === "blackliste" || p.statut_profil === "stand_by" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => pauseMutation.mutate({ id: p.id, statut: "disponible" })}
                        >
                          <PlayCircle className="h-3.5 w-3.5" /> Réactiver
                        </Button>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1">
                              <Pause className="h-3.5 w-3.5" /> Mise en pause
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => pauseMutation.mutate({ id: p.id, statut: "blackliste" })}>
                              <ShieldBan className="h-4 w-4 mr-2" /> Blacklisté
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setStandbyDays("7"); setStandbyProfilId(p.id); }}>
                              <Pause className="h-4 w-4 mr-2" /> Stand-by
                            </DropdownMenuItem>

                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteProfilId(p.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AddProfilModal open={addOpen} onOpenChange={setAddOpen} onSuccess={() => refetch()} />

      {/* Raccourci Affectation : ouvre le modal Postuler pour ce profil */}
      {postulerProfil && (
        <PostulerModal
          open={!!postulerProfil}
          onOpenChange={(o) => !o && setPostulerProfil(null)}
          profil={postulerProfil}
        />
      )}

      {/* Delete Confirmation */}
      <Dialog open={!!deleteProfilId} onOpenChange={(o) => !o && setDeleteProfilId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Êtes-vous sûr de vouloir supprimer ce profil ? Cette action est irréversible.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteProfilId(null)}>Annuler</Button>
            <Button variant="destructive" onClick={() => deleteProfilId && deleteProfilMutation.mutate(deleteProfilId)}>Supprimer</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stand-by days dialog */}
      <Dialog open={!!standbyProfilId} onOpenChange={(o) => !o && setStandbyProfilId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mise en stand-by</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm font-medium">Nombre de jours</label>
            <Input
              type="number"
              min={1}
              value={standbyDays}
              onChange={(e) => setStandbyDays(e.target.value)}
              placeholder="Ex: 7"
            />
            <p className="text-xs text-muted-foreground">
              Le profil reviendra automatiquement en statut « Active » à l'expiration.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStandbyProfilId(null)}>Annuler</Button>
              <Button
                onClick={() => {
                  const n = Number(standbyDays);
                  if (!n || n < 1) { toast({ title: "Nombre de jours invalide", variant: "destructive" }); return; }
                  if (standbyProfilId) pauseMutation.mutate({ id: standbyProfilId, statut: "stand_by", jours: n });
                  setStandbyProfilId(null);
                }}
              >
                Confirmer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>

  );
}
