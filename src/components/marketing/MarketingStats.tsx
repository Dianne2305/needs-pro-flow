/**
 * MarketingStats.tsx
 * Cartes KPI marketing en haut de la page Marketing.
 */
import { Card, CardContent } from "@/components/ui/card";
import { Ticket, TrendingUp, Users } from "lucide-react";

interface MarketingStatsProps {
  totalCodesUtilises: number;
  caGenere: number;
  clientsAcquis: number;
}

export function MarketingStats({ totalCodesUtilises, caGenere, clientsAcquis }: MarketingStatsProps) {
  const stats = [
    { label: "Codes promo utilisés", value: totalCodesUtilises, icon: Ticket, bg: "bg-gradient-to-br from-[#e8920a] to-[#fcc35c]" },
    { label: "CA généré par promos", value: `${caGenere.toLocaleString()} MAD`, icon: TrendingUp, bg: "bg-gradient-to-br from-[#3da8b3] to-[#7dd4dc]" },
    { label: "Clients acquis via promo", value: clientsAcquis, icon: Users, bg: "bg-gradient-to-br from-[#037a82] to-[#1ab5bf]" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {stats.map((s) => (
        <Card key={s.label} className={`${s.bg} border-0`}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/20 text-white">
              <s.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-white/80">{s.label}</p>
              <p className="text-xl font-bold text-white">{s.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
