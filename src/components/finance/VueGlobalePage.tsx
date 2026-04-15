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
      <TabsList className="grid w-full grid-cols-5 max-w-3xl">
        <TabsTrigger value="vue-globale" className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> Vue globale
        </TabsTrigger>
        <TabsTrigger value="debit" className="flex items-center gap-2">
          <ArrowDownLeft className="h-4 w-4" /> Débit
        </TabsTrigger>
        <TabsTrigger value="credit" className="flex items-center gap-2">
          <ArrowUpRight className="h-4 w-4" /> Crédit
        </TabsTrigger>
        <TabsTrigger value="suivi-facturation" className="flex items-center gap-2">
          <FileText className="h-4 w-4" /> Suivi Facturation
        </TabsTrigger>
        <TabsTrigger value="comptes-profils" className="flex items-center gap-2">
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
