import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Facturation, partAgence, partProfil, soldeProfil, STATUT_PAIEMENT_OPTIONS } from "@/lib/finance-types";
import { format } from "date-fns";

interface ProfilFinance {
  id: string;
  nom: string;
  prenom: string;
  telephone: string | null;
  missions: Facturation[];
  totalMissions: number;
  totalCA: number;
  totalPartAgence: number;
  totalPartProfil: number;
  totalVerseAuProfil: number;
  totalRecuDuProfil: number;
  solde: number;
}

export default function ComptesProfils() {
  const [search, setSearch] = useState("");
  const [selectedProfil, setSelectedProfil] = useState<ProfilFinance | null>(null);

  const { data: profils = [] } = useQuery({
    queryKey: ["profils", "all_finance"],
    queryFn: async () => {
      const { data } = await supabase.from("profils").select("id, nom, prenom, telephone");
      return data || [];
    },
  });

  const { data: missions = [] } = useQuery({
    queryKey: ["facturation", "all"],
    queryFn: async () => {
      const { data } = await supabase.from("facturation").select("*").order("created_at", { ascending: false });
      return (data || []) as unknown as Facturation[];
    },
  });

  const profilFinances: ProfilFinance[] = useMemo(() => {
    return profils.map((p) => {
      const ms = missions.filter((m) => m.profil_id === p.id);
      const totalCA = ms.reduce((s, m) => s + (m.montant_total || 0), 0);
      const totalPA = ms.reduce((s, m) => s + partAgence(m), 0);
      const totalPP = ms.reduce((s, m) => s + partProfil(m), 0);
      const totalVerse = ms.filter((m) => m.encaisse_par === "agence" && m.part_profil_versee).reduce((s, m) => s + partProfil(m), 0);
      const totalRecu = ms.filter((m) => m.encaisse_par === "profil" && m.part_agence_reversee).reduce((s, m) => s + partAgence(m), 0);

      return {
        id: p.id, nom: p.nom, prenom: p.prenom, telephone: p.telephone,
        missions: ms, totalMissions: ms.length, totalCA, totalPartAgence: totalPA,
        totalPartProfil: totalPP, totalVerseAuProfil: totalVerse, totalRecuDuProfil: totalRecu,
        solde: soldeProfil(ms),
      };
    }).filter((p) => p.totalMissions > 0 || search);
  }, [profils, missions, search]);

  const filtered = profilFinances.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return p.nom.toLowerCase().includes(s) || p.prenom.toLowerCase().includes(s) || p.telephone?.includes(s);
  });

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Rechercher un profil..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Profil</TableHead>
              <TableHead>Missions</TableHead>
              <TableHead>CA généré</TableHead>
              <TableHead>Part agence</TableHead>
              <TableHead>Part profil</TableHead>
              <TableHead>Versé au profil</TableHead>
              <TableHead>Reçu du profil</TableHead>
              <TableHead>Solde</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Aucun profil avec missions</TableCell></TableRow>
            ) : filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.prenom} {p.nom}</TableCell>
                <TableCell>{p.totalMissions}</TableCell>
                <TableCell>{p.totalCA.toLocaleString("fr-MA")} DH</TableCell>
                <TableCell className="text-emerald-700">{p.totalPartAgence.toLocaleString("fr-MA")} DH</TableCell>
                <TableCell className="text-sky-700">{p.totalPartProfil.toLocaleString("fr-MA")} DH</TableCell>
                <TableCell>{p.totalVerseAuProfil.toLocaleString("fr-MA")} DH</TableCell>
                <TableCell>{p.totalRecuDuProfil.toLocaleString("fr-MA")} DH</TableCell>
                <TableCell>
                  <Badge className={p.solde > 0 ? "bg-red-100 text-red-800" : p.solde < 0 ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"}>
                    {p.solde > 0 ? `+${p.solde.toLocaleString("fr-MA")}` : p.solde < 0 ? `${p.solde.toLocaleString("fr-MA")}` : "0"} DH
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedProfil(p)}><Eye className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedProfil && (
        <Dialog open onOpenChange={() => setSelectedProfil(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Compte financier — {selectedProfil.prenom} {selectedProfil.nom}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Missions</p><p className="text-xl font-bold">{selectedProfil.totalMissions}</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">CA généré</p><p className="text-xl font-bold">{selectedProfil.totalCA.toLocaleString("fr-MA")} DH</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Part agence</p><p className="text-xl font-bold text-emerald-700">{selectedProfil.totalPartAgence.toLocaleString("fr-MA")} DH</p></CardContent></Card>
                <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Part profil</p><p className="text-xl font-bold text-sky-700">{selectedProfil.totalPartProfil.toLocaleString("fr-MA")} DH</p></CardContent></Card>
              </div>
              {/* Solde */}
              <Card className={selectedProfil.solde > 0 ? "border-red-200 bg-red-50" : selectedProfil.solde < 0 ? "border-blue-200 bg-blue-50" : "border-green-200 bg-green-50"}>
                <CardContent className="pt-4 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium">Solde actuel</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedProfil.solde > 0 ? "Le profil doit de l'argent à l'agence" : selectedProfil.solde < 0 ? "L'agence doit de l'argent au profil" : "Situation équilibrée"}
                    </p>
                  </div>
                  <p className="text-2xl font-bold">{Math.abs(selectedProfil.solde).toLocaleString("fr-MA")} DH</p>
                </CardContent>
              </Card>
              {/* Historique missions */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N°</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Encaissé par</TableHead>
                      <TableHead>Paiement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedProfil.missions.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono text-xs">M-{m.num_mission}</TableCell>
                        <TableCell>{m.date_intervention ? format(new Date(m.date_intervention), "dd/MM/yyyy") : "—"}</TableCell>
                        <TableCell>{m.nom_client}</TableCell>
                        <TableCell className="font-semibold">{m.montant_total?.toLocaleString("fr-MA")} DH</TableCell>
                        <TableCell><Badge variant="outline">{m.encaisse_par === "profil" ? "Profil" : "Agence"}</Badge></TableCell>
                        <TableCell>
                          <Badge className={STATUT_PAIEMENT_OPTIONS.find((s) => s.value === m.statut_paiement)?.color || ""}>
                            {STATUT_PAIEMENT_OPTIONS.find((s) => s.value === m.statut_paiement)?.label || m.statut_paiement}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
