/**
 * AirBnbConciergerie.tsx
 * Module Airbnb & Conciergerie : répertoire clients/biens, prise de commande, dossier unifié,
 * chaîne du linge, planning d'exécution, facturation, espace conciergerie et paramètres.
 */
import { Home } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClientsBiensTab } from "@/components/airbnb/ClientsBiensTab";
import { NouvelleCommandeTab } from "@/components/airbnb/NouvelleCommandeTab";
import { CommandeDossierTab } from "@/components/airbnb/CommandeDossierTab";
import { RunnerLingeTab } from "@/components/airbnb/RunnerLingeTab";
import { PlanningTab } from "@/components/airbnb/PlanningTab";
import { FacturationAirbnbTab } from "@/components/airbnb/FacturationAirbnbTab";
import { EspaceConciergerieTab } from "@/components/airbnb/EspaceConciergerieTab";
import { ParametresAirbnbTab } from "@/components/airbnb/ParametresAirbnbTab";

const ONGLETS = [
  { value: "clients", label: "Clients & Biens" },
  { value: "nouvelle", label: "Nouvelle commande" },
  { value: "commande", label: "La commande" },
  { value: "linge", label: "Runner & Linge" },
  { value: "planning", label: "Planning" },
  { value: "facturation", label: "Facturation" },
  { value: "conciergerie", label: "Espace conciergerie" },
  { value: "parametres", label: "Paramètres" },
];

export default function AirBnbConciergerie() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Home className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Air BnB &amp; Conciergerie</h1>
          <p className="text-sm text-muted-foreground">
            Turnovers, chaîne du linge et facturation des biens en location courte durée
          </p>
        </div>
      </div>

      <Tabs defaultValue="clients" className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap justify-center gap-1 bg-muted p-1">
          {ONGLETS.map((o) => (
            <TabsTrigger
              key={o.value}
              value={o.value}
              className="text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {o.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="clients" className="mt-4"><ClientsBiensTab /></TabsContent>
        <TabsContent value="nouvelle" className="mt-4"><NouvelleCommandeTab /></TabsContent>
        <TabsContent value="commande" className="mt-4"><CommandeDossierTab /></TabsContent>
        <TabsContent value="linge" className="mt-4"><RunnerLingeTab /></TabsContent>
        <TabsContent value="planning" className="mt-4"><PlanningTab /></TabsContent>
        <TabsContent value="facturation" className="mt-4"><FacturationAirbnbTab /></TabsContent>
        <TabsContent value="conciergerie" className="mt-4"><EspaceConciergerieTab /></TabsContent>
        <TabsContent value="parametres" className="mt-4"><ParametresAirbnbTab /></TabsContent>
      </Tabs>
    </div>
  );
}
