import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import PendingRequests from "./pages/PendingRequests";
import ComingSoon from "./pages/ComingSoon";
import CompteClient from "./pages/CompteClient";
import Historique from "./pages/Historique";
import ListingClients from "./pages/ListingClients";
import Profils from "./pages/Profils";
import CompteProfil from "./pages/CompteProfil";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/demandes" element={<PendingRequests />} />
            <Route path="/compte-client" element={<CompteClient />} />
            <Route path="/historique" element={<Historique />} />
            <Route path="/profils" element={<Profils />} />
            <Route path="/compte-profil" element={<CompteProfil />} />
            <Route path="/clients" element={<ListingClients />} />
            <Route path="/facturation" element={<ComingSoon />} />
            <Route path="/parametres" element={<ComingSoon />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
