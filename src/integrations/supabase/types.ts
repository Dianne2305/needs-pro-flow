export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      campagnes_marketing: {
        Row: {
          canal: string
          created_at: string
          date_envoi: string | null
          id: string
          message: string | null
          nom: string
          nombre_destinataires: number | null
          nombre_envoyes: number | null
          offre_id: string | null
          segment_cible: string
          statut: string
        }
        Insert: {
          canal?: string
          created_at?: string
          date_envoi?: string | null
          id?: string
          message?: string | null
          nom: string
          nombre_destinataires?: number | null
          nombre_envoyes?: number | null
          offre_id?: string | null
          segment_cible?: string
          statut?: string
        }
        Update: {
          canal?: string
          created_at?: string
          date_envoi?: string | null
          id?: string
          message?: string | null
          nom?: string
          nombre_destinataires?: number | null
          nombre_envoyes?: number | null
          offre_id?: string | null
          segment_cible?: string
          statut?: string
        }
        Relationships: [
          {
            foreignKeyName: "campagnes_marketing_offre_id_fkey"
            columns: ["offre_id"]
            isOneToOne: false
            referencedRelation: "offres_marketing"
            referencedColumns: ["id"]
          },
        ]
      }
      demande_historique: {
        Row: {
          action: string
          created_at: string
          demande_id: string
          details: string | null
          id: string
          utilisateur: string | null
        }
        Insert: {
          action: string
          created_at?: string
          demande_id: string
          details?: string | null
          id?: string
          utilisateur?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          demande_id?: string
          details?: string | null
          id?: string
          utilisateur?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demande_historique_demande_id_fkey"
            columns: ["demande_id"]
            isOneToOne: false
            referencedRelation: "demandes"
            referencedColumns: ["id"]
          },
        ]
      }
      demandes: {
        Row: {
          adresse: string | null
          avec_produit: boolean | null
          candidat_nom: string | null
          candidat_photo_url: string | null
          candidat_telephone: string | null
          commercial: string | null
          confirmation_ope: string | null
          confirmed_at: string | null
          contact_entreprise: string | null
          created_at: string
          date_prestation: string | null
          date_report: string | null
          description_intervention: string | null
          duree_heures: number | null
          email: string | null
          etat_logement: string | null
          flexibilite_horaire: string | null
          frequence: string
          heure_prestation: string | null
          id: string
          mode_paiement: string | null
          montant_candidat: number | null
          montant_total: number | null
          montant_verse_client: number | null
          motif_annulation: string | null
          nature_intervention: string | null
          nom: string
          nom_entreprise: string | null
          nombre_intervenants: number | null
          note_commercial: string | null
          note_operationnel: string | null
          notes_client: string | null
          num_demande: number
          preference_horaire: string | null
          quartier: string | null
          services_optionnels: Json | null
          statut: string
          statut_candidature: string | null
          statut_paiement_commercial: string | null
          superficie_m2: number | null
          telephone_direct: string | null
          telephone_whatsapp: string | null
          type_bien: string | null
          type_prestation: string
          type_salissure: string | null
          type_service: string
          ville: string
        }
        Insert: {
          adresse?: string | null
          avec_produit?: boolean | null
          candidat_nom?: string | null
          candidat_photo_url?: string | null
          candidat_telephone?: string | null
          commercial?: string | null
          confirmation_ope?: string | null
          confirmed_at?: string | null
          contact_entreprise?: string | null
          created_at?: string
          date_prestation?: string | null
          date_report?: string | null
          description_intervention?: string | null
          duree_heures?: number | null
          email?: string | null
          etat_logement?: string | null
          flexibilite_horaire?: string | null
          frequence?: string
          heure_prestation?: string | null
          id?: string
          mode_paiement?: string | null
          montant_candidat?: number | null
          montant_total?: number | null
          montant_verse_client?: number | null
          motif_annulation?: string | null
          nature_intervention?: string | null
          nom: string
          nom_entreprise?: string | null
          nombre_intervenants?: number | null
          note_commercial?: string | null
          note_operationnel?: string | null
          notes_client?: string | null
          num_demande?: number
          preference_horaire?: string | null
          quartier?: string | null
          services_optionnels?: Json | null
          statut?: string
          statut_candidature?: string | null
          statut_paiement_commercial?: string | null
          superficie_m2?: number | null
          telephone_direct?: string | null
          telephone_whatsapp?: string | null
          type_bien?: string | null
          type_prestation: string
          type_salissure?: string | null
          type_service: string
          ville?: string
        }
        Update: {
          adresse?: string | null
          avec_produit?: boolean | null
          candidat_nom?: string | null
          candidat_photo_url?: string | null
          candidat_telephone?: string | null
          commercial?: string | null
          confirmation_ope?: string | null
          confirmed_at?: string | null
          contact_entreprise?: string | null
          created_at?: string
          date_prestation?: string | null
          date_report?: string | null
          description_intervention?: string | null
          duree_heures?: number | null
          email?: string | null
          etat_logement?: string | null
          flexibilite_horaire?: string | null
          frequence?: string
          heure_prestation?: string | null
          id?: string
          mode_paiement?: string | null
          montant_candidat?: number | null
          montant_total?: number | null
          montant_verse_client?: number | null
          motif_annulation?: string | null
          nature_intervention?: string | null
          nom?: string
          nom_entreprise?: string | null
          nombre_intervenants?: number | null
          note_commercial?: string | null
          note_operationnel?: string | null
          notes_client?: string | null
          num_demande?: number
          preference_horaire?: string | null
          quartier?: string | null
          services_optionnels?: Json | null
          statut?: string
          statut_candidature?: string | null
          statut_paiement_commercial?: string | null
          superficie_m2?: number | null
          telephone_direct?: string | null
          telephone_whatsapp?: string | null
          type_bien?: string | null
          type_prestation?: string
          type_salissure?: string | null
          type_service?: string
          ville?: string
        }
        Relationships: []
      }
      facturation: {
        Row: {
          commentaire: string | null
          commercial: string | null
          commission_pourcentage: number
          created_at: string
          date_intervention: string | null
          date_paiement_client: string | null
          date_remise_agence: string | null
          date_versement_profil: string | null
          demande_id: string
          encaisse_par: string | null
          id: string
          justificatif_url: string | null
          mode_paiement_prevu: string | null
          mode_paiement_reel: string | null
          montant_agence_doit: number | null
          montant_encaisse_profil: number | null
          montant_paye_client: number | null
          montant_profil_doit: number | null
          montant_total: number
          nom_client: string
          num_mission: number
          part_agence_reversee: boolean | null
          part_profil_versee: boolean | null
          profil_id: string | null
          profil_nom: string | null
          segment: string | null
          statut_mission: string
          statut_paiement: string
          tva_pourcentage: number
          type_service: string | null
          ville: string | null
        }
        Insert: {
          commentaire?: string | null
          commercial?: string | null
          commission_pourcentage?: number
          created_at?: string
          date_intervention?: string | null
          date_paiement_client?: string | null
          date_remise_agence?: string | null
          date_versement_profil?: string | null
          demande_id: string
          encaisse_par?: string | null
          id?: string
          justificatif_url?: string | null
          mode_paiement_prevu?: string | null
          mode_paiement_reel?: string | null
          montant_agence_doit?: number | null
          montant_encaisse_profil?: number | null
          montant_paye_client?: number | null
          montant_profil_doit?: number | null
          montant_total?: number
          nom_client: string
          num_mission?: number
          part_agence_reversee?: boolean | null
          part_profil_versee?: boolean | null
          profil_id?: string | null
          profil_nom?: string | null
          segment?: string | null
          statut_mission?: string
          statut_paiement?: string
          tva_pourcentage?: number
          type_service?: string | null
          ville?: string | null
        }
        Update: {
          commentaire?: string | null
          commercial?: string | null
          commission_pourcentage?: number
          created_at?: string
          date_intervention?: string | null
          date_paiement_client?: string | null
          date_remise_agence?: string | null
          date_versement_profil?: string | null
          demande_id?: string
          encaisse_par?: string | null
          id?: string
          justificatif_url?: string | null
          mode_paiement_prevu?: string | null
          mode_paiement_reel?: string | null
          montant_agence_doit?: number | null
          montant_encaisse_profil?: number | null
          montant_paye_client?: number | null
          montant_profil_doit?: number | null
          montant_total?: number
          nom_client?: string
          num_mission?: number
          part_agence_reversee?: boolean | null
          part_profil_versee?: boolean | null
          profil_id?: string | null
          profil_nom?: string | null
          segment?: string | null
          statut_mission?: string
          statut_paiement?: string
          tva_pourcentage?: number
          type_service?: string | null
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facturation_demande_id_fkey"
            columns: ["demande_id"]
            isOneToOne: false
            referencedRelation: "demandes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facturation_profil_id_fkey"
            columns: ["profil_id"]
            isOneToOne: false
            referencedRelation: "profils"
            referencedColumns: ["id"]
          },
        ]
      }
      feedbacks: {
        Row: {
          commentaire: string | null
          created_at: string
          date_prestation: string | null
          demande_id: string
          id: string
          lien_envoye_at: string | null
          nom_client: string
          note_agence: number | null
          professionnel: string | null
          profil_id: string | null
          profil_nom: string | null
          qualite_menage: string | null
          recommande_agence: boolean | null
          recommande_profil: boolean | null
          satisfaction: string | null
          statut: string
          submitted_at: string | null
          telephone_client: string | null
          token: string
          type_service: string | null
          ville: string | null
        }
        Insert: {
          commentaire?: string | null
          created_at?: string
          date_prestation?: string | null
          demande_id: string
          id?: string
          lien_envoye_at?: string | null
          nom_client: string
          note_agence?: number | null
          professionnel?: string | null
          profil_id?: string | null
          profil_nom?: string | null
          qualite_menage?: string | null
          recommande_agence?: boolean | null
          recommande_profil?: boolean | null
          satisfaction?: string | null
          statut?: string
          submitted_at?: string | null
          telephone_client?: string | null
          token?: string
          type_service?: string | null
          ville?: string | null
        }
        Update: {
          commentaire?: string | null
          created_at?: string
          date_prestation?: string | null
          demande_id?: string
          id?: string
          lien_envoye_at?: string | null
          nom_client?: string
          note_agence?: number | null
          professionnel?: string | null
          profil_id?: string | null
          profil_nom?: string | null
          qualite_menage?: string | null
          recommande_agence?: boolean | null
          recommande_profil?: boolean | null
          satisfaction?: string | null
          statut?: string
          submitted_at?: string | null
          telephone_client?: string | null
          token?: string
          type_service?: string | null
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedbacks_demande_id_fkey"
            columns: ["demande_id"]
            isOneToOne: false
            referencedRelation: "demandes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedbacks_profil_id_fkey"
            columns: ["profil_id"]
            isOneToOne: false
            referencedRelation: "profils"
            referencedColumns: ["id"]
          },
        ]
      }
      gestes_commerciaux: {
        Row: {
          client_nom: string
          client_telephone: string | null
          commentaire: string | null
          created_at: string
          cree_par: string | null
          demande_id: string | null
          id: string
          montant: number | null
          pourcentage: number | null
          raison: string | null
          type_geste: string
        }
        Insert: {
          client_nom: string
          client_telephone?: string | null
          commentaire?: string | null
          created_at?: string
          cree_par?: string | null
          demande_id?: string | null
          id?: string
          montant?: number | null
          pourcentage?: number | null
          raison?: string | null
          type_geste: string
        }
        Update: {
          client_nom?: string
          client_telephone?: string | null
          commentaire?: string | null
          created_at?: string
          cree_par?: string | null
          demande_id?: string | null
          id?: string
          montant?: number | null
          pourcentage?: number | null
          raison?: string | null
          type_geste?: string
        }
        Relationships: [
          {
            foreignKeyName: "gestes_commerciaux_demande_id_fkey"
            columns: ["demande_id"]
            isOneToOne: false
            referencedRelation: "demandes"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          date_rappel: string
          demande_id: string
          id: string
          lu: boolean
          message: string
          type: string
        }
        Insert: {
          created_at?: string
          date_rappel: string
          demande_id: string
          id?: string
          lu?: boolean
          message: string
          type: string
        }
        Update: {
          created_at?: string
          date_rappel?: string
          demande_id?: string
          id?: string
          lu?: boolean
          message?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_demande_id_fkey"
            columns: ["demande_id"]
            isOneToOne: false
            referencedRelation: "demandes"
            referencedColumns: ["id"]
          },
        ]
      }
      offres_marketing: {
        Row: {
          canaux_diffusion: Json | null
          code_promo: string | null
          created_at: string
          date_debut: string
          date_fin: string | null
          id: string
          limite_utilisation: number | null
          nom: string
          nombre_utilisations: number | null
          segment_client: string | null
          services_concernes: Json | null
          statut: string
          statut_client: string | null
          type: string
          type_reduction: string
          valeur_reduction: number
        }
        Insert: {
          canaux_diffusion?: Json | null
          code_promo?: string | null
          created_at?: string
          date_debut?: string
          date_fin?: string | null
          id?: string
          limite_utilisation?: number | null
          nom: string
          nombre_utilisations?: number | null
          segment_client?: string | null
          services_concernes?: Json | null
          statut?: string
          statut_client?: string | null
          type?: string
          type_reduction?: string
          valeur_reduction?: number
        }
        Update: {
          canaux_diffusion?: Json | null
          code_promo?: string | null
          created_at?: string
          date_debut?: string
          date_fin?: string | null
          id?: string
          limite_utilisation?: number | null
          nom?: string
          nombre_utilisations?: number | null
          segment_client?: string | null
          services_concernes?: Json | null
          statut?: string
          statut_client?: string | null
          type?: string
          type_reduction?: string
          valeur_reduction?: number
        }
        Relationships: []
      }
      operations_caisse: {
        Row: {
          client_nom: string | null
          created_at: string
          date_operation: string
          id: string
          justificatif_url: string | null
          libelle: string
          mode_paiement: string
          montant: number
          notes: string | null
          projet_service: string | null
          type_operation: string
          updated_at: string
          utilisateur: string | null
        }
        Insert: {
          client_nom?: string | null
          created_at?: string
          date_operation?: string
          id?: string
          justificatif_url?: string | null
          libelle: string
          mode_paiement?: string
          montant?: number
          notes?: string | null
          projet_service?: string | null
          type_operation: string
          updated_at?: string
          utilisateur?: string | null
        }
        Update: {
          client_nom?: string | null
          created_at?: string
          date_operation?: string
          id?: string
          justificatif_url?: string | null
          libelle?: string
          mode_paiement?: string
          montant?: number
          notes?: string | null
          projet_service?: string | null
          type_operation?: string
          updated_at?: string
          utilisateur?: string | null
        }
        Relationships: []
      }
      profil_historique: {
        Row: {
          action: string
          created_at: string
          id: string
          note: string | null
          profil_id: string
          utilisateur: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          note?: string | null
          profil_id: string
          utilisateur?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          note?: string | null
          profil_id?: string
          utilisateur?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profil_historique_profil_id_fkey"
            columns: ["profil_id"]
            isOneToOne: false
            referencedRelation: "profils"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profils: {
        Row: {
          a_des_enfants: boolean | null
          attestation_url: string | null
          cin_url: string | null
          corpulence: string | null
          created_at: string
          date_naissance: string | null
          dispo_7j7: boolean | null
          dispo_journee: boolean | null
          dispo_jours_feries: boolean | null
          dispo_soiree: boolean | null
          dispo_urgences: boolean | null
          experience_annees: number | null
          experience_mois: number | null
          experiences: Json | null
          formation_requise: string | null
          id: string
          langue: Json | null
          maladie_handicap: string | null
          nationalite: string | null
          niveau_etude: string | null
          nom: string
          note_operateur: string | null
          numero_cin: string | null
          photo_url: string | null
          prenom: string
          presentation_physique: string | null
          quartier: string | null
          sait_lire_ecrire: boolean | null
          sexe: string | null
          situation_matrimoniale: string | null
          statut_profil: string | null
          telephone: string | null
          type_profil: string | null
          ville: string | null
          whatsapp: string | null
        }
        Insert: {
          a_des_enfants?: boolean | null
          attestation_url?: string | null
          cin_url?: string | null
          corpulence?: string | null
          created_at?: string
          date_naissance?: string | null
          dispo_7j7?: boolean | null
          dispo_journee?: boolean | null
          dispo_jours_feries?: boolean | null
          dispo_soiree?: boolean | null
          dispo_urgences?: boolean | null
          experience_annees?: number | null
          experience_mois?: number | null
          experiences?: Json | null
          formation_requise?: string | null
          id?: string
          langue?: Json | null
          maladie_handicap?: string | null
          nationalite?: string | null
          niveau_etude?: string | null
          nom: string
          note_operateur?: string | null
          numero_cin?: string | null
          photo_url?: string | null
          prenom: string
          presentation_physique?: string | null
          quartier?: string | null
          sait_lire_ecrire?: boolean | null
          sexe?: string | null
          situation_matrimoniale?: string | null
          statut_profil?: string | null
          telephone?: string | null
          type_profil?: string | null
          ville?: string | null
          whatsapp?: string | null
        }
        Update: {
          a_des_enfants?: boolean | null
          attestation_url?: string | null
          cin_url?: string | null
          corpulence?: string | null
          created_at?: string
          date_naissance?: string | null
          dispo_7j7?: boolean | null
          dispo_journee?: boolean | null
          dispo_jours_feries?: boolean | null
          dispo_soiree?: boolean | null
          dispo_urgences?: boolean | null
          experience_annees?: number | null
          experience_mois?: number | null
          experiences?: Json | null
          formation_requise?: string | null
          id?: string
          langue?: Json | null
          maladie_handicap?: string | null
          nationalite?: string | null
          niveau_etude?: string | null
          nom?: string
          note_operateur?: string | null
          numero_cin?: string | null
          photo_url?: string | null
          prenom?: string
          presentation_physique?: string | null
          quartier?: string | null
          sait_lire_ecrire?: boolean | null
          sexe?: string | null
          situation_matrimoniale?: string | null
          statut_profil?: string | null
          telephone?: string | null
          type_profil?: string | null
          ville?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
