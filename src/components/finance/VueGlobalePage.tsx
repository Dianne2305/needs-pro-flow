import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, FileText, Users } from "lucide-react";
import VueGlobale from "@/components/finance/VueGlobale";
import HistoriqueMissions from "@/components/finance/HistoriqueMissions";
import ComptesProfils from "@/components/finance/ComptesProfils";

export default function VueGlobalePage() {
  return (
    <Tabs defaultValue="vue-globale" className="space-y-4">
      <TabsList className="grid w-full grid-cols-3 max-w-xl">
        <TabsTrigger value="vue-globale" className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> Vue globale
        </TabsTrigger>
        <TabsTrigger value="historique" className="flex items-center gap-2">
          <FileText className="h-4 w-4" /> Suivi Facturation
        </TabsTrigger>
        <TabsTrigger value="comptes" className="flex items-center gap-2">
          <Users className="h-4 w-4" /> Comptes Profils
        </TabsTrigger>
      </TabsList>

      <TabsContent value="vue-globale">
        <VueGlobale />
      </TabsContent>
      <TabsContent value="historique">
        <HistoriqueMissions />
      </TabsContent>
      <TabsContent value="comptes">
        <ComptesProfils />
      </TabsContent>
    </Tabs>
  );
}
