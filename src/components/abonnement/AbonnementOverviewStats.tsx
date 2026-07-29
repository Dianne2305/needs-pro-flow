import { Card } from "@/components/ui/card";
import { AlertTriangle, Check, Moon } from "lucide-react";

type StatCard = {
  label: string;
  value: string;
  unit?: string;
  hint: string;
  badge?: { text?: string; icon?: "alert" | "check"; className: string };
  valueClass?: string;
  cardClass?: string;
};

const STATS: StatCard[] = [
  {
    label: "MRR — Revenu récurrent",
    value: "61 240",
    unit: "DH/mois",
    hint: "47 abonnements actifs",
    badge: { text: "+8,2%", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  },
  {
    label: "Nouveaux ce mois",
    value: "5",
    hint: "dont 3 avec code promo",
    badge: { text: "+2", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  },
  {
    label: "Impayés en cours",
    value: "3",
    hint: "4 850 DH — 1 suspension J+15",
    valueClass: "text-destructive",
    cardClass: "border-destructive/30 bg-destructive/5",
    badge: { icon: "alert", className: "bg-destructive/10 text-destructive border-destructive/20" },
  },
  {
    label: "Clients à risque",
    value: "4",
    hint: "≥2 reports sur 60 jours",
    valueClass: "text-amber-600",
    badge: { text: "churn", className: "bg-amber-50 text-amber-700 border-amber-200" },
  },
  {
    label: "Passages cette semaine",
    value: "38",
    hint: "dont 6 en 5ème semaine",
    badge: { icon: "check", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  },
];

export default function AbonnementOverviewStats() {
  return (
    <div className="space-y-3">
      {/* Bandeau jour férié */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex gap-3">
        <Moon className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-semibold text-amber-900">Aïd el Kébir — 27 mai 2026</p>
          <p className="text-amber-800">
            Suspension automatique du 26 au 29 mai. <span className="font-semibold">9 passages concernés</span> — les
            clients et chargées de clientèle ont été notifiés. 6 reports confirmés, 3 en attente de réponse client.
          </p>
        </div>
      </div>

      {/* Cartes statistiques */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {STATS.map((s) => (
          <Card key={s.label} className={`p-3 ${s.cardClass ?? ""}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
              {s.badge && (
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${s.badge.className}`}>
                  {s.badge.icon === "alert" ? (
                    <AlertTriangle className="h-3 w-3" />
                  ) : s.badge.icon === "check" ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    s.badge.text
                  )}
                </span>
              )}
            </div>
            <p className={`mt-1 text-2xl font-bold ${s.valueClass ?? "text-foreground"}`}>
              {s.value}
              {s.unit && <span className="ml-1 text-xs font-medium text-muted-foreground">{s.unit}</span>}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{s.hint}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
