import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RefreshCw, Search, Plus, CalendarIcon, UserCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { PROFIL_FILTER_TABS, STATUT_PROFIL_OPTIONS } from "@/lib/profil-constants";
import { AddProfilModal } from "@/components/profils/AddProfilModal";

const COMMERCIAUX = ["Mehdi", "Kaoutar"] as const;

export default function Profils() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [operateurFilter, setOperateurFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [addOpen, setAddOpen] = useState(false);

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

    // Tab filter
    if (activeTab === "grand_menage") {
      result = result.filter((p: any) => p.experiences?.some?.((e: any) => e.grand_menage));
    } else if (activeTab === "menage_chantier") {
      result = result.filter((p: any) => p.type_profil?.toLowerCase().includes("chantier"));
    } else if (activeTab === "nettoyage_vitres") {
      result = result.filter((p: any) => p.experiences?.some?.((e: any) => e.taches?.includes("Nettoyer les vitres et miroirs")));
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

    return result;
  }, [profils, activeTab, search, operateurFilter, dateFrom, dateTo]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Listing Profils</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Actualiser
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Ajouter Profil
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b">
        {PROFIL_FILTER_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === tab.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher par nom, numéro, ville, quartier..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>
        <Select value={operateurFilter} onValueChange={setOperateurFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Opérateur" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            {COMMERCIAUX.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
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
              <TableHead>Disponibilité</TableHead>
              <TableHead>Langue</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={12} className="text-center py-10 text-muted-foreground">Chargement...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={12} className="text-center py-10 text-muted-foreground">Aucun profil trouvé</TableCell></TableRow>
            ) : filtered.map((p: any) => {
              const statutOpt = STATUT_PROFIL_OPTIONS.find(s => s.value === p.statut_profil);
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
                    <div className="flex flex-wrap gap-1">
                      {languesArr.length > 0 ? languesArr.map(l => (
                        <Badge key={l} variant="secondary" className="text-[10px] px-1.5">{l}</Badge>
                      )) : <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => navigate(`/compte-profil?id=${p.id}`)}>
                      <UserCheck className="h-3.5 w-3.5" /> Compte Profil
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AddProfilModal open={addOpen} onOpenChange={setAddOpen} onSuccess={() => refetch()} />
    </div>
  );
}
