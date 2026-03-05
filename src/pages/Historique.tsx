import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Archive } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type Demande = Tables<"demandes">;

export default function Historique() {
  const [search, setSearch] = useState("");

  const { data: demandes = [], isLoading } = useQuery({
    queryKey: ["demandes", "historique"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandes")
        .select("*")
        .in("statut", ["annulee", "rejetee", "nrp", "facturation_annulee"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Demande[];
    },
  });

  const filtered = search
    ? demandes.filter((d) => {
        const q = search.toLowerCase();
        return d.nom.toLowerCase().includes(q) || d.type_prestation.toLowerCase().includes(q) || String(d.num_demande).includes(q);
      })
    : demandes;

  const statusLabel = (s: string) => {
    const map: Record<string, { label: string; color: string }> = {
      annulee: { label: "Annulé", color: "bg-red-100 text-red-800" },
      rejetee: { label: "Rejeté", color: "bg-orange-100 text-orange-800" },
      nrp: { label: "NRP", color: "bg-gray-100 text-gray-800" },
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

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Réf</TableHead>
              <TableHead>Nom client</TableHead>
              <TableHead>Type de service</TableHead>
              <TableHead>Segment</TableHead>
              <TableHead>Date création</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Motif</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun historique</TableCell></TableRow>
            ) : filtered.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-mono text-xs">#{d.num_demande}</TableCell>
                <TableCell className="font-medium text-sm">{d.nom}</TableCell>
                <TableCell className="text-sm">{d.type_prestation}</TableCell>
                <TableCell>
                  <Badge className={d.type_service === "SPP" ? "bg-primary text-primary-foreground" : "bg-spe text-spe-foreground"}>{d.type_service}</Badge>
                </TableCell>
                <TableCell className="text-xs">{format(new Date(d.created_at), "dd/MM/yyyy", { locale: fr })}</TableCell>
                <TableCell>{statusLabel(d.statut)}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{d.motif_annulation || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
