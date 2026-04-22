/**
 * Marketing.tsx
 * Page Marketing : KPIs + onglets Offres, Gestes, Campagnes.
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarketingStats } from "@/components/marketing/MarketingStats";
import { OffresTable } from "@/components/marketing/OffresTable";
import { GestesCommerciaux } from "@/components/marketing/GestesCommerciaux";
import { CampagnesMarketing } from "@/components/marketing/CampagnesMarketing";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone } from "lucide-react";

export default function Marketing() {
  const { data: offres = [] } = useQuery({
    queryKey: ["offres_marketing"],
    queryFn: async () => {
      const { data, error } = await supabase.from("offres_marketing").select("*");
      if (error) throw error;
      return data;
    },
  });

  const totalUtilisations = offres.reduce((acc: number, o: any) => acc + (o.nombre_utilisations || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Megaphone className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Marketing & Actions Commerciales</h1>
          <p className="text-sm text-muted-foreground">Gérez vos promotions, gestes commerciaux et campagnes</p>
        </div>
      </div>

      <MarketingStats
        totalCodesUtilises={totalUtilisations}
        caGenere={0}
        clientsAcquis={0}
      />

      <Tabs defaultValue="offres" className="space-y-4">
        <TabsList className="w-full justify-center gap-2 bg-transparent h-auto p-0">
          <TabsTrigger value="offres" className="flex-1 py-3 text-base font-semibold data-[state=active]:bg-emerald-600 data-[state=active]:text-white bg-emerald-100 text-emerald-800 rounded-lg">
            Codes promo
          </TabsTrigger>
          <TabsTrigger value="gestes" className="flex-1 py-3 text-base font-semibold data-[state=active]:bg-blue-600 data-[state=active]:text-white bg-blue-100 text-blue-800 rounded-lg">
            Gestes commerciaux
          </TabsTrigger>
          <TabsTrigger value="campagnes" className="flex-1 py-3 text-base font-semibold data-[state=active]:bg-orange-500 data-[state=active]:text-white bg-orange-100 text-orange-800 rounded-lg">
            Campagnes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="offres">
          <OffresTable />
        </TabsContent>
        <TabsContent value="gestes">
          <GestesCommerciaux />
        </TabsContent>
        <TabsContent value="campagnes">
          <CampagnesMarketing />
        </TabsContent>
      </Tabs>
    </div>
  );
}
