export const TYPES_PRESTATION = [
  "Ménage standard",
  "Grand Ménage",
  "Nettoyage Fin de chantier",
  "Ménage post-déménagement",
  "Ménage AirBNB",
  "Garde malade",
  "Ménage Bureaux",
  "Placement",
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
  en_attente: { label: "En attente", color: "bg-amber-100 text-amber-800" },
  confirmee: { label: "Confirmée", color: "bg-emerald-100 text-emerald-800" },
  en_cours: { label: "En cours", color: "bg-sky-100 text-sky-800" },
  en_attente_profil: { label: "Att. profil", color: "bg-violet-100 text-violet-800" },
  confirme_intervention: { label: "Confirmé intervention", color: "bg-teal-100 text-teal-800" },
  prestation_effectuee: { label: "Prestation effectuée", color: "bg-indigo-100 text-indigo-800" },
  paye: { label: "Payé", color: "bg-green-100 text-green-800" },
  rejetee: { label: "Rejetée", color: "bg-red-100 text-red-800" },
  cloturee: { label: "Clôturée", color: "bg-slate-100 text-slate-800" },
  standby: { label: "Standby", color: "bg-blue-100 text-blue-800" },
  annulee: { label: "Annulée", color: "bg-red-100 text-red-800" },
  nrp: { label: "NRP", color: "bg-orange-100 text-orange-800" },
} as const;

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
