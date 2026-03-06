import { Card, CardContent } from "@/components/ui/card";
import { Ticket, TrendingUp, Users, BarChart3 } from "lucide-react";

interface MarketingStatsProps {
  totalCodesUtilises: number;
  caGenere: number;
  clientsAcquis: number;
  tauxUtilisation: number;
}

export function MarketingStats({ totalCodesUtilises, caGenere, clientsAcquis, tauxUtilisation }: MarketingStatsProps) {
  const stats = [
    { label: "Codes promo utilisés", value: totalCodesUtilises, icon: Ticket, color: "text-primary" },
    { label: "CA généré par promos", value: `${caGenere.toLocaleString()} MAD`, icon: TrendingUp, color: "text-emerald-600" },
    { label: "Clients acquis via promo", value: clientsAcquis, icon: Users, color: "text-blue-600" },
    { label: "Taux d'utilisation", value: `${tauxUtilisation}%`, icon: BarChart3, color: "text-amber-600" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s) => (
        <Card key={s.label}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-muted ${s.color}`}>
              <s.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl font-bold">{s.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
