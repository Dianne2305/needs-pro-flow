/**
 * VueGlobalePage.tsx
 * Onglet Vue globale : KPIs financiers (CA, commissions, pertes) et graphiques.
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, ArrowDownLeft, ArrowUpRight, FileText, Users } from "lucide-react";
import VueGlobale from "@/components/finance/VueGlobale";
import DebitTab from "@/components/finance/DebitTab";
import CreditTab from "@/components/finance/CreditTab";
import HistoriqueMissions from "@/components/finance/HistoriqueMissions";
import ComptesProfils from "@/components/finance/ComptesProfils";

export default function VueGlobalePage() {
  return (
    <Tabs defaultValue="vue-globale" className="space-y-4">
      <TabsList className="flex w-full justify-center h-12 bg-muted/60 p-1 rounded-lg gap-1">
        <TabsTrigger value="vue-globale" className="flex items-center justify-center gap-2 px-5 text-sm font-semibold data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
          <BarChart3 className="h-4 w-4" /> Vue globale
        </TabsTrigger>
        <TabsTrigger value="debit" className="flex items-center justify-center gap-2 px-5 text-sm font-semibold data-[state=active]:bg-red-500 data-[state=active]:text-white">
          <ArrowDownLeft className="h-4 w-4" /> Débit (Profil doit à l'Agence)
        </TabsTrigger>
        <TabsTrigger value="credit" className="flex items-center justify-center gap-2 px-5 text-sm font-semibold data-[state=active]:bg-blue-600 data-[state=active]:text-white">
          <ArrowUpRight className="h-4 w-4" /> Crédit (L'Agence doit au Profil)
        </TabsTrigger>
        <TabsTrigger value="suivi-facturation" className="flex items-center justify-center gap-2 px-5 text-sm font-semibold data-[state=active]:bg-amber-500 data-[state=active]:text-white">
          <FileText className="h-4 w-4" /> Suivi Facturation
        </TabsTrigger>
        <TabsTrigger value="comptes-profils" className="flex items-center justify-center gap-2 px-5 text-sm font-semibold data-[state=active]:bg-violet-600 data-[state=active]:text-white">
          <Users className="h-4 w-4" /> Comptes Profils
        </TabsTrigger>
      </TabsList>

      <TabsContent value="vue-globale">
        <VueGlobale />
      </TabsContent>
      <TabsContent value="debit">
        <DebitTab />
      </TabsContent>
      <TabsContent value="credit">
        <CreditTab />
      </TabsContent>
      <TabsContent value="suivi-facturation">
        <HistoriqueMissions />
      </TabsContent>
      <TabsContent value="comptes-profils">
        <ComptesProfils />
      </TabsContent>
    </Tabs>
  );
}
