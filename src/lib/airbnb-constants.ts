/**
 * airbnb-constants.ts
 * Constantes et règles métier du module Airbnb / Conciergerie :
 * codification des biens, grille tarifaire, options, chaîne du linge (sets, pièces supplémentaires, montant).
 */

export const TYPES_CLIENT_AIRBNB = [
  { value: "conciergerie", label: "Conciergerie" },
  { value: "particulier", label: "Particulier" },
  { value: "agence", label: "Agence" },
  { value: "autre", label: "Autre" },
] as const;

export const MODES_PAIEMENT_AIRBNB = [
  { value: "passage", label: "Après chaque passage" },
  { value: "quinzaine", label: "Quinzaine (probatoire)" },
  { value: "mensuel", label: "Mensuel groupé (26 → 25)" },
] as const;

export const TYPOLOGIES_BIEN = [
  { value: "studio", label: "Studio", tarif: 130 },
  { value: "1ch", label: "1 chambre", tarif: 140 },
  { value: "2ch", label: "2 chambres", tarif: 160 },
  { value: "3ch", label: "3 chambres", tarif: 190 },
  { value: "4ch", label: "4 chambres", tarif: 220 },
  { value: "villa", label: "Villa / Riad", tarif: 300 },
] as const;

/** Tarif standard hors conciergerie (moins de 3 biens confiés). */
export const TARIF_STANDARD = 240;
export const SEUIL_CONCIERGERIE = 3;
export const SUPPLEMENT_ZONE = 50;

export const ACCES_BIEN = [
  "Boîte à clés",
  "Code digicode",
  "Gardien",
  "Clé chez nous",
  "Remise en main propre",
] as const;

export const SERVICES_BIEN = [
  { value: "menage", label: "Ménage seul" },
  { value: "menage_linge", label: "Ménage + linge" },
  { value: "menage_reassort", label: "Ménage + réassort" },
  { value: "tout", label: "Tout" },
] as const;

export const NATURES_LINGE = [
  { value: "aucun", label: "Aucun linge", hint: "ménage seul", icon: "🚫" },
  { value: "depot", label: "Dépôt seul", hint: "on livre du propre", icon: "📥" },
  { value: "ramassage", label: "Ramassage seul", hint: "on récupère du sale", icon: "📤" },
  { value: "depot_ramassage", label: "Dépôt + ramassage", hint: "rotation standard", icon: "🔄" },
] as const;

export const OPTIONS_REASSORT = [
  { value: "essentiel", label: "Réassort Essentiel", prix: 49, detail: "Eau, café, papier hygiénique, savon main, sacs poubelle" },
  { value: "confort", label: "Réassort Confort", prix: 79, detail: "Essentiel + shampoing, après-shampoing, gel douche" },
] as const;

export const OPTIONS_AUTRES = [
  { value: "video", label: "Vidéo avant / après", prix: 10, detail: "Preuve filmée envoyée après le ménage" },
  { value: "materiel", label: "Mise à disposition du matériel", prix: 29, detail: "Produits, torchons et serpillère fournis" },
] as const;

/** Composition d'un set de linge : nombre de pièces de chaque article dans un set complet. */
export const SET_COMPOSITION = [
  { key: "housse", label: "Housse de couette", parSet: 1 },
  { key: "drap", label: "Drap plat", parSet: 1 },
  { key: "taie", label: "Taie d'oreiller", parSet: 2 },
  { key: "grande_serviette", label: "Grande serviette", parSet: 2 },
  { key: "petite_serviette", label: "Petite serviette", parSet: 2 },
] as const;

export const ARTICLES_HORS_SET = [
  { key: "tapis_bain", label: "Tapis de bain" },
  { key: "drap_housse", label: "Drap housse" },
  { key: "torchon", label: "Torchon" },
  { key: "autre", label: "Autre" },
] as const;

export const TARIF_SET = 50;
export const TARIF_PIECE_SUPP = 5;
export const MINIMUM_LINGE = 50;

export type ComptageLinge = Record<string, number>;

export interface ResultatLinge {
  totalPieces: number;
  sets: number;
  piecesSupp: number;
  montant: number;
  minimumApplique: boolean;
}

/**
 * Convertit un comptage article par article en sets, pièces supplémentaires et montant.
 * sets = min(quantité / nb par set) sur les articles du set.
 * montant = sets × 50 + pièces_supp × 5, avec un minimum de 50 DH dès la première pièce.
 */
export function calculerLinge(q: ComptageLinge): ResultatLinge {
  const ratios = SET_COMPOSITION.map((a) => Math.floor((q[a.key] || 0) / a.parSet));
  const sets = ratios.length ? Math.min(...ratios) : 0;
  const totalPieces = Object.values(q).reduce((s, n) => s + (Number(n) || 0), 0);
  const piecesDansSets = sets * SET_COMPOSITION.reduce((s, a) => s + a.parSet, 0);
  const piecesSupp = Math.max(0, totalPieces - piecesDansSets);
  let montant = sets * TARIF_SET + piecesSupp * TARIF_PIECE_SUPP;
  let minimumApplique = false;
  if (totalPieces > 0 && montant < MINIMUM_LINGE) {
    montant = MINIMUM_LINGE;
    minimumApplique = true;
  }
  return { totalPieces, sets, piecesSupp, montant, minimumApplique };
}

/** Trigramme = 1re lettre du prénom + 2 premières lettres du nom (Ghali BENSOUDA → GBE). */
export function calculerTrigramme(nomComplet: string): string {
  const parts = nomComplet.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  const prenom = parts[0];
  const nom = parts.length > 1 ? parts[parts.length - 1] : parts[0].slice(1);
  return (prenom.slice(0, 1) + nom.slice(0, 2)).toUpperCase();
}

/** Code bien = trigramme + numéro d'ordre sur 3 chiffres (GBE004). */
export function codeBien(trigramme: string, ordre: number): string {
  return `${(trigramme || "XXX").toUpperCase()}${String(ordre).padStart(3, "0")}`;
}

export function tarifTypologie(typologie: string): number {
  return TYPOLOGIES_BIEN.find((t) => t.value === typologie)?.tarif ?? 0;
}

export function labelTypologie(typologie: string): string {
  return TYPOLOGIES_BIEN.find((t) => t.value === typologie)?.label ?? typologie;
}

/** Tarif applicable : grille conciergerie si le client atteint le seuil, sinon tarif standard. */
export function tarifApplicable(typologie: string, nbBiensClient: number): number {
  return nbBiensClient >= SEUIL_CONCIERGERIE ? tarifTypologie(typologie) : TARIF_STANDARD;
}

export const STATUTS_COMMANDE = {
  brouillon: { label: "Brouillon", color: "bg-muted text-muted-foreground" },
  confirmee: { label: "Confirmée", color: "bg-blue-100 text-blue-800" },
  remontee_tdb: { label: "Remontée TDB", color: "bg-indigo-100 text-indigo-800" },
  en_cours: { label: "En cours", color: "bg-amber-100 text-amber-800" },
  terminee: { label: "Terminée", color: "bg-teal-100 text-teal-800" },
  facturable: { label: "Facturable", color: "bg-green-100 text-green-800" },
  facturee: { label: "Facturée", color: "bg-emerald-100 text-emerald-800" },
  annulee: { label: "Annulée", color: "bg-red-100 text-red-800" },
} as const;

export const ETAPES_LINGE = [
  { value: "recu", label: "Reçu et compté" },
  { value: "lavage", label: "En lavage" },
  { value: "sechage", label: "Séchage · repassage" },
  { value: "pret", label: "Prêt au départ" },
  { value: "livraison", label: "En livraison" },
] as const;

export const MOTIFS_SIGNALEMENT_LINGE = [
  "Lavé, taches persistantes",
  "Non lavable",
  "Inutilisable après lavage",
  "Déchiré",
] as const;

export const MOTIFS_SIGNALEMENT_MISSION = [
  "Accès impossible",
  "Filet introuvable",
  "Objet trouvé",
  "Autre",
] as const;

export function formatDH(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} DH`;
}
