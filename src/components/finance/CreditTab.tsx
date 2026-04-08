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
import { Search, CalendarIcon, X } from "lucide-react";
import { Facturation, partAgence, partProfil } from "@/lib/finance-types";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

export default function CreditTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [filterSegment, setFilterSegment] = useState("all");
  const [filterPaiement, setFilterPaiement] = useState("non_paye");
  const [filterFacturation, setFilterFacturation] = useState("all");

  const { data: missions = [] } = useQuery({
    queryKey: ["facturation", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("facturation").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Facturation[];
    },
  });

  // Credit = agence encaissé, part profil non versée
  const creditMissions = useMemo(() => {
    return missions.filter((m) => {
      if (m.encaisse_par === "profil") return false;
      // Filter by payment status
      if (filterPaiement === "non_paye" && m.part_profil_versee) return false;
      if (filterPaiement === "paye" && !m.part_profil_versee) return false;
      if (filterSegment !== "all" && (m as any).segment !== filterSegment) return false;
      // Facturation filter
      if (filterFacturation === "facturee" && m.statut_mission === "facturation_annulee") return false;
      if (filterFacturation === "non_facturee" && m.statut_mission !== "facturation_annulee") return false;
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
  }, [missions, filterPaiement, filterSegment, filterFacturation, dateFrom, dateTo, search]);

  const totalMontant = creditMissions.reduce((s, m) => s + partProfil(m), 0);
  const uniqueProfils = new Set(creditMissions.map((m) => m.profil_nom || m.profil_id)).size;

  const updateMutation = useMutation({
    mutationFn: async ({ id, paid }: { id: string; paid: boolean }) => {
      const { error } = await supabase.from("facturation").update({
        part_profil_versee: paid,
        date_versement_profil: paid ? new Date().toISOString().split("T")[0] : null,
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
    if (profilId) navigate(`/profils/${profilId}`);
  };

  const getMissionLabel = (m: Facturation) => {
    if (m.statut_mission === "facturation_annulee") return <Badge className="bg-red-100 text-red-800 text-xs">Facturation annulée</Badge>;
    if (m.statut_paiement === "paiement_effectue" || (m.montant_paye_client && m.montant_paye_client > 0)) return <Badge className="bg-green-100 text-green-800 text-xs">Facturée</Badge>;
    return <Badge className="bg-gray-100 text-gray-800 text-xs">En attente</Badge>;
  };

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
          <Select value={filterFacturation} onValueChange={setFilterFacturation}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Facturation" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="facturee">Facturée</SelectItem>
              <SelectItem value="non_facturee">Facturation annulée</SelectItem>
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
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase">Profils créditeurs</p>
            <p className="text-2xl font-bold">{uniqueProfils}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase">Total montant</p>
            <p className="text-2xl font-bold text-blue-600">{fmt(totalMontant)}</p>
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
              <TableHead className="uppercase text-xs">Mission</TableHead>
              <TableHead className="uppercase text-xs">Segment</TableHead>
              <TableHead className="uppercase text-xs">Montant reçu du client</TableHead>
              <TableHead className="uppercase text-xs">Part de l'agence</TableHead>
              <TableHead className="uppercase text-xs text-blue-600">Doit au profil</TableHead>
              <TableHead className="uppercase text-xs">Statut paiement</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {creditMissions.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Aucune donnée</TableCell></TableRow>
            ) : creditMissions.map((m) => (
              <TableRow key={m.id} className={m.part_profil_versee ? "opacity-60 bg-muted/20" : ""}>
                <TableCell className="text-sm">{m.date_intervention ? format(new Date(m.date_intervention), "dd/MM/yyyy") : "—"}</TableCell>
                <TableCell>
                  <div className="text-sm font-medium">{m.nom_client}</div>
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
                <TableCell>{getMissionLabel(m)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={(m as any).segment === "entreprise" ? "border-violet-300 text-violet-700" : "border-sky-300 text-sky-700"}>
                    {(m as any).segment === "entreprise" ? "Entreprise" : "Particulier"}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">{fmt(m.montant_paye_client || m.montant_total)}</TableCell>
                <TableCell className="font-medium text-emerald-700">{fmt(partAgence(m))}</TableCell>
                <TableCell className="font-bold text-blue-600">{fmt(partProfil(m))}</TableCell>
                <TableCell>
                  <Select
                    value={m.part_profil_versee ? "paye" : "non_paye"}
                    onValueChange={(val) => updateMutation.mutate({ id: m.id, paid: val === "paye" })}
                  >
                    <SelectTrigger className={cn("w-28 h-8 text-xs", m.part_profil_versee ? "border-green-300" : "border-blue-300")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="non_paye">Non payé</SelectItem>
                      <SelectItem value="paye">Payé</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
