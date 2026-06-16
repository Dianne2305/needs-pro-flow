/**
 * SuiviDusProfilsPage.tsx
 * Sous-page Gestion Financière : Les suivis (onglets : Suivi des dus Agence-Profils, Suivi des demandes).
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SuiviDusProfils from "@/components/finance/SuiviDusProfils";
import SuiviCommerciaux from "@/components/finance/SuiviCommerciaux";

export default function SuiviDusProfilsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Les suivis</h1>
        <p className="text-sm text-muted-foreground">Suivi des dus Agence-Profils et des commerciaux</p>
      </div>
      <Tabs defaultValue="dus" className="w-full">
        <TabsList className="h-auto p-1.5 bg-muted/60 gap-1.5 rounded-xl">
          <TabsTrigger
            value="dus"
            className="px-5 py-2.5 text-sm font-semibold rounded-lg transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#0b7f7a] data-[state=active]:to-[#118b7e] data-[state=active]:text-white data-[state=active]:shadow-md"
          >
            Suivi des dus Agence-Profils
          </TabsTrigger>
          <TabsTrigger
            value="commerciaux"
            className="px-5 py-2.5 text-sm font-semibold rounded-lg transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-md"
          >
            Suivi des commerciaux
          </TabsTrigger>
        </TabsList>
        <TabsContent value="dus" className="mt-4">
          <SuiviDusProfils />
        </TabsContent>
        <TabsContent value="commerciaux" className="mt-4">
          <SuiviCommerciaux />
        </TabsContent>
      </Tabs>
    </div>
  );
}
