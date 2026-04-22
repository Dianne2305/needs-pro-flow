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
        <TabsList>
          <TabsTrigger value="offres">Codes promo</TabsTrigger>
          <TabsTrigger value="gestes">Gestes commerciaux</TabsTrigger>
          <TabsTrigger value="campagnes">Campagnes</TabsTrigger>
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
