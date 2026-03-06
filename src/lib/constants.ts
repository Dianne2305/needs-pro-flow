export const TYPES_PRESTATION_PARTICULIER = [
  "Ménage standard",
  "Grand ménage",
  "Ménage Air BnB",
  "Nettoyage post-déménagement",
  "Ménage fin de chantier",
  "Auxiliaire de vie",
  "Ménage post-sinistre",
] as const;

export const TYPES_PRESTATION_ENTREPRISE = [
  "Ménage Bureaux",
  "Placement & gestion",
  "Ménage post-sinistre",
  "Ménage fin de chantier",
] as const;

export const TYPES_PRESTATION = [
  ...new Set([...TYPES_PRESTATION_PARTICULIER, ...TYPES_PRESTATION_ENTREPRISE]),
] as const;

export const TYPES_BIEN = [
  "Appartement",
  "Villa",
  "Bureau",
  "Local commercial",
  "Riad",
  "Autre",
] as const;

export const FREQUENCES = [
  { value: "ponctuel", label: "Ponctuel" },
  { value: "quotidien", label: "Quotidien" },
  { value: "hebdomadaire", label: "Hebdomadaire" },
  { value: "bi_mensuel", label: "Bi-mensuel" },
  { value: "mensuel", label: "Mensuel" },
] as const;

export const QUARTIERS_CASABLANCA = [
  "Maârif", "Gauthier", "Bourgogne", "Racine", "Anfa",
  "Ain Diab", "Californie", "Riviera", "Val d'Anfa", "CIL",
  "Oasis", "Palmier", "Belvédère", "Mers Sultan", "Centre-ville",
  "Hay Hassani", "Ain Chock", "Sidi Bernoussi", "Ain Sebaa",
  "Mohammedia", "Bouskoura", "Dar Bouazza", "Tamaris",
  "Bernoussi", "Sbata", "Hay Mohammadi", "Roches Noires",
  "Oulfa", "Lissasfa", "Sidi Maarouf", "2 Mars",
] as const;

export const STATUTS = {
  en_cours: { label: "En cours", color: "bg-slate-100 text-slate-800", hex: "#ffffff" },
  en_attente_confirmation: { label: "En attente de confirmation", color: "bg-amber-100 text-amber-800", hex: "#d9bf12" },
  en_attente_profil: { label: "En attente profil", color: "bg-amber-100 text-amber-800", hex: "#d9bf12" },
  confirme: { label: "Confirmé", color: "bg-cyan-100 text-cyan-800", hex: "#50bfcb" },
  confirme_intervention: { label: "Confirmé intervention", color: "bg-teal-100 text-teal-800", hex: "#3da89e" },
  prestation_effectuee: { label: "Prestation effectuée", color: "bg-orange-100 text-orange-800", hex: "#faa31f" },
  paye: { label: "Payé", color: "bg-green-100 text-green-800", hex: "#48bd00" },
  facturation_annulee: { label: "Facturation annulée", color: "bg-rose-100 text-rose-800", hex: "#e11d48" },
  annulee: { label: "Annulée", color: "bg-red-100 text-red-800", hex: "#dc2626" },
  standby: { label: "Standby", color: "bg-gray-100 text-gray-800", hex: "#9ca3af" },
  cloturee: { label: "Clôturée", color: "bg-gray-100 text-gray-600", hex: "#6b7280" },
  paiement_en_cours: { label: "Paiement en cours", color: "bg-blue-100 text-blue-800", hex: "#3b82f6" },
  nrp: { label: "NRP", color: "bg-zinc-100 text-zinc-800", hex: "#71717a" },
} as const;

export const SEGMENTS = [
  { value: "particulier", label: "Particulier" },
  { value: "entreprise", label: "Entreprise" },
] as const;

export const CONFIRMATION_OPE_OPTIONS = [
  { value: "confirme", label: "Confirmé", color: "bg-emerald-100 text-emerald-800" },
  { value: "report", label: "Report", color: "bg-amber-100 text-amber-800" },
  { value: "annule", label: "Annulé", color: "bg-red-100 text-red-800" },
] as const;

export const STATUT_CANDIDATURE_OPTIONS = [
  { value: "disponible", label: "Disponible" },
  { value: "confirme", label: "Confirmé" },
  { value: "desistement", label: "Désistement" },
  { value: "client_non_confirme", label: "Client n'a pas confirmé" },
] as const;
