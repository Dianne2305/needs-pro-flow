import { useState } from "react";
import { BarChart3, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import VueGlobalePage from "@/components/finance/VueGlobalePage";
import CaissePage from "@/components/finance/CaissePage";

const SUB_PAGES = [
  { key: "vue-globale", label: "Vue globale", icon: BarChart3 },
  { key: "caisse", label: "La Caisse", icon: Wallet },
] as const;

type SubPage = (typeof SUB_PAGES)[number]["key"];

export default function GestionFinanciere() {
  const [activePage, setActivePage] = useState<SubPage>("vue-globale");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" /> Gestion Financière
        </h1>
        <p className="text-muted-foreground">Vue globale des finances, suivi facturation et gestion de caisse</p>
      </div>

      {/* Sub-page navigation */}
      <div className="flex gap-2 border-b pb-0">
        {SUB_PAGES.map((page) => (
          <Button
            key={page.key}
            variant="ghost"
            onClick={() => setActivePage(page.key)}
            className={cn(
              "rounded-b-none border-b-2 px-5 py-2.5 font-medium transition-colors",
              activePage === page.key
                ? "border-b-primary text-primary bg-primary/5"
                : "border-b-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <page.icon className="h-4 w-4 mr-2" />
            {page.label}
          </Button>
        ))}
      </div>

      {activePage === "vue-globale" && <VueGlobalePage />}
      {activePage === "caisse" && <CaissePage />}
    </div>
  );
}
