import { useLocation } from "react-router-dom";
import VueGlobalePage from "@/components/finance/VueGlobalePage";
import CaissePage from "@/components/finance/CaissePage";

export default function GestionFinanciere() {
  const location = useLocation();
  const isCaisse = location.pathname === "/gestion-financiere/caisse";

  return isCaisse ? <CaissePage /> : <VueGlobalePage />;
}
