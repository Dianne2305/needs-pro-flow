/**
 * GestionFinanciere.tsx
 * Page Gestion Financière : onglets Vue globale, Débit, Crédit, Suivi Facturation, Comptes Profils, Caisse.
 */
import { useLocation } from "react-router-dom";
import VueGlobalePage from "@/components/finance/VueGlobalePage";
import CaissePage from "@/components/finance/CaissePage";

export default function GestionFinanciere() {
  const location = useLocation();
  const isCaisse = location.pathname === "/gestion-financiere/caisse";

  return isCaisse ? <CaissePage /> : <VueGlobalePage />;
}
