import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

export function SegmentsClients() {
  const { data: demandes = [] } = useQuery({
    queryKey: ["demandes_segments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("demandes").select("nom, type_service, created_at, statut");
      if (error) throw error;
      return data;
    },
  });

  // Compute segments from demandes
  const now = new Date();
  const clientMap = new Map<string, { count: number; lastDate: Date; type: string }>();
  
  demandes.forEach((d: any) => {
    const existing = clientMap.get(d.nom);
    const date = new Date(d.created_at);
    if (!existing || date > existing.lastDate) {
      clientMap.set(d.nom, {
        count: (existing?.count || 0) + 1,
        lastDate: date,
        type: d.type_service,
      });
    } else {
      existing.count += 1;
    }
  });

  const allClients = Array.from(clientMap.entries());
  
  const segments = [
    {
      label: "Nouveaux clients",
      color: "bg-blue-100 text-blue-800",
      count: allClients.filter(([, v]) => v.count === 1).length,
    },
    {
      label: "Clients réguliers",
      color: "bg-emerald-100 text-emerald-800",
      count: allClients.filter(([, v]) => v.count >= 3).length,
    },
    {
      label: "Clients VIP",
      color: "bg-amber-100 text-amber-800",
      count: allClients.filter(([, v]) => v.count >= 5).length,
    },
    {
      label: "Inactifs +30j",
      color: "bg-red-100 text-red-800",
      count: allClients.filter(([, v]) => (now.getTime() - v.lastDate.getTime()) > 30 * 86400000).length,
    },
    {
      label: "Inactifs +60j",
      color: "bg-red-200 text-red-900",
      count: allClients.filter(([, v]) => (now.getTime() - v.lastDate.getTime()) > 60 * 86400000).length,
    },
    {
      label: "Clients entreprise",
      color: "bg-purple-100 text-purple-800",
      count: allClients.filter(([, v]) => v.type === "entreprise").length,
    },
    {
      label: "Clients particulier",
      color: "bg-cyan-100 text-cyan-800",
      count: allClients.filter(([, v]) => v.type === "particulier").length,
    },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Segmentation clients</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {segments.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <Badge className={s.color}>{s.label}</Badge>
                <p className="text-2xl font-bold mt-1">{s.count}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
