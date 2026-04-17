/**
 * marketing-constants.ts
 * Constantes marketing : segments clients, canaux campagne, types de gestes, couleurs statuts.
 */
export const TYPES_REDUCTION = [
  { value: "pourcentage", label: "Pourcentage (%)" },
  { value: "montant_fixe", label: "Montant fixe (MAD)" },
] as const;

export const SEGMENTS_CLIENT = [
  { value: "tous", label: "Tous les clients" },
  { value: "nouveaux", label: "Nouveaux clients" },
  { value: "reguliers", label: "Clients réguliers" },
  { value: "inactifs", label: "Clients inactifs" },
  { value: "vip", label: "Clients VIP" },
  { value: "entreprise", label: "Clients entreprise" },
  { value: "particulier", label: "Clients particulier" },
] as const;

export const TYPES_GESTE = [
  { value: "reduction_prochaine", label: "Réduction prochaine prestation" },
  { value: "facturation_annulee", label: "Facturation annulée" },
  { value: "intervention_gratuite", label: "Intervention gratuite" },
  { value: "code_promo_perso", label: "Code promo personnalisé" },
] as const;

export const CANAUX_CAMPAGNE = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
] as const;

export const SERVICES_MARKETING = [
  "Ménage standard",
  "Grand ménage",
  "Ménage Air BnB",
  "Nettoyage post-déménagement",
  "Ménage fin de chantier",
  "Ménage Bureaux",
  "Placement & gestion",
  "Ménage post-sinistre",
] as const;

export const STATUT_OFFRE_COLORS: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "bg-emerald-100 text-emerald-800" },
  planifiee: { label: "Planifiée", color: "bg-blue-100 text-blue-800" },
  expiree: { label: "Expirée", color: "bg-red-100 text-red-800" },
  desactivee: { label: "Désactivée", color: "bg-gray-100 text-gray-800" },
};

export const STATUT_CAMPAGNE_COLORS: Record<string, { label: string; color: string }> = {
  brouillon: { label: "Brouillon", color: "bg-gray-100 text-gray-800" },
  planifiee: { label: "Planifiée", color: "bg-blue-100 text-blue-800" },
  envoyee: { label: "Envoyée", color: "bg-emerald-100 text-emerald-800" },
};
