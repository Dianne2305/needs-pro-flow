/**
 * Historique.tsx
 * Page Historique global des actions (audit trail).
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Archive, CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

type Demande = Tables<"demandes">;

export default function Historique() {
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const { data: demandes = [], isLoading } = useQuery({
    queryKey: ["demandes", "historique"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandes")
        .select("*")
        .in("statut", ["annulee", "rejetee", "nrp", "facturation_annulee", "paye", "en_attente", "prestation_en_cours", "prestation_terminee", "nouveau_besoin", "confirme", "confirme_intervention"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Demande[];
    },
  });

  const filtered = demandes.filter((d) => {
    if (search) {
      const q = search.toLowerCase();
      if (!(d.nom.toLowerCase().includes(q) || d.type_prestation.toLowerCase().includes(q) || String(d.num_demande).includes(q))) {
        return false;
      }
    }
    if (dateRange?.from) {
      const created = new Date(d.created_at);
      const from = new Date(dateRange.from); from.setHours(0, 0, 0, 0);
      const to = dateRange.to ? new Date(dateRange.to) : new Date(dateRange.from);
      to.setHours(23, 59, 59, 999);
      if (created < from || created > to) return false;
    }
    return true;
  });

  const statusLabel = (s: string) => {
    const map: Record<string, { label: string; color: string }> = {
      en_attente: { label: "En attente", color: "bg-gray-100 text-gray-800" },
      nouveau_besoin: { label: "Nouveau besoin", color: "bg-blue-100 text-blue-800" },
      confirme: { label: "Confirmé", color: "bg-cyan-100 text-cyan-800" },
      confirme_intervention: { label: "Confirmé intervention", color: "bg-teal-100 text-teal-800" },
      prestation_en_cours: { label: "Pres. en cours", color: "bg-indigo-100 text-indigo-800" },
      prestation_terminee: { label: "Pres. terminée", color: "bg-orange-100 text-orange-800" },
      annulee: { label: "Annulé", color: "bg-red-100 text-red-800" },
      rejetee: { label: "Rejeté", color: "bg-orange-100 text-orange-800" },
      nrp: { label: "NRP", color: "bg-gray-100 text-gray-800" },
      facturation_annulee: { label: "Facturation annulée", color: "bg-rose-100 text-rose-800" },
      paye: { label: "Payé", color: "bg-emerald-100 text-emerald-800" },
    };
    const m = map[s];
    return m ? <Badge className={`${m.color} text-xs`}>{m.label}</Badge> : <Badge variant="outline">{s}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Archive className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold text-foreground">Historique</h1>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("justify-start text-left font-normal min-w-[240px]", !dateRange && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>{format(dateRange.from, "dd/MM/yyyy", { locale: fr })} → {format(dateRange.to, "dd/MM/yyyy", { locale: fr })}</>
                ) : (
                  format(dateRange.from, "dd/MM/yyyy", { locale: fr })
                )
              ) : (
                <span>Filtrer par date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
              initialFocus
              locale={fr}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
        {dateRange && (
          <Button variant="ghost" size="sm" onClick={() => setDateRange(undefined)}>
            <X className="h-4 w-4 mr-1" /> Réinitialiser
          </Button>
        )}
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Réf</TableHead>
              <TableHead>Date création</TableHead>
              <TableHead>Nom client</TableHead>
              <TableHead>Type de service</TableHead>
              <TableHead>Segment</TableHead>
              <TableHead>Profil</TableHead>
              <TableHead>Statut besoin</TableHead>
              <TableHead>Statut paiement</TableHead>
              <TableHead>Motif</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Aucun historique</TableCell></TableRow>
            ) : filtered.map((d) => {
              const paiementMap: Record<string, { label: string; color: string }> = {
                paye: { label: "Payé", color: "bg-emerald-100 text-emerald-800" },
                non_paye: { label: "Non payé", color: "bg-gray-100 text-gray-800" },
                partiel: { label: "Partiel", color: "bg-yellow-100 text-yellow-800" },
                non_confirme: { label: "Non confirmé", color: "bg-gray-100 text-gray-800" },
              };
              const pStatut = d.statut === "paye" ? "paye" : (d.statut_paiement_commercial || "non_confirme");
              const p = paiementMap[pStatut] || { label: pStatut, color: "bg-gray-100 text-gray-800" };
              return (
              <TableRow key={d.id}>
                <TableCell className="font-mono text-xs">#{d.num_demande}</TableCell>
                <TableCell className="text-xs">{format(new Date(d.created_at), "dd/MM/yyyy", { locale: fr })}</TableCell>
                <TableCell className="font-medium text-sm">
                  <Link to={`/compte-client?id=${d.id}&from=/historique`} className="text-primary hover:underline">
                    {d.nom}
                  </Link>
                </TableCell>
                <TableCell className="text-sm">{d.type_prestation}</TableCell>
                <TableCell>
                  <Badge className={d.type_service === "SPP" ? "bg-primary text-primary-foreground" : "bg-spe text-spe-foreground"}>{d.type_service}</Badge>
                </TableCell>
                <TableCell className="text-sm">{d.candidat_nom || "—"}</TableCell>
                <TableCell>{statusLabel(d.statut)}</TableCell>
                <TableCell><Badge className={`${p.color} text-xs`}>{p.label}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{d.motif_annulation || "—"}</TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
