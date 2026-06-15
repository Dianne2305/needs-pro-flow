/**
 * SuiviDusProfilsPage.tsx
 * Sous-page Gestion Financière : Les suivis (onglets : Suivi des dus Agence-Profils, Suivi des demandes).
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SuiviDusProfils from "@/components/finance/SuiviDusProfils";

export default function SuiviDusProfilsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Les suivis</h1>
        <p className="text-sm text-muted-foreground">Suivi des dus Agence-Profils et suivi des demandes</p>
      </div>
      <Tabs defaultValue="dus" className="w-full">
        <TabsList>
          <TabsTrigger value="dus">Suivi des dus Agence-Profils</TabsTrigger>
          <TabsTrigger value="demandes">Suivi des demandes</TabsTrigger>
        </TabsList>
        <TabsContent value="dus" className="mt-4">
          <SuiviDusProfils />
        </TabsContent>
        <TabsContent value="demandes" className="mt-4">
          <div className="rounded-lg border bg-card p-10 text-center text-muted-foreground">
            Suivi des demandes — bientôt disponible
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
