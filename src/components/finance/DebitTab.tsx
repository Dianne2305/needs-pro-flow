/**
 * DebitTab.tsx
 * Onglet Débit : argent que l'agence doit (versements profils, dépenses).
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { Search, CalendarIcon, X, Users, Eye } from "lucide-react";
import { Facturation, partAgence, partProfil } from "@/lib/finance-types";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

export default function DebitTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [filterSegment, setFilterSegment] = useState("all");
  const [filterPaiement, setFilterPaiement] = useState("non_paye");
  const [filterFactAnnulee, setFilterFactAnnulee] = useState("all");

  const { data: missions = [] } = useQuery({
    queryKey: ["facturation", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("facturation").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Facturation[];
    },
  });

  // Debit = profil payé par client (profil doit part agence)
  const debitMissions = useMemo(() => {
    return missions.filter((m) => {
      // Only show missions where client paid the profil directly
      if (m.statut_paiement !== "profil_paye_client") return false;
      // Filter by payment status
      if (filterPaiement === "non_paye" && m.part_agence_reversee) return false;
      if (filterPaiement === "paye" && !m.part_agence_reversee) return false;
      if (filterFactAnnulee === "annulee" && m.statut_mission !== "facturation_annulee") return false;
      if (filterFactAnnulee === "non_annulee" && m.statut_mission === "facturation_annulee") return false;
      if (filterSegment !== "all" && (m as any).segment !== filterSegment) return false;
      if (dateFrom && m.date_intervention && parseISO(m.date_intervention) < dateFrom) return false;
      if (dateTo && m.date_intervention) {
        const end = new Date(dateTo); end.setHours(23, 59, 59, 999);
        if (parseISO(m.date_intervention) > end) return false;
      }
      if ((dateFrom || dateTo) && !m.date_intervention) return false;
      if (search) {
        const s = search.toLowerCase();
        return (m.nom_client?.toLowerCase().includes(s) || m.profil_nom?.toLowerCase().includes(s));
      }
      return true;
    });
  }, [missions, filterPaiement, filterSegment, filterFactAnnulee, dateFrom, dateTo, search]);

  const totalMontant = debitMissions.reduce((s, m) => s + partAgence(m), 0);
  const uniqueProfils = new Set(debitMissions.map((m) => m.profil_nom || m.profil_id)).size;

  const updateMutation = useMutation({
    mutationFn: async ({ id, paid }: { id: string; paid: boolean }) => {
      const { error } = await supabase.from("facturation").update({
        part_agence_reversee: paid,
        date_remise_agence: paid ? new Date().toISOString().split("T")[0] : null,
      } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["facturation"] });
      toast({ title: "Statut mis à jour" });
    },
  });

  const fmt = (n: number) => n.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " DH";

  const goToProfil = (profilId: string | null) => {
    if (profilId) navigate(`/compte-profil?id=${profilId}&from=/gestion-financiere`);
  };
  const goToClient = (demandeId: string) => {
    navigate(`/compte-client?id=${demandeId}&from=/gestion-financiere`);
  };

  const RecapEye = ({ m }: { m: Facturation }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Voir récap">
          <Eye className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-sm space-y-1.5" align="end">
        <p className="font-semibold border-b pb-1.5 mb-1">Mission #{m.num_mission}</p>
        <div className="flex justify-between"><span className="text-muted-foreground">Client :</span><span className="font-medium">{m.nom_client}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Profil :</span><span className="font-medium">{m.profil_nom || "—"}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Service :</span><span className="font-medium">{m.type_service || "—"}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Date :</span><span className="font-medium">{m.date_intervention ? format(new Date(m.date_intervention), "dd/MM/yyyy") : "—"}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Ville :</span><span className="font-medium">{m.ville || "—"}</span></div>
        <div className="flex justify-between border-t pt-1.5 mt-1"><span className="text-muted-foreground">Total client :</span><span className="font-medium">{fmt(m.montant_paye_client || m.montant_total)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Part agence :</span><span className="font-semibold text-red-600">{fmt(partAgence(m))}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Part profil :</span><span className="font-semibold text-blue-600">{fmt(partProfil(m))}</span></div>
        {m.commentaire && <div className="border-t pt-1.5 mt-1 text-xs text-muted-foreground italic">{m.commentaire}</div>}
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher par nom..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterSegment} onValueChange={setFilterSegment}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Segment" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les segments</SelectItem>
              <SelectItem value="particulier">Particulier</SelectItem>
              <SelectItem value="entreprise">Entreprise</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPaiement} onValueChange={setFilterPaiement}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="non_paye">Non payé</SelectItem>
              <SelectItem value="paye">Payé</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterFactAnnulee} onValueChange={setFilterFactAnnulee}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Facturation" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes facturations</SelectItem>
              <SelectItem value="annulee">Facturation annulée</SelectItem>
              <SelectItem value="non_annulee">Non annulée</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <span className="text-sm text-muted-foreground font-medium">Période :</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Du"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={fr} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground">→</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, "dd/MM/yyyy") : "Au"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={fr} initialFocus className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
              <X className="h-4 w-4 mr-1" /> Réinitialiser
            </Button>
          )}
        </div>
      </div>

      {/* Recap */}
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase">Profils débiteurs</p>
            <p className="text-2xl font-bold">{uniqueProfils}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase">Total montant</p>
            <p className="text-2xl font-bold text-red-600">{fmt(totalMontant)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-b-2">
              <TableHead className="uppercase text-xs">Date mission</TableHead>
              <TableHead className="uppercase text-xs">Client – Ville</TableHead>
              <TableHead className="uppercase text-xs">Nom du profil</TableHead>
              <TableHead className="uppercase text-xs">Service</TableHead>
              <TableHead className="uppercase text-xs">Segment</TableHead>
              <TableHead className="uppercase text-xs">Montant reçu du client</TableHead>
              <TableHead className="uppercase text-xs text-red-600">Doit à l'agence</TableHead>
              <TableHead className="uppercase text-xs">Part du profil</TableHead>
              <TableHead className="uppercase text-xs">Statut paiement</TableHead>
              <TableHead className="uppercase text-xs w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {debitMissions.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Aucune donnée</TableCell></TableRow>
            ) : debitMissions.map((m) => (
              <TableRow key={m.id} className={m.part_agence_reversee ? "opacity-60 bg-muted/20" : ""}>
                <TableCell className="text-sm">{m.date_intervention ? format(new Date(m.date_intervention), "dd/MM/yyyy") : "—"}</TableCell>
                <TableCell>
                  <button
                    className="text-sm font-medium text-primary hover:underline cursor-pointer text-left"
                    onClick={() => goToClient(m.demande_id)}
                  >
                    {m.nom_client}
                  </button>
                  <div className="text-xs text-muted-foreground">{m.ville || ""}</div>
                </TableCell>
                <TableCell>
                  <button
                    className="text-sm font-medium text-primary hover:underline cursor-pointer"
                    onClick={() => goToProfil(m.profil_id)}
                  >
                    {m.profil_nom || "—"}
                  </button>
                </TableCell>
                <TableCell className="text-sm">{m.type_service || "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={(m as any).segment === "entreprise" ? "border-violet-300 text-violet-700" : "border-sky-300 text-sky-700"}>
                    {(m as any).segment === "entreprise" ? "Entreprise" : "Particulier"}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">{fmt(m.montant_paye_client || m.montant_total)}</TableCell>
                <TableCell className="font-bold text-red-600">{fmt(partAgence(m))}</TableCell>
                <TableCell className="font-medium">{fmt(partProfil(m))}</TableCell>
                <TableCell>
                  <Select
                    value={m.part_agence_reversee ? "paye" : "non_paye"}
                    onValueChange={(val) => updateMutation.mutate({ id: m.id, paid: val === "paye" })}
                  >
                    <SelectTrigger className={cn("w-28 h-8 text-xs", m.part_agence_reversee ? "border-green-300" : "border-red-300")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="non_paye">Non payé</SelectItem>
                      <SelectItem value="paye">Payé</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell><RecapEye m={m} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
