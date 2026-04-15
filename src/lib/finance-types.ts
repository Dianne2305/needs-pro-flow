export interface Facturation {
  id: string;
  num_mission: number;
  demande_id: string;
  profil_id: string | null;
  profil_nom: string | null;
  nom_client: string;
  ville: string;
  type_service: string | null;
  date_intervention: string | null;
  montant_total: number;
  commission_pourcentage: number;
  mode_paiement_prevu: string | null;
  statut_mission: string;
  montant_paye_client: number;
  mode_paiement_reel: string | null;
  date_paiement_client: string | null;
  justificatif_url: string | null;
  statut_paiement: string;
  encaisse_par: string;
  montant_encaisse_profil: number;
  part_agence_reversee: boolean;
  date_remise_agence: string | null;
  part_profil_versee: boolean;
  date_versement_profil: string | null;
  created_at: string;
  commercial: string | null;
  commentaire: string | null;
  tva_pourcentage: number;
  montant_profil_doit: number | null;
  montant_agence_doit: number | null;
}

export function partAgence(f: Facturation): number {
  return f.montant_total * f.commission_pourcentage / 100;
}

export function partProfil(f: Facturation): number {
  return f.montant_total * (100 - f.commission_pourcentage) / 100;
}

export function soldeProfil(missions: Facturation[]): number {
  let solde = 0;
  for (const m of missions) {
    if (m.encaisse_par === "profil") {
      // Profil a encaissé → doit part agence
      if (!m.part_agence_reversee) solde += partAgence(m);
    } else {
      // Agence a encaissé → doit part profil
      if (!m.part_profil_versee) solde -= partProfil(m);
    }
  }
  return solde;
}

export const STATUT_MISSION_OPTIONS = [
  { value: "confirmee", label: "Confirmée", color: "bg-emerald-100 text-emerald-800" },
  { value: "terminee", label: "Terminée", color: "bg-sky-100 text-sky-800" },
  { value: "paye", label: "Payé", color: "bg-green-100 text-green-800" },
  { value: "facturation_annulee", label: "Facturation annulée", color: "bg-rose-100 text-rose-800" },
] as const;

export const STATUT_PAIEMENT_OPTIONS = [
  { value: "non_confirme", label: "Non confirmé", color: "bg-gray-100 text-gray-800" },
  { value: "non_paye", label: "Paiement en attente", color: "bg-red-100 text-red-800" },
  { value: "agence_payee_client", label: "Agence payée / Client", color: "bg-blue-100 text-blue-800" },
  { value: "profil_paye_client", label: "Profil payé / Client", color: "bg-orange-100 text-orange-800" },
  { value: "paye", label: "Payé", color: "bg-green-100 text-green-800" },
  { value: "paiement_partiel", label: "Paiement partiel", color: "bg-amber-100 text-amber-800" },
  { value: "facturation_annulee", label: "Facturation annulée", color: "bg-rose-100 text-rose-800" },
] as const;

export const MODE_PAIEMENT_OPTIONS = ["Virement", "Chèque", "Espèces à l'agence", "Sur place"] as const;

export const PROFIL_TYPE_OPTIONS = ["Femme de ménage", "Garde malade/Auxiliaire de vie"] as const;
