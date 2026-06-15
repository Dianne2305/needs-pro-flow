/**
 * GestionFinanciere.tsx
 * Page Gestion Financière. Sous-page "Trésorerie et Caisse" avec onglets Trésorerie / La Caisse.
 */
import { useLocation } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import VueGlobalePage from "@/components/finance/VueGlobalePage";
import CaissePage from "@/components/finance/CaissePage";
import TresorerieTab from "@/components/finance/TresorerieTab";

export default function GestionFinanciere() {
  const location = useLocation();
  const isCaisse = location.pathname === "/gestion-financiere/caisse";

  if (!isCaisse) return <VueGlobalePage />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Trésorerie et Caisse</h1>
        <p className="text-sm text-muted-foreground">Vue trésorerie et gestion de la caisse</p>
      </div>
      <Tabs defaultValue="tresorerie" className="w-full">
        <TabsList>
          <TabsTrigger value="tresorerie">Trésorerie</TabsTrigger>
          <TabsTrigger value="caisse">La Caisse</TabsTrigger>
        </TabsList>
        <TabsContent value="tresorerie" className="mt-4">
          <TresorerieTab />
        </TabsContent>
        <TabsContent value="caisse" className="mt-4">
          <CaissePage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
