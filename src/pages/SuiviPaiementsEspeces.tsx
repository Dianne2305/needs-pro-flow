/**
 * SuiviPaiementsEspeces.tsx
 * Suivi des suppléments d'heures payés en espèces et récupérés par les profils.
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Search, CalendarIcon, X, Banknote, Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

type Supplement = {
  id: string;
  demande_id: string | null;
  profil_id: string | null;
  profil_nom: string | null;
  nom_client: string | null;
  ville: string | null;
  type_service: string | null;
  date_recuperation: string;
  montant: number;
  recupere: boolean;
  commentaire: string | null;
  created_at: string;
};

export default function SuiviPaiementsEspeces() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statut, setStatut] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const { data: rows = [] } = useQuery({
    queryKey: ["supplements_especes", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplements_especes")
        .select("*")
        .order("date_recuperation", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Supplement[];
    },
  });

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statut === "recupere" && !r.recupere) return false;
      if (statut === "en_attente" && r.recupere) return false;
      if (dateFrom && parseISO(r.date_recuperation) < dateFrom) return false;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (parseISO(r.date_recuperation) > end) return false;
      }
      if (search) {
        const s = search.toLowerCase();
        return (
          r.profil_nom?.toLowerCase().includes(s) ||
          r.nom_client?.toLowerCase().includes(s) ||
          r.ville?.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [rows, statut, dateFrom, dateTo, search]);

  const fmt = (n: number) =>
    n.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " DH";

  const total = filtered.reduce((s, r) => s + Number(r.montant || 0), 0);
  const totalRecupere = filtered.filter((r) => r.recupere).reduce((s, r) => s + Number(r.montant || 0), 0);
  const nbProfils = new Set(filtered.map((r) => r.profil_nom || r.profil_id)).size;

  // Regroupement par profil
  const parProfil = useMemo(() => {
    const map = new Map<string, { nom: string; nb: number; montant: number; recupere: number }>();
    for (const r of filtered) {
      const key = r.profil_nom || r.profil_id || "—";
      const cur = map.get(key) || { nom: key, nb: 0, montant: 0, recupere: 0 };
      cur.nb += 1;
      cur.montant += Number(r.montant || 0);
      if (r.recupere) cur.recupere += Number(r.montant || 0);
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.montant - a.montant);
  }, [filtered]);

  const toggleRecupere = async (r: Supplement) => {
    const { error } = await supabase
      .from("supplements_especes")
      .update({ recupere: !r.recupere })
      .eq("id", r.id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["supplements_especes"] });
    toast({ title: "Statut mis à jour" });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Banknote className="h-6 w-6 text-emerald-600" />
          Suivi des paiements espèces
        </h1>
        <p className="text-sm text-muted-foreground">
          Suppléments d'heures payés en espèces et récupérés par les profils.
        </p>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher profil, client, ville..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statut} onValueChange={setStatut}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="recupere">Récupéré</SelectItem>
            <SelectItem value="en_attente">En attente</SelectItem>
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[150px] justify-start font-normal", !dateFrom && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Du"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={fr} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[150px] justify-start font-normal", !dateTo && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateTo ? format(dateTo, "dd/MM/yyyy") : "Au"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={fr} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
            <X className="h-4 w-4 mr-1" /> Réinitialiser
          </Button>
        )}
      </div>

      {/* Récap */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase">Total suppléments</p>
            <p className="text-2xl font-bold">{fmt(total)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-sky-500">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase">Récupéré en espèces</p>
            <p className="text-2xl font-bold text-emerald-600">{fmt(totalRecupere)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase flex items-center gap-1">
              <Users className="h-3 w-3" /> Profils concernés
            </p>
            <p className="text-2xl font-bold">{nbProfils}</p>
          </CardContent>
        </Card>
      </div>

      {/* Détail */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-b-2">
              <TableHead className="uppercase text-xs">Date</TableHead>
              <TableHead className="uppercase text-xs">Profil</TableHead>
              <TableHead className="uppercase text-xs">Client – Ville</TableHead>
              <TableHead className="uppercase text-xs">Service</TableHead>
              <TableHead className="uppercase text-xs text-right">Montant supplément</TableHead>
              <TableHead className="uppercase text-xs">Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Aucun supplément en espèces enregistré
                </TableCell>
              </TableRow>
            ) : filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-sm">{format(parseISO(r.date_recuperation), "dd/MM/yyyy")}</TableCell>
                <TableCell>
                  {r.profil_id ? (
                    <button
                      className="text-sm font-medium text-primary hover:underline"
                      onClick={() => navigate(`/compte-profil?id=${r.profil_id}&from=/gestion-financiere/paiements-especes`)}
                    >
                      {r.profil_nom || "—"}
                    </button>
                  ) : (
                    <span className="text-sm">{r.profil_nom || "—"}</span>
                  )}
                </TableCell>
                <TableCell>
                  {r.demande_id ? (
                    <button
                      className="text-sm font-medium text-primary hover:underline text-left"
                      onClick={() => navigate(`/compte-client?id=${r.demande_id}&from=/gestion-financiere/paiements-especes`)}
                    >
                      {r.nom_client || "—"}
                    </button>
                  ) : (
                    <span className="text-sm">{r.nom_client || "—"}</span>
                  )}
                  <div className="text-xs text-muted-foreground">{r.ville || ""}</div>
                </TableCell>
                <TableCell className="text-sm">{r.type_service || "—"}</TableCell>
                <TableCell className="text-right font-bold text-emerald-700">{fmt(Number(r.montant || 0))}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => toggleRecupere(r)}
                  >
                    <Badge
                      variant="outline"
                      className={r.recupere ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-amber-300 text-amber-700 bg-amber-50"}
                    >
                      {r.recupere ? "Récupéré" : "En attente"}
                    </Badge>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Regroupement par profil */}
      <div>
        <h2 className="text-lg font-semibold mb-2">Récapitulatif par profil</h2>
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-b-2">
                <TableHead className="uppercase text-xs">Profil</TableHead>
                <TableHead className="uppercase text-xs text-right">Nb suppléments</TableHead>
                <TableHead className="uppercase text-xs text-right">Total</TableHead>
                <TableHead className="uppercase text-xs text-right">Récupéré</TableHead>
                <TableHead className="uppercase text-xs text-right">Reste</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parProfil.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">Aucune donnée</TableCell>
                </TableRow>
              ) : parProfil.map((p) => (
                <TableRow key={p.nom}>
                  <TableCell className="font-medium">{p.nom}</TableCell>
                  <TableCell className="text-right">{p.nb}</TableCell>
                  <TableCell className="text-right font-medium">{fmt(p.montant)}</TableCell>
                  <TableCell className="text-right text-emerald-700">{fmt(p.recupere)}</TableCell>
                  <TableCell className="text-right text-amber-700 font-semibold">{fmt(p.montant - p.recupere)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
