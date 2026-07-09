/**
 * profil-constants.ts
 * Constantes profils : niveaux d'étude, langues, sexes, statuts profil, etc.
 */
export const LANGUES = [
  "Arabe", "Français", "Anglais", "Espagnol", "Amazigh", "Autre",
] as const;

export const NIVEAUX_ETUDE = [
  "Sans diplôme", "Primaire", "Collège", "Lycée", "Bac", "Bac+2", "Bac+3", "Bac+5", "Autre",
] as const;

export const SITUATIONS_MATRIMONIALES = [
  "Célibataire", "Marié(e)", "Divorcé(e)", "Veuf/Veuve",
] as const;

export const NATIONALITES = [
  "Marocaine", "Sénégalaise", "Ivoirienne", "Camerounaise", "Guinéenne", "Autre",
] as const;

export const PRESENTATIONS_PHYSIQUES = [
  { value: "presentable", label: "Présentable" },
  { value: "passable", label: "Passable" },
  { value: "tres_presentable", label: "Très présentable" },
] as const;

/** Corpulence : tailles standardisées XS → 2XL. */
export const CORPULENCES = [
  { value: "XS", label: "XS" },
  { value: "S", label: "S" },
  { value: "M", label: "M" },
  { value: "L", label: "L" },
  { value: "XL", label: "XL" },
  { value: "2XL", label: "2XL" },
] as const;

export const TYPES_PROFIL = [
  "Femme de ménage", "Garde malade", "Auxiliaire de vie", "Nounou",
] as const;

export const TYPES_POSTE_EXPERIENCE = [
  "Femme de ménage", "Garde malade",
] as const;

export const LIEUX_TRAVAIL = [
  "Hôtel", "Riad", "Entreprise", "Villa", "Appartement", "Duplex",
] as const;

export const TACHES_MENAGE = [
  "Faire le lit",
  "Passer l'aspirateur",
  "Laver le sol",
  "Dépoussiérer les meubles",
  "Nettoyer les vitres et miroirs",
  "Nettoyer le plan de travail et l'évier",
  "Nettoyer le réfrigérateur et les appareils électroménagers",
  "Nettoyage douche",
  "Nettoyage terrasse et balcon",
  "Repasser et plier les vêtements",
  "Ranger les placards",
] as const;

export const PROFIL_FILTER_TABS = [
  { value: "all", label: "Tout" },
  { value: "grand_menage", label: "Grand ménage" },
  { value: "menage_chantier", label: "Ménage chantier" },
  { value: "nettoyage_vitres", label: "Nettoyage de vitres" },
] as const;

/**
 * Statuts profil FDM.
 * - nouveau : profil fraîchement enregistré, pas encore validé.
 * - active : profil opérationnel, disponible pour les affectations.
 * - blackliste : bloqué (ne doit plus être proposé).
 * - stand_by : suspendu temporairement (X jours). Retour auto en "active" à expiration.
 * - en_conge : indisponible sur une plage (date début → date fin). Retour auto en "active".
 * - malade : indisponible pour cause médicale.
 */
export const STATUT_PROFIL_OPTIONS = [
  { value: "nouveau", label: "Nouveau", color: "bg-blue-100 text-blue-800" },
  { value: "active", label: "Active", color: "bg-emerald-100 text-emerald-800" },
  { value: "blackliste", label: "Blacklisté", color: "bg-slate-900 text-white" },
  { value: "stand_by", label: "Stand by", color: "bg-amber-100 text-amber-800" },
  { value: "en_conge", label: "En congé", color: "bg-violet-100 text-violet-800" },
  { value: "malade", label: "Malade", color: "bg-rose-100 text-rose-800" },
] as const;

/** Jours de la semaine (clés du calendrier de disponibilité). */
export const JOURS_SEMAINE = [
  { key: "lundi", label: "Lundi" },
  { key: "mardi", label: "Mardi" },
  { key: "mercredi", label: "Mercredi" },
  { key: "jeudi", label: "Jeudi" },
  { key: "vendredi", label: "Vendredi" },
  { key: "samedi", label: "Samedi" },
  { key: "dimanche", label: "Dimanche" },
] as const;

/** Type de la structure JSON stockée dans `profils.disponibilite_calendrier`. */
export type DisponibiliteCalendrier = Record<
  string,
  { actif: boolean; debut: string; fin: string }
>;

/** Valeur par défaut : tous les jours désactivés, 08:00–18:00. */
export const DEFAULT_DISPONIBILITE_CALENDRIER: DisponibiliteCalendrier = JOURS_SEMAINE.reduce(
  (acc, j) => ({ ...acc, [j.key]: { actif: false, debut: "08:00", fin: "18:00" } }),
  {} as DisponibiliteCalendrier,
);

/**
 * Retourne le statut effectif d'un profil en tenant compte des expirations
 * (stand_by au-delà du nombre de jours, en_conge après la date de fin).
 */
export function computeStatutEffectif(profil: {
  statut_profil?: string | null;
  standby_debut?: string | null;
  standby_jours?: number | null;
  conge_fin?: string | null;
}): string {
  const s = profil.statut_profil;
  if (s === "stand_by" && profil.standby_debut && profil.standby_jours) {
    const fin = new Date(profil.standby_debut);
    fin.setDate(fin.getDate() + profil.standby_jours);
    if (fin.getTime() < Date.now()) return "active";
  }
  if (s === "en_conge" && profil.conge_fin) {
    const fin = new Date(profil.conge_fin);
    fin.setHours(23, 59, 59);
    if (fin.getTime() < Date.now()) return "active";
  }
  return s || "nouveau";
}
