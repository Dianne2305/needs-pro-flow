import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Wallet, ArrowDownLeft, ArrowUpRight, CalendarDays, Plus, Pencil, Trash2, Download } from "lucide-react";
import { format, isToday } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import CaisseOperationModal from "./CaisseOperationModal";

export interface OperationCaisse {
  id: string;
  type_operation: "entree" | "sortie";
  date_operation: string;
  montant: number;
  mode_paiement: string;
  libelle: string;
  client_nom: string | null;
  projet_service: string | null;
  utilisateur: string | null;
  notes: string | null;
  justificatif_url: string | null;
  created_at: string;
}

const MODE_LABELS: Record<string, string> = {
  especes: "Espèces",
  virement: "Virement",
  cheque: "Chèque",
  paiement_agence: "Paiement agence",
};

export default function CaissePage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOp, setEditingOp] = useState<OperationCaisse | null>(null);
  const [defaultType, setDefaultType] = useState<"entree" | "sortie">("entree");

  // Filters
  const [filterType, setFilterType] = useState("all");
  const [filterMode, setFilterMode] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterClient, setFilterClient] = useState("");

  const { data: operations = [], isLoading } = useQuery({
    queryKey: ["operations_caisse"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("operations_caisse")
        .select("*")
        .order("date_operation", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as OperationCaisse[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("operations_caisse").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operations_caisse"] });
      toast.success("Opération supprimée");
    },
  });

  const filtered = useMemo(() => {
    return operations.filter((op) => {
      if (filterType !== "all" && op.type_operation !== filterType) return false;
      if (filterMode !== "all" && op.mode_paiement !== filterMode) return false;
      if (filterDateFrom && op.date_operation < filterDateFrom) return false;
      if (filterDateTo && op.date_operation > filterDateTo) return false;
      if (filterClient && !op.client_nom?.toLowerCase().includes(filterClient.toLowerCase())) return false;
      return true;
    });
  }, [operations, filterType, filterMode, filterDateFrom, filterDateTo, filterClient]);

  // KPIs
  const totalEntrees = operations.filter((o) => o.type_operation === "entree").reduce((s, o) => s + o.montant, 0);
  const totalSorties = operations.filter((o) => o.type_operation === "sortie").reduce((s, o) => s + o.montant, 0);
  const solde = totalEntrees - totalSorties;
  const entreesJour = operations.filter((o) => o.type_operation === "entree" && isToday(new Date(o.date_operation))).reduce((s, o) => s + o.montant, 0);
  const sortiesJour = operations.filter((o) => o.type_operation === "sortie" && isToday(new Date(o.date_operation))).reduce((s, o) => s + o.montant, 0);
  const soldeJour = entreesJour - sortiesJour;

  const fmt = (n: number) => n.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " DH";

  const handleAdd = (type: "entree" | "sortie") => {
    setEditingOp(null);
    setDefaultType(type);
    setModalOpen(true);
  };

  const handleEdit = (op: OperationCaisse) => {
    setEditingOp(op);
    setDefaultType(op.type_operation);
    setModalOpen(true);
  };

  const exportCSV = () => {
    const headers = ["Date", "Type", "Libellé", "Client", "Mode paiement", "Montant", "Utilisateur"];
    const rows = filtered.map((op) => [
      op.date_operation,
      op.type_operation === "entree" ? "Entrée" : "Sortie",
      op.libelle,
      op.client_nom || "",
      MODE_LABELS[op.mode_paiement] || op.mode_paiement,
      op.montant.toString(),
      op.utilisateur || "",
    ]);
    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `caisse_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export CSV téléchargé");
  };

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => handleAdd("entree")} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4 mr-2" /> Ajouter une entrée
        </Button>
        <Button onClick={() => handleAdd("sortie")} variant="destructive">
          <Plus className="h-4 w-4 mr-2" /> Ajouter une sortie
        </Button>
        <Button variant="outline" onClick={exportCSV} className="ml-auto">
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Solde actuel</p>
            <p className={`text-3xl font-bold mt-1 ${solde >= 0 ? "text-foreground" : "text-destructive"}`}>{fmt(solde)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Total entrées</p>
                <p className="text-3xl font-bold mt-1">{fmt(totalEntrees)}</p>
              </div>
              <ArrowDownLeft className="h-5 w-5 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-red-600">Total sorties</p>
                <p className="text-3xl font-bold mt-1">{fmt(totalSorties)}</p>
              </div>
              <ArrowUpRight className="h-5 w-5 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Solde du jour</p>
                <p className={`text-3xl font-bold mt-1 ${soldeJour >= 0 ? "text-foreground" : "text-destructive"}`}>{fmt(soldeJour)}</p>
              </div>
              <CalendarDays className="h-5 w-5 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="entree">Entrée</SelectItem>
            <SelectItem value="sortie">Sortie</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterMode} onValueChange={setFilterMode}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Mode paiement" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les modes</SelectItem>
            <SelectItem value="especes">Espèces</SelectItem>
            <SelectItem value="virement">Virement</SelectItem>
            <SelectItem value="cheque">Chèque</SelectItem>
            <SelectItem value="paiement_agence">Paiement agence</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={filterDateFrom}
          onChange={(e) => setFilterDateFrom(e.target.value)}
          className="w-40"
          placeholder="Du"
        />
        <Input
          type="date"
          value={filterDateTo}
          onChange={(e) => setFilterDateTo(e.target.value)}
          className="w-40"
          placeholder="Au"
        />
        <Input
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          className="w-44"
          placeholder="Rechercher client..."
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold">Mouvements de caisse</h3>
            <span className="text-sm text-muted-foreground">{filtered.length} opération(s)</span>
          </div>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase">Date</TableHead>
                  <TableHead className="text-xs uppercase">Type</TableHead>
                  <TableHead className="text-xs uppercase">Libellé</TableHead>
                  <TableHead className="text-xs uppercase">Client</TableHead>
                  <TableHead className="text-xs uppercase">Mode paiement</TableHead>
                  <TableHead className="text-xs uppercase">Montant</TableHead>
                  <TableHead className="text-xs uppercase">Utilisateur</TableHead>
                  <TableHead className="text-xs uppercase">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Aucune opération</TableCell></TableRow>
                ) : (
                  filtered.map((op) => (
                    <TableRow key={op.id}>
                      <TableCell className="text-sm">{format(new Date(op.date_operation), "dd/MM/yyyy")}</TableCell>
                      <TableCell>
                        <Badge variant={op.type_operation === "entree" ? "default" : "destructive"} className={op.type_operation === "entree" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200" : ""}>
                          {op.type_operation === "entree" ? "Entrée" : "Sortie"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">{op.libelle}</TableCell>
                      <TableCell className="text-sm">{op.client_nom || "—"}</TableCell>
                      <TableCell className="text-sm">{MODE_LABELS[op.mode_paiement] || op.mode_paiement}</TableCell>
                      <TableCell className={`font-semibold ${op.type_operation === "entree" ? "text-emerald-700" : "text-red-600"}`}>
                        {op.type_operation === "entree" ? "+" : "-"}{fmt(op.montant)}
                      </TableCell>
                      <TableCell className="text-sm">{op.utilisateur || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(op)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm("Supprimer cette opération ?")) deleteMutation.mutate(op.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CaisseOperationModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        operation={editingOp}
        defaultType={defaultType}
      />
    </div>
  );
}
