/**
 * App.tsx
 * Racine de l'application : providers (React Query, Tooltip, Toaster) et configuration du routeur (toutes les routes de pages).
 */
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import PendingRequests from "./pages/PendingRequests";
import Parametres from "./pages/Parametres";
import GestionFinanciere from "./pages/GestionFinanciere";
import CompteClient from "./pages/CompteClient";
import Historique from "./pages/Historique";
import ListingClients from "./pages/ListingClients";
import Profils from "./pages/Profils";
import CompteProfil from "./pages/CompteProfil";
import QualiteFeedback from "./pages/QualiteFeedback";
import FeedbackForm from "./pages/FeedbackForm";
import Marketing from "./pages/Marketing";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/feedback/:token" element={<FeedbackForm />} />
          
          <Route path="/*" element={
            <AppLayout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/demandes" element={<PendingRequests />} />
                <Route path="/compte-client" element={<CompteClient />} />
                <Route path="/historique" element={<Historique />} />
                <Route path="/profils" element={<Profils />} />
                <Route path="/compte-profil" element={<CompteProfil />} />
                <Route path="/clients" element={<ListingClients />} />
                <Route path="/gestion-financiere" element={<GestionFinanciere />} />
                <Route path="/gestion-financiere/caisse" element={<GestionFinanciere />} />
                <Route path="/qualite" element={<QualiteFeedback />} />
                <Route path="/marketing" element={<Marketing />} />
                <Route path="/parametres" element={<Parametres />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppLayout>
          } />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
