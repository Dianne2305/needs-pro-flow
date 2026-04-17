/**
 * ComingSoon.tsx
 * Page placeholder 'Bientôt disponible' pour les sections en cours de développement.
 */
import { Construction } from "lucide-react";

const ComingSoon = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
    <Construction className="h-16 w-16 text-primary mb-4" />
    <h1 className="text-2xl font-bold text-foreground mb-2">Bientôt disponible</h1>
    <p className="text-muted-foreground">Cette fonctionnalité sera disponible dans une prochaine mise à jour.</p>
  </div>
);

export default ComingSoon;
