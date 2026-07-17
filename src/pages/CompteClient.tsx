/**
 * CompteClient.tsx
 * Page Compte Client : historique fidélité, candidats proposés, blacklist, historique actions.
 */
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { STATUTS, FREQUENCES, STATUT_CANDIDATURE_OPTIONS } from "@/lib/constants";

const JOURS_SEMAINE = [
  { value: "lundi", label: "Lundi" },
  { value: "mardi", label: "Mardi" },
  { value: "mercredi", label: "Mercredi" },
  { value: "jeudi", label: "Jeudi" },
  { value: "vendredi", label: "Vendredi" },
  { value: "samedi", label: "Samedi" },
  { value: "dimanche", label: "Dimanche" },
] as const;

type PlanningJour = {
  jour: string;
  heure_debut: string;
  heure_fin: string;
  statut?: "a_venir" | "terminee";
  rappel_envoye?: boolean;
};

type PlanningSemaine = {
  semaine_debut: string;
  semaine_fin: string;
  jours: PlanningJour[];
  statut?: "en_cours" | "termine";
};

type PlanningAbonnement = {
  // legacy fields (compat ascendante avec ancien format mono-semaine)
  semaine_debut?: string;
  semaine_fin?: string;
  jours?: PlanningJour[];
  // nouveau modèle multi-semaines
  semaines: PlanningSemaine[];
  date_debut: string;
  date_fin: string;
  frequence: string;
  notes?: string;
};
import {
  ChevronDown, ArrowLeft, User, MessageSquare, Clock, CreditCard,
  Users, Phone, MapPin, Calendar as CalendarIcon, Hash, Briefcase,
  FileDown, Eye, Heart, FileText, Save, RefreshCw, Repeat, Star, ThumbsUp, ThumbsDown,
  Ban, History, Plus, Trash2, UserCog, Send
} from "lucide-react";
import { CommercialAffecteModal } from "@/components/dashboard/CommercialAffecteModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tables } from "@/integrations/supabase/types";
import { DevisPreviewModal } from "@/components/pending/DevisPreviewModal";
import { format, parseISO, addDays, startOfMonth, endOfMonth, eachDayOfInterval, addMonths as addMonthsFn, subMonths, isSameDay, isSameMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import { generateDevisPDF, devisDataFromDemande } from "@/lib/devis-generator";
import { cn } from "@/lib/utils";

type Demande = Tables<"demandes">;

// Colored section component
const LIGHT_COLORS = ["#BFDDCE", "#DBAE8D", "#F2E5D3", "#F4A24C"];

function Section({ title, icon: Icon, children, defaultOpen = false, count, colorClass = "bg-card" }: {
  title: string; icon: any; defaultOpen?: boolean; count?: number; children: React.ReactNode; colorClass?: string;
}) {
  const hex = colorClass.match(/#[A-Fa-f0-9]+/)?.[0] || "";
  const isLight = LIGHT_COLORS.includes(hex.toUpperCase());
  const textClass = isLight ? "text-gray-800" : "text-white";
  const iconBg = isLight ? "bg-black/10 text-gray-800" : "bg-white/20 text-white";
  const chevronClass = isLight ? "text-gray-600" : "text-white/70";
  const badgeCls = isLight ? "bg-black/10 text-gray-800 border-0" : "bg-white/20 text-white border-0";

  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className={cn(
        "flex items-center justify-between w-full px-5 py-3.5 rounded-t-xl text-sm font-semibold border border-border hover:shadow-sm transition-all group",
        colorClass, textClass
      )}>
        <span className="flex items-center gap-2.5">
          <span className={cn("flex items-center justify-center h-7 w-7 rounded-lg", iconBg)}>
            <Icon className="h-4 w-4" />
          </span>
          {title}
          {count !== undefined && (
            <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", badgeCls)}>{count}</Badge>
          )}
        </span>
        <ChevronDown className={cn("h-4 w-4 transition-transform group-data-[state=open]:rotate-180", chevronClass)} />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-5 pt-3 pb-4 border border-t-0 border-border rounded-b-xl bg-card">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="py-1">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || "—"}</p>
    </div>
  );
}

export default function CompteClient() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const demandeId = new URLSearchParams(location.search).get("id");
  const from = new URLSearchParams(location.search).get("from") || "/";

  const { data: demande, isLoading } = useQuery({
    queryKey: ["demande", demandeId],
    queryFn: async () => {
      if (!demandeId) return null;
      const { data, error } = await supabase.from("demandes").select("*").eq("id", demandeId).single();
      if (error) throw error;
      return data as Demande;
    },
    enabled: !!demandeId,
  });

  const { data: feedback } = useQuery({
    queryKey: ["feedback_demande", demandeId],
    queryFn: async () => {
      if (!demandeId) return null;
      const { data } = await supabase.from("feedbacks").select("*").eq("demande_id", demandeId).maybeSingle();
      return data;
    },
    enabled: !!demandeId,
  });

  // All feedbacks for this client (by name)
  const { data: allClientFeedbacks = [] } = useQuery({
    queryKey: ["feedbacks_client", demande?.nom],
    queryFn: async () => {
      if (!demande?.nom) return [];
      const { data, error } = await supabase
        .from("feedbacks")
        .select("*")
        .ilike("nom_client", demande.nom.trim())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!demande?.nom,
  });

  // Facturation for this demande (candidat payment info)
  const { data: facturation } = useQuery({
    queryKey: ["facturation_demande", demandeId],
    queryFn: async () => {
      if (!demandeId) return null;
      const { data } = await supabase.from("facturation").select("*").eq("demande_id", demandeId).maybeSingle();
      return data;
    },
    enabled: !!demandeId,
  });

  // Historique des actions pour cette demande
  const { data: demandeHistorique = [] } = useQuery({
    queryKey: ["demande_historique", demandeId],
    queryFn: async () => {
      if (!demandeId) return [];
      const { data, error } = await supabase
        .from("demande_historique")
        .select("*")
        .eq("demande_id", demandeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!demandeId,
  });

  const [detailFeedback, setDetailFeedback] = useState<any>(null);

  // Count all demandes for this client (fidélité)
  const { data: allClientDemandes = [] } = useQuery({
    queryKey: ["demandes", "client_fidelite", demande?.nom],
    queryFn: async () => {
      if (!demande?.nom) return [];
      const { data, error } = await supabase
        .from("demandes")
        .select("*")
        .ilike("nom", demande.nom.trim())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Demande[];
    },
    enabled: !!demande?.nom,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      if (!demandeId) return;
      const { error } = await supabase.from("demandes").update(updates).eq("id", demandeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demande", demandeId] });
      queryClient.invalidateQueries({ queryKey: ["demandes"] });
      toast({ title: "Mis à jour avec succès" });
    },
  });

  const [noteComm, setNoteComm] = useState("");
  const [noteOpe, setNoteOpe] = useState("");
  const [aboNote, setAboNote] = useState("");
  const [aboDate, setAboDate] = useState<Date | undefined>();
  const notesInitialized = useState(false);
  const [planning, setPlanning] = useState<PlanningAbonnement>({
    semaines: [], date_debut: "", date_fin: "",
    frequence: "", notes: "",
  });
  const [planningInitialized, setPlanningInitialized] = useState(false);
  const [aboTermine, setAboTermine] = useState(false);
  // Gestion de l'abonnement (nouveau formulaire simplifié)
  const [aboFrequence, setAboFrequence] = useState<string>("");
  const [aboDateDebut, setAboDateDebut] = useState<string>("");
  const [aboDureeMois, setAboDureeMois] = useState<number>(1);
  const [aboJours, setAboJours] = useState<{ jour: string; heure_debut: string; heure_fin: string }[]>([]);
  const [aboNotes, setAboNotes] = useState<string>("");
  const [aboFormInitialized, setAboFormInitialized] = useState(false);
  const [aboCalMonth, setAboCalMonth] = useState<Date>(() => new Date());
  const [aboDateOverrides, setAboDateOverrides] = useState<Record<string, { heure?: string; heure_fin?: string; excluded?: boolean; statut?: "termine" | "annule" | "a_recuperer" | null; reprogrammed_to?: string | null; reprogrammed_from?: string | null }>>({});
  // Date cible saisie temporairement pour la reprogrammation d'un crédit "à récupérer".
  const [reprogTarget, setReprogTarget] = useState<Record<string, string>>({});
  // Source sélectionnée pour "Utiliser un crédit" depuis un jour libre.
  const [useCreditSource, setUseCreditSource] = useState<Record<string, string>>({});
  const [aboFactureGeneree, setAboFactureGeneree] = useState(false);
  const [devisModalOpen, setDevisModalOpen] = useState(false);
  const [aboFactureEnvoyee, setAboFactureEnvoyee] = useState(false);
  const [aboStatut, setAboStatut] = useState<"actif" | "suspendu" | "pause">("actif");
  // Facturation au prorata : clé "yyyy-MM" -> { debut, fin } (dates ISO)
  const [aboProrata, setAboProrata] = useState<Record<string, { debut: string; fin: string }>>({});

  // Renouveler & Switcher modals
  const [renewOpen, setRenewOpen] = useState(false);
  const [switchAboOpen, setSwitchAboOpen] = useState(false);
  const [selectedFrequence, setSelectedFrequence] = useState("");
  const [aboNbPersonnes, setAboNbPersonnes] = useState("");
  const [aboNbHeures, setAboNbHeures] = useState("");
  const [activeDemande, setActiveDemande] = useState<Demande | null>(null);
  const [commercialModalOpen, setCommercialModalOpen] = useState(false);

  // Renew form state (pre-filled from current demande)
  const [renewForm, setRenewForm] = useState<Record<string, unknown>>({});
  const [renewInitialized, setRenewInitialized] = useState(false);

  if (demande && !notesInitialized[0]) {
    setNoteComm(demande.note_commercial || "");
    setNoteOpe(demande.note_operationnel || "");
    notesInitialized[1](true);
  }

  if (demande && !planningInitialized) {
    const p = ((demande as any).planning || {}) as any;
    // Compat ancien format mono-semaine
    let semaines: PlanningSemaine[] = [];
    if (Array.isArray(p.semaines) && p.semaines.length > 0) {
      semaines = p.semaines.map((s: any) => ({
        semaine_debut: s.semaine_debut || "",
        semaine_fin: s.semaine_fin || "",
        jours: Array.isArray(s.jours) ? s.jours : [],
      }));
    } else if (Array.isArray(p.jours)) {
      const legacyJours: PlanningJour[] =
        p.jours.length > 0 && typeof p.jours[0] === "string"
          ? p.jours.map((j: string) => ({
              jour: j,
              heure_debut: p.heure_debut || "",
              heure_fin: p.heure_fin || "",
            }))
          : (p.jours as PlanningJour[]);
      if (legacyJours.length > 0 || p.semaine_debut || p.semaine_fin) {
        semaines = [{
          semaine_debut: p.semaine_debut || "",
          semaine_fin: p.semaine_fin || "",
          jours: legacyJours,
        }];
      }
    }
    setPlanning({
      semaines,
      date_debut: p.date_debut || "",
      date_fin: p.date_fin || "",
      frequence: p.frequence || demande.frequence || "",
      notes: p.notes || "",
    });
    setPlanningInitialized(true);
  }

  if (demande && !aboFormInitialized) {
    const p = ((demande as any).planning || {}) as any;
    setAboFrequence(p.abo_frequence || p.frequence || demande.frequence || "");
    setAboDateDebut(p.date_debut || "");
    if (p.date_debut) { try { setAboCalMonth(parseISO(p.date_debut)); } catch { /* noop */ } }
    setAboDureeMois(typeof p.duree_mois === "number" ? p.duree_mois : 1);
    if (Array.isArray(p.abo_jours)) {
      setAboJours(p.abo_jours);
    } else if (Array.isArray(p.jours) && p.jours.length > 0) {
      setAboJours(
        p.jours.map((j: any) =>
          typeof j === "string"
            ? { jour: j, heure_debut: "", heure_fin: "" }
            : { jour: j.jour, heure_debut: j.heure_debut || j.heure || "", heure_fin: j.heure_fin || "" }
        )
      );
    }
    setAboNotes(p.notes || "");
    if (p.date_overrides && typeof p.date_overrides === "object") setAboDateOverrides(p.date_overrides);
    const validStatut = ["actif", "suspendu", "pause"].includes(p.abo_statut) ? p.abo_statut : "actif";
    setAboStatut(validStatut as "actif" | "suspendu" | "pause");
    setAboFormInitialized(true);

  }

  if (demande && !renewInitialized) {
    setRenewForm({
      nom: demande.nom,
      telephone_direct: demande.telephone_direct,
      telephone_whatsapp: demande.telephone_whatsapp,
      type_service: demande.type_service,
      type_prestation: demande.type_prestation,
      type_bien: demande.type_bien,
      frequence: demande.frequence,
      ville: demande.ville,
      quartier: demande.quartier,
      adresse: demande.adresse,
      montant_total: demande.montant_total,
      duree_heures: demande.duree_heures,
      nombre_intervenants: demande.nombre_intervenants,
      avec_produit: demande.avec_produit,
      email: (demande as any).email,
      nom_entreprise: (demande as any).nom_entreprise,
      contact_entreprise: (demande as any).contact_entreprise,
    });
    setRenewInitialized(true);
  }

  const createRenewalMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const { error } = await supabase.from("demandes").insert(data as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demandes"] });
      toast({ title: "Demande renouvelée", description: "Une nouvelle demande a été créée avec succès." });
      setRenewOpen(false);
    },
  });

  const switchToAboMutation = useMutation({
    mutationFn: async (frequence: string) => {
      const targetId = activeDemande?.id || demandeId;
      if (!targetId) return;
      const { error } = await supabase.from("demandes").update({ frequence }).eq("id", targetId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demande", demandeId] });
      queryClient.invalidateQueries({ queryKey: ["demandes"] });
      toast({ title: "Abonnement activé", description: "La demande a été convertie en abonnement." });
      setSwitchAboOpen(false);
      setActiveDemande(null);
    },
  });

  const handleRenew = () => {
    createRenewalMutation.mutate({
      ...renewForm,
      services_optionnels: "[]",
      statut: "nouveau_besoin",
    });
  };

  const openRenewForDemande = (d: Demande) => {
    setRenewForm({
      nom: d.nom,
      telephone_direct: d.telephone_direct,
      telephone_whatsapp: d.telephone_whatsapp,
      type_service: d.type_service,
      type_prestation: d.type_prestation,
      type_bien: d.type_bien,
      frequence: d.frequence,
      ville: d.ville,
      quartier: d.quartier,
      adresse: d.adresse,
      montant_total: d.montant_total,
      duree_heures: d.duree_heures,
      nombre_intervenants: d.nombre_intervenants,
      avec_produit: d.avec_produit,
      email: (d as any).email,
      nom_entreprise: (d as any).nom_entreprise,
      contact_entreprise: (d as any).contact_entreprise,
    });
    setActiveDemande(d);
    setRenewOpen(true);
  };

  const openSwitchForDemande = (d: Demande) => {
    setActiveDemande(d);
    setSelectedFrequence("");
    setSwitchAboOpen(true);
  };

  // Tarif calculation for subscription based on frequency
  const calculateAboTarif = (baseTarif: number | null, freq: string) => {
    if (!baseTarif) return null;
    const multipliers: Record<string, number> = {
      hebdomadaire: 4,
      bi_mensuel: 2,
      mensuel: 1,
      quotidien: 28,
    };
    return baseTarif * (multipliers[freq] || 1);
  };

  const fideliteCount = allClientDemandes.length;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Chargement du compte client...</p>
      </div>
    );
  }

  if (!demande) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <User className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground font-medium">Demande introuvable</p>
        <Button variant="outline" size="sm" onClick={() => navigate(from)}>
          <ArrowLeft className="h-4 w-4 mr-1" />Retour
        </Button>
      </div>
    );
  }

  const d = demande as any;
  const s = STATUTS[demande.statut as keyof typeof STATUTS];
  const freq = FREQUENCES.find(f => f.value === demande.frequence);
  const statutCand = STATUT_CANDIDATURE_OPTIONS.find(sc => sc.value === d.statut_candidature);
  const isReservation = ["confirme", "confirme_intervention", "prestation_terminee", "paye"].includes(demande.statut);

  const saveNotes = () => {
    updateMutation.mutate({ note_commercial: noteComm || null, note_operationnel: noteOpe || null });
  };

  const genererFacture = () => {
    setDevisModalOpen(true);
  };


  const envoyerFacture = () => {
    setAboFactureEnvoyee(true);
    toast({ title: "Facture envoyée", description: "La facture a été marquée comme envoyée au client." });
  };

  const order = JOURS_SEMAINE.map((j) => j.value) as readonly string[];

  const addSemaine = () => {
    setPlanning((prev) => ({
      ...prev,
      semaines: [...prev.semaines, { semaine_debut: "", semaine_fin: "", jours: [], statut: "en_cours" }],
    }));
  };




  // Ajoute 4 semaines consécutives (mois suivant), à partir de la dernière semaine ou de date_debut
  const addNextMonth = () => {
    setPlanning((prev) => {
      const lastDebut = [...prev.semaines]
        .map((s) => s.semaine_debut)
        .filter(Boolean)
        .sort()
        .pop();
      const baseStr = lastDebut || prev.date_debut;
      let base: Date;
      try { base = baseStr ? parseISO(baseStr) : new Date(); } catch { base = new Date(); }
      const startFirst = lastDebut ? addDays(base, 7) : base;
      const newSem: PlanningSemaine[] = Array.from({ length: 4 }).map((_, i) => {
        const debut = addDays(startFirst, i * 7);
        return {
          semaine_debut: format(debut, "yyyy-MM-dd"),
          semaine_fin: format(addDays(debut, 6), "yyyy-MM-dd"),
          jours: [],
          statut: "en_cours",
        };
      });
      return { ...prev, semaines: [...prev.semaines, ...newSem] };
    });
  };

  const removeMois = (indexes: number[]) => {
    const setIdx = new Set(indexes);
    setPlanning((prev) => ({ ...prev, semaines: prev.semaines.filter((_, i) => !setIdx.has(i)) }));
  };

  const toggleSemaineStatut = (idx: number) => {
    setPlanning((prev) => ({
      ...prev,
      semaines: prev.semaines.map((s, i) =>
        i === idx ? { ...s, statut: s.statut === "termine" ? "en_cours" : "termine" } : s
      ),
    }));
  };

  const removeSemaine = (idx: number) => {
    setPlanning((prev) => ({
      ...prev,
      semaines: prev.semaines.filter((_, i) => i !== idx),
    }));
  };

  const updateSemaineDate = (idx: number, field: "semaine_debut" | "semaine_fin", value: string) => {
    setPlanning((prev) => ({
      ...prev,
      semaines: prev.semaines.map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    }));
  };

  const togglePlanningJour = (idx: number, jour: string) => {
    setPlanning((prev) => ({
      ...prev,
      semaines: prev.semaines.map((s, i) => {
        if (i !== idx) return s;
        const exists = s.jours.find((j) => j.jour === jour);
        const jours = exists
          ? s.jours.filter((j) => j.jour !== jour)
          : [...s.jours, { jour, heure_debut: "", heure_fin: "" }];
        jours.sort((a, b) => order.indexOf(a.jour) - order.indexOf(b.jour));
        return { ...s, jours };
      }),
    }));
  };

  const updatePlanningJourHeure = (
    idx: number, jour: string, field: "heure_debut" | "heure_fin", value: string
  ) => {
    setPlanning((prev) => ({
      ...prev,
      semaines: prev.semaines.map((s, i) =>
        i === idx
          ? { ...s, jours: s.jours.map((j) => (j.jour === jour ? { ...j, [field]: value } : j)) }
          : s
      ),
    }));
  };

  const toggleJourStatut = (idx: number, jour: string) => {
    setPlanning((prev) => ({
      ...prev,
      semaines: prev.semaines.map((s, i) =>
        i === idx
          ? {
              ...s,
              jours: s.jours.map((j) =>
                j.jour === jour
                  ? { ...j, statut: j.statut === "terminee" ? "a_venir" : "terminee" }
                  : j,
              ),
            }
          : s,
      ),
    }));
  };

  const savePlanning = () => {
    const updates: Record<string, unknown> = { planning: planning as any };
    if (planning.frequence && planning.frequence !== demande.frequence) {
      updates.frequence = planning.frequence;
    }
    // Auto-passage en "prestation_terminee" si tous les jours de toutes les semaines sont terminés
    const allJours = planning.semaines.flatMap((s) => s.jours);
    if (
      allJours.length > 0 &&
      allJours.every((j) => j.statut === "terminee") &&
      demande.statut !== "prestation_terminee" &&
      demande.statut !== "paye" &&
      demande.statut !== "facturation_annulee"
    ) {
      updates.statut = "prestation_terminee";
    }
    if (aboTermine && demande.statut !== "paye" && demande.statut !== "facturation_annulee") {
      updates.statut = "prestation_terminee";
    }
    updateMutation.mutate(updates);
  };

  // Mock history actions (future: store in a separate table)
  const historyActions = [
    { user: "Système", date: demande.created_at, action: "Demande créée", note: "" },
    ...(demande.confirmed_at ? [{ user: "Commercial", date: demande.confirmed_at, action: "Demande confirmée", note: "" }] : []),
    ...(demande.confirmation_ope === "confirme" ? [{ user: "Opérationnel", date: demande.confirmed_at || demande.created_at, action: "Confirmation opérationnelle", note: demande.note_operationnel || "" }] : []),
    ...(demande.statut === "annulee" ? [{ user: "Commercial", date: demande.created_at, action: "Demande annulée", note: demande.motif_annulation || "" }] : []),
  ];

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate(from)} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />Retour
          </Button>
          <Separator orientation="vertical" className="h-8" />
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-md">
              {demande.nom.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-foreground leading-tight">{demande.nom}</h1>
                <Badge variant="outline" className="text-[10px] border-primary/30 text-primary font-semibold">
                  <Heart className="h-3 w-3 mr-1" /> x{fideliteCount}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground font-mono">#{demande.num_demande}</span>
                <Badge className={demande.type_service === "SPP" ? "bg-primary text-primary-foreground text-[10px]" : "bg-spe text-spe-foreground text-[10px]"}>
                  {demande.type_service === "SPP" ? "Particulier" : "Entreprise"}
                </Badge>
                {s && (
                  <Badge variant="outline" className="border-0 text-[10px] font-medium" style={{ backgroundColor: s.hex, color: "#ffffff" }}>
                    {s.label}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCommercialModalOpen(true)}>
            <UserCog className="h-3.5 w-3.5" />
            Commercial affecté{demande.commercial ? ` : ${demande.commercial}` : ""}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openRenewForDemande(demande)}>
            <RefreshCw className="h-3.5 w-3.5" /> Renouveler
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10">
            <Ban className="h-3.5 w-3.5" /> Black lister
          </Button>
        </div>
      </div>

      <CommercialAffecteModal
        demande={demande}
        open={commercialModalOpen}
        onOpenChange={setCommercialModalOpen}
      />

      {/* Sections */}
      <div className="space-y-3">

        {/* Infos Client - full width */}
        <Section title="Informations Client" icon={User} defaultOpen colorClass="bg-[#027A76]">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1">
            <InfoItem label="Nom complet" value={demande.nom} />
            <InfoItem label="Segment" value={demande.type_service === "SPP" ? "Particulier" : "Entreprise"} />
            <InfoItem label="Téléphone direct" value={demande.telephone_direct} />
            <InfoItem label="WhatsApp" value={demande.telephone_whatsapp} />
            <InfoItem label="Email" value={d.email} />
            <InfoItem label="Ville" value={demande.ville} />
            <InfoItem label="Quartier" value={demande.quartier} />
            <InfoItem label="Adresse" value={demande.adresse} />
            {d.nom_entreprise && <InfoItem label="Entreprise" value={d.nom_entreprise} />}
            {d.contact_entreprise && <InfoItem label="Contact entreprise" value={d.contact_entreprise} />}
          </div>
        </Section>

        {/* Historique Fidélité - full width below */}
        <Section title="Historique Fidélité" icon={Heart} defaultOpen colorClass="bg-[#E86C4F]" count={fideliteCount}>
          {allClientDemandes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Nom du service</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allClientDemandes.map((cd) => {
                  const cs = STATUTS[cd.statut as keyof typeof STATUTS];
                  return (
                    <TableRow key={cd.id}>
                      <TableCell className="text-xs">{format(new Date(cd.created_at), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="text-sm font-medium">{cd.type_prestation}</TableCell>
                      <TableCell>
                        <Badge className={cd.type_service === "SPP" ? "bg-primary text-primary-foreground text-[10px]" : "bg-spe text-spe-foreground text-[10px]"}>
                          {cd.type_service === "SPP" ? "Particulier" : "Entreprise"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {cs ? (
                          <Badge variant="outline" className="border-0 text-[10px]" style={{ backgroundColor: cs.hex, color: "#fff" }}>
                            {cs.label}
                          </Badge>
                        ) : cd.statut}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => openRenewForDemande(cd)}>
                            <RefreshCw className="h-3 w-3" /> Renouveler
                          </Button>
                          {cd.frequence === "ponctuel" && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => openSwitchForDemande(cd)}>
                              <Repeat className="h-3 w-3" /> Abonnement
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Voir détails"
                            onClick={() => navigate(`/compte-client?id=${cd.id}&from=${location.pathname}${location.search}`)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Télécharger">
                            <FileDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">Aucun historique de fidélité.</p>
          )}
        </Section>

        {/* Row: Avis commercial + Avis opérationnel */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Section title="Avis Service Commercial" icon={MessageSquare} defaultOpen colorClass="bg-[#F4A24C]">
            <Textarea
              value={noteComm}
              onChange={(e) => setNoteComm(e.target.value)}
              rows={3}
              placeholder="Saisir un avis commercial..."
              className="resize-none bg-background/60 border-border focus:bg-background"
            />
          </Section>

          <Section title="Avis Service Opérationnel" icon={MessageSquare} defaultOpen colorClass="bg-[#DBAE8D]">
            <Textarea
              value={noteOpe}
              onChange={(e) => setNoteOpe(e.target.value)}
              rows={3}
              placeholder="Saisir un avis opérationnel..."
              className="resize-none bg-background/60 border-border focus:bg-background"
            />
          </Section>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={saveNotes} disabled={updateMutation.isPending} className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> Enregistrer les avis
          </Button>
        </div>

        {/* Gestion de l'abonnement */}
        <Section title="Gestion de l'abonnement" icon={Clock} defaultOpen colorClass="bg-[#BFDDCE]">
          <Button variant="outline" size="sm" className="mb-3" onClick={() => navigate("/gestion-abonnement")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Retour à Gestion Abonnement
          </Button>
          {(() => {
            const ABO_FREQ_OPTIONS = [
              { value: "1_fois_semaine", label: "1 fois par semaine", maxJours: 1 },
              { value: "2_fois_semaine", label: "2 fois par semaine", maxJours: 2 },
              { value: "3_fois_semaine", label: "3 fois par semaine", maxJours: 3 },
              { value: "bi_hebdomadaire", label: "Toutes les 2 semaines", maxJours: 1 },
              { value: "1_fois_mois", label: "1 fois par mois", maxJours: 1 },
            ];
            const DUREE_OPTIONS = [
              { value: 1, label: "1 mois" },
              { value: 3, label: "3 mois" },
              { value: 6, label: "6 mois" },
              { value: 12, label: "12 mois" },
            ];
            const currentFreq = ABO_FREQ_OPTIONS.find((f) => f.value === aboFrequence);
            const maxJours = currentFreq?.maxJours ?? 7;

            // Date de fin auto = date de début + 1 mois (l'abonnement dure toujours 1 mois)
            const dateFinAuto = (() => {
              if (!aboDateDebut) return "";
              try {
                const d = parseISO(aboDateDebut);
                const end = new Date(d);
                end.setMonth(end.getMonth() + 1);
                end.setDate(end.getDate() - 1);
                return format(end, "yyyy-MM-dd");
              } catch { return ""; }
            })();


            const toggleJour = (jour: string) => {
              setAboJours((prev) => {
                const exists = prev.find((j) => j.jour === jour);
                if (exists) return prev.filter((j) => j.jour !== jour);
                if (prev.length >= maxJours) {
                  toast({
                    title: "Nombre de jours max atteint",
                    description: `Cette fréquence autorise ${maxJours} jour(s).`,
                    variant: "destructive",
                  });
                  return prev;
                }
                const next = [...prev, { jour, heure_debut: "", heure_fin: "" }];
                next.sort(

                  (a, b) =>
                    JOURS_SEMAINE.findIndex((x) => x.value === a.jour) -
                    JOURS_SEMAINE.findIndex((x) => x.value === b.jour),
                );
                return next;
              });
            };
            const setJourHeureField = (jour: string, field: "heure_debut" | "heure_fin", value: string) => {
              setAboJours((prev) => prev.map((j) => (j.jour === jour ? { ...j, [field]: value } : j)));
            };

            // Calcul du nombre total d'interventions (cumul sur toute la période)
            const totalInterventions = (() => {
              if (!aboDateDebut || !dateFinAuto || aboJours.length === 0 || !aboFrequence) return 0;
              const dayMap: Record<string, number> = {
                dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6,
              };
              const selected = aboJours.map((j) => dayMap[j.jour]).filter((n) => n !== undefined);
              if (selected.length === 0) return 0;
              let start: Date, end: Date;
              try { start = parseISO(aboDateDebut); end = parseISO(dateFinAuto); }
              catch { return 0; }
              if (end < start) return 0;
              const startMs = start.getTime();
              const seenMonth = new Set<string>();
              let count = 0;
              for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
                if (!selected.includes(d.getDay())) continue;
                if (aboFrequence === "bi_hebdomadaire") {
                  const weekNo = Math.floor((d.getTime() - startMs) / (7 * 24 * 3600 * 1000));
                  if (weekNo % 2 !== 0) continue;
                }
                if (aboFrequence === "1_fois_mois") {
                  const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDay()}`;
                  if (seenMonth.has(key)) continue;
                  seenMonth.add(key);
                }
                count++;
              }
              return count;
            })();

            // Nombre d'interventions estimé pour le mois sélectionné (avec ou sans prorata)
            // Les interventions marquées "annulé" sont déduites du total et comptées à part.
            const _computeInterventions = (applyProrata: boolean) => {
              if (!aboDateDebut || !dateFinAuto || aboJours.length === 0 || !aboFrequence) return { total: 0, cancelled: 0 };
              const dayMap: Record<string, number> = {
                dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6,
              };
              const selected = aboJours.map((j) => dayMap[j.jour]).filter((n) => n !== undefined);
              if (selected.length === 0) return { total: 0, cancelled: 0 };
              let start: Date, end: Date;
              try { start = parseISO(aboDateDebut); end = parseISO(dateFinAuto); }
              catch { return { total: 0, cancelled: 0, aRecup: 0, reportes: 0 }; }
              if (end < start) return { total: 0, cancelled: 0, aRecup: 0, reportes: 0 };
              const monthStart = startOfMonth(aboCalMonth);
              const monthEnd = endOfMonth(aboCalMonth);
              let effectiveStart = start > monthStart ? start : monthStart;
              let effectiveEnd = end < monthEnd ? end : monthEnd;
              if (applyProrata) {
                const _mk = format(aboCalMonth, "yyyy-MM");
                const _pr = aboProrata[_mk];
                if (_pr?.debut) { try { const d = parseISO(_pr.debut); if (d > effectiveStart) effectiveStart = d; } catch {} }
                if (_pr?.fin) { try { const d = parseISO(_pr.fin); if (d < effectiveEnd) effectiveEnd = d; } catch {} }
              }
              if (effectiveStart > effectiveEnd) return { total: 0, cancelled: 0, aRecup: 0, reportes: 0 };
              const startMs = start.getTime();
              const seenMonth = new Set<string>();
              const interventionSet = new Set<string>();
              for (let d = new Date(effectiveStart); d <= effectiveEnd; d = addDays(d, 1)) {
                if (!selected.includes(d.getDay())) continue;
                if (aboFrequence === "bi_hebdomadaire") {
                  const weekNo = Math.floor((d.getTime() - startMs) / (7 * 24 * 3600 * 1000));
                  if (weekNo % 2 !== 0) continue;
                }
                if (aboFrequence === "1_fois_mois") {
                  const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDay()}`;
                  if (seenMonth.has(key)) continue;
                  seenMonth.add(key);
                }
                interventionSet.add(format(d, "yyyy-MM-dd"));
              }

              let patternCount = 0;
              let patternCancelled = 0;
              let patternARecup = 0;
              Array.from(interventionSet).forEach((k) => {
                const ov = aboDateOverrides[k];
                if (ov?.excluded) return;
                if (ov?.statut === "annule") patternCancelled++;
                else if (ov?.statut === "a_recuperer") patternARecup++;
                else patternCount++;
              });

              let overrideCount = 0;
              let overrideCancelled = 0;
              let overrideARecup = 0;
              let overrideReportes = 0;
              Object.entries(aboDateOverrides).forEach(([k, v]) => {
                if (v.excluded || !v.heure) return;
                let od: Date;
                try { od = parseISO(k); } catch { return; }
                if (!isSameMonth(od, aboCalMonth) || od < start || od > end || interventionSet.has(k)) return;
                if (v.statut === "annule") overrideCancelled++;
                else if (v.statut === "a_recuperer") overrideARecup++;
                else {
                  overrideCount++;
                  if (v.reprogrammed_from) overrideReportes++;
                }
              });

              return {
                total: patternCount + overrideCount,
                cancelled: patternCancelled + overrideCancelled,
                aRecup: patternARecup + overrideARecup,
                reportes: overrideReportes,
              };
            };
            const { total: monthlyInterventions, cancelled: cancelledInterventions, aRecup: aRecupMois, reportes: reportesMois } = _computeInterventions(true);

            // Crédits globaux "à récupérer" (tout l'abonnement, non encore reprogrammés)
            const pendingCreditsGlobal = Object.values(aboDateOverrides).filter(
              (v) => v?.statut === "a_recuperer" && !v?.reprogrammed_to,
            ).length;
            // Sources disponibles pour reprogrammation (clé + libellé date)
            const availableCreditSources = Object.entries(aboDateOverrides)
              .filter(([, v]) => v?.statut === "a_recuperer" && !v?.reprogrammed_to)
              .map(([k]) => k)
              .sort();

            const isValid = aboFrequence && aboDateDebut && aboJours.length > 0;

            const handleSave = () => {
              if (!isValid) {
                toast({
                  title: "Formulaire incomplet",
                  description: "Sélectionnez une fréquence, une date de démarrage et au moins un jour.",
                  variant: "destructive",
                });
                return;
              }
              const newPlanning = {
                abo_frequence: aboFrequence,
                abo_jours: aboJours,
                abo_statut: aboStatut,
                date_debut: aboDateDebut,
                date_fin: dateFinAuto,
                duree_mois: aboDureeMois,
                frequence: aboFrequence,
                notes: aboNotes,
                date_overrides: aboDateOverrides,
                total_interventions_estime: totalInterventions,
              };
              const updates: Record<string, unknown> = { planning: newPlanning as any };
              // Ne synchroniser demandes.frequence que si la valeur existe dans le référentiel

              if (FREQUENCES.some((f) => f.value === aboFrequence)) {
                updates.frequence = aboFrequence;
              }
              updateMutation.mutate(updates);
            };

            const handleActiverMoisProchain = () => {
              if (!aboDateDebut) {
                toast({
                  title: "Date de démarrage manquante",
                  description: "Renseignez d'abord la date de démarrage de l'abonnement.",
                  variant: "destructive",
                });
                return;
              }
              const newDuree = aboDureeMois + 1;
              setAboDureeMois(newDuree);
              setAboStatut("actif");
              // Nouveau mois ajouté = début + (newDuree - 1) mois
              const start = parseISO(aboDateDebut);
              const newMonth = new Date(start);
              newMonth.setMonth(newMonth.getMonth() + (newDuree - 1));
              newMonth.setDate(1);
              setAboCalMonth(newMonth);
              const end = new Date(start);
              end.setMonth(end.getMonth() + newDuree);
              end.setDate(end.getDate() - 1);
              const newPlanning = {
                abo_frequence: aboFrequence,
                abo_jours: aboJours,
                abo_statut: "actif",
                date_debut: aboDateDebut,
                date_fin: format(end, "yyyy-MM-dd"),
                duree_mois: newDuree,
                frequence: aboFrequence,
                notes: aboNotes,
                date_overrides: aboDateOverrides,
                total_interventions_estime: totalInterventions,
              };
              const updates: Record<string, unknown> = { planning: newPlanning as any };
              if (FREQUENCES.some((f) => f.value === aboFrequence)) {
                updates.frequence = aboFrequence;
              }
              updateMutation.mutate(updates, {
                onSuccess: () => {
                  toast({ title: "Mois ajouté", description: `Nouveau mois : ${format(newMonth, "MMMM yyyy", { locale: fr })}.` });
                },
              });
            };

            // Statut d'un mois selon la date du jour
            const _today = new Date();
            const getMonthStatus = (m: Date): "termine" | "en_cours" | "attente" => {
              const ms = startOfMonth(m); const me = endOfMonth(m);
              if (me < _today) return "termine";
              if (ms > _today) return "attente";
              return "en_cours";
            };
            const MONTH_STATUS_LABEL: Record<string, string> = {
              termine: "Terminé",
              en_cours: "En cours",
              attente: "En attente de confirmation",
            };
            // Palette rotative : couleur unique par index de mois (indépendant du statut)
            const MONTH_TAB_PALETTE: { active: string; idle: string; badge: string }[] = [
              { active: "bg-sky-100 border-sky-400 text-sky-800", idle: "bg-sky-50/60 border-sky-200 text-sky-700 hover:bg-sky-100", badge: "bg-sky-500/20 text-sky-800" },
              { active: "bg-violet-100 border-violet-400 text-violet-800", idle: "bg-violet-50/60 border-violet-200 text-violet-700 hover:bg-violet-100", badge: "bg-violet-500/20 text-violet-800" },
              { active: "bg-rose-100 border-rose-400 text-rose-800", idle: "bg-rose-50/60 border-rose-200 text-rose-700 hover:bg-rose-100", badge: "bg-rose-500/20 text-rose-800" },
              { active: "bg-orange-100 border-orange-400 text-orange-800", idle: "bg-orange-50/60 border-orange-200 text-orange-700 hover:bg-orange-100", badge: "bg-orange-500/20 text-orange-800" },
              { active: "bg-emerald-100 border-emerald-400 text-emerald-800", idle: "bg-emerald-50/60 border-emerald-200 text-emerald-700 hover:bg-emerald-100", badge: "bg-emerald-500/20 text-emerald-800" },
              { active: "bg-fuchsia-100 border-fuchsia-400 text-fuchsia-800", idle: "bg-fuchsia-50/60 border-fuchsia-200 text-fuchsia-700 hover:bg-fuchsia-100", badge: "bg-fuchsia-500/20 text-fuchsia-800" },
              { active: "bg-teal-100 border-teal-400 text-teal-800", idle: "bg-teal-50/60 border-teal-200 text-teal-700 hover:bg-teal-100", badge: "bg-teal-500/20 text-teal-800" },
              { active: "bg-indigo-100 border-indigo-400 text-indigo-800", idle: "bg-indigo-50/60 border-indigo-200 text-indigo-700 hover:bg-indigo-100", badge: "bg-indigo-500/20 text-indigo-800" },
            ];
            const currentMonthKey = format(aboCalMonth, "yyyy-MM");
            const currentProrata = aboProrata[currentMonthKey];
            const proratActif = !!currentProrata;
            const _monthStartStr = format(startOfMonth(aboCalMonth), "yyyy-MM-dd");
            const _monthEndStr = format(endOfMonth(aboCalMonth), "yyyy-MM-dd");
            const setProrata = (patch: Partial<{ debut: string; fin: string }> | null) => {
              setAboProrata((prev) => {
                const next = { ...prev };
                if (patch === null) { delete next[currentMonthKey]; return next; }
                const cur = next[currentMonthKey] || { debut: _monthStartStr, fin: _monthEndStr };
                next[currentMonthKey] = { ...cur, ...patch };
                return next;
              });
            };

            return (
              <div className="space-y-5">
                {/* Onglets mensuels — un onglet par clic sur "Activer le mois prochain" */}
                {aboDateDebut && (() => {
                  let start: Date;
                  try { start = parseISO(aboDateDebut); }
                  catch { return null; }
                  const nbMonths = Math.max(1, aboDureeMois || 1);
                  const months: Date[] = [];
                  let cur = startOfMonth(start);
                  for (let i = 0; i < nbMonths; i++) {
                    months.push(cur);
                    cur = addMonthsFn(cur, 1);
                  }
                  if (months.length === 0) return null;
                  const activeIdx = months.findIndex((m) => isSameMonth(m, aboCalMonth));
                  return (
                    <div className="flex flex-wrap items-end justify-between gap-2 -mb-3 border-b border-border/50 pb-0">
                      <div className="flex flex-wrap gap-1.5">
                        {months.map((m, i) => {
                          const active = i === activeIdx;
                          const st = getMonthStatus(m);
                          const palette = MONTH_TAB_PALETTE[i % MONTH_TAB_PALETTE.length];
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setAboCalMonth(m)}
                              className={cn(
                                "px-3 py-1.5 rounded-t-lg text-xs font-semibold border border-b-0 transition-colors -mb-px flex items-center gap-1.5",
                                active ? palette.active : palette.idle,
                              )}
                              title={`Mois ${i + 1}`}
                            >
                              <span>Mois {i + 1}</span>
                            </button>
                          );
                        })}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleActiverMoisProchain}
                        disabled={!isValid || updateMutation.isPending}
                        className="h-8 text-xs gap-1.5 -mb-px rounded-t-lg border-b-0"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Activer le mois prochain
                      </Button>
                    </div>
                  );
                })()}



                {/* Ligne d'actions : statut + facture + enregistrer */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 p-3 rounded-xl border bg-background">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Statut abonnement</span>
                    <Select
                      value={aboStatut}
                      onValueChange={(v) => setAboStatut(v as "actif" | "suspendu" | "pause")}
                    >
                      <SelectTrigger className="h-8 w-40 text-xs bg-background">
                        <SelectValue placeholder="Statut" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="actif" className="text-xs">Actif</SelectItem>
                        <SelectItem value="suspendu" className="text-xs">Suspendus</SelectItem>
                        <SelectItem value="pause" className="text-xs">En pause</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant={aboFactureGeneree ? "default" : "outline"} onClick={genererFacture} className="h-8 text-xs gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      {aboFactureGeneree ? "Facture générée" : "Générer facture"}
                    </Button>
                    <Button size="sm" variant={aboFactureEnvoyee ? "default" : "outline"} onClick={envoyerFacture} disabled={!aboFactureGeneree} className="h-8 text-xs gap-1.5">
                      <Send className="h-3.5 w-3.5" />
                      {aboFactureEnvoyee ? "Facture envoyée" : "Envoyer facture"}
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={!isValid || updateMutation.isPending} className="h-8 text-xs gap-1.5">
                      <Save className="h-3.5 w-3.5" /> Enregistrer
                    </Button>
                  </div>
                </div>


                {/* Section 4 : Récapitulatif */}
                <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-primary">Récapitulatif de l'abonnement</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                    <div>
                      <span className="text-muted-foreground">Fréquence : </span>
                      <span className="font-medium">{currentFreq?.label || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Période : </span>
                      <span className="font-medium">
                        {aboDateDebut && dateFinAuto
                          ? `du ${format(parseISO(aboDateDebut), "dd/MM/yyyy")} au ${format(parseISO(dateFinAuto), "dd/MM/yyyy")}`
                          : "—"}
                      </span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-muted-foreground">Jours & heures : </span>
                      <span className="font-medium">
                        {aboJours.length > 0
                          ? aboJours
                              .map(
                                (j) =>
                                  `${JOURS_SEMAINE.find((x) => x.value === j.jour)?.label}${j.heure_debut ? ` ${j.heure_debut}${j.heure_fin ? `–${j.heure_fin}` : ""}` : ""}`,
                              )
                              .join(", ")
                          : "—"}
                      </span>
                    </div>
                    <div className="sm:col-span-2 pt-2 border-t border-primary/20 flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground">
                        Interventions estimées pour {format(aboCalMonth, "MMMM yyyy", { locale: fr })} :{' '}
                      </span>
                      <span className="text-lg font-bold text-primary">{monthlyInterventions}</span>
                      {cancelledInterventions > 0 && (
                        <span className="inline-flex items-center text-xs font-medium text-rose-700 bg-rose-50 border border-rose-100 rounded px-1.5 py-0.5">
                          {cancelledInterventions} annulée(s)
                        </span>
                      )}
                      {aRecupMois > 0 && (
                        <span className="inline-flex items-center text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                          {aRecupMois} à récupérer (ce mois)
                        </span>
                      )}
                      {reportesMois > 0 && (
                        <span className="inline-flex items-center text-xs font-medium text-indigo-800 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5">
                          {reportesMois} reportée(s) programmée(s)
                        </span>
                      )}
                      {pendingCreditsGlobal > 0 && (
                        <span className="inline-flex items-center text-xs font-semibold text-amber-900 bg-amber-100 border border-amber-300 rounded px-1.5 py-0.5">
                          Crédits à récupérer (abonnement) : {pendingCreditsGlobal}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 1 : Type de fréquence (renseigné automatiquement par le système) */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Type de fréquence * <span className="normal-case text-[10px] text-muted-foreground/70">(renseigné automatiquement)</span>
                  </Label>
                  <Input
                    value={currentFreq?.label || aboFrequence || "—"}
                    readOnly
                    disabled
                    className="bg-muted/50 h-8 text-xs cursor-not-allowed"
                  />
                </div>

                {/* Section 2 : Période (durée fixée à 1 mois) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Date de démarrage *
                    </Label>
                    <Input
                      type="date"
                      value={aboDateDebut}
                      onChange={(e) => setAboDateDebut(e.target.value)}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Date de fin (auto — 1 mois)
                    </Label>
                    <Input
                      type="date"
                      value={dateFinAuto}
                      readOnly
                      disabled
                      className="bg-muted cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Facturation au prorata pour le mois sélectionné */}
                <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-xs font-semibold text-primary cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-primary"
                        checked={proratActif}
                        onChange={(e) => {
                          if (e.target.checked) setProrata({ debut: _monthStartStr, fin: _monthEndStr });
                          else setProrata(null);
                        }}
                      />
                      Facture au prorata ({format(aboCalMonth, "MMMM yyyy", { locale: fr })})
                    </label>
                    {proratActif && (
                      <>
                        <div className="flex items-center gap-1.5">
                          <Label className="text-[11px] text-muted-foreground">Du</Label>
                          <Input
                            type="date"
                            value={currentProrata?.debut || _monthStartStr}
                            min={_monthStartStr}
                            max={_monthEndStr}
                            onChange={(e) => setProrata({ debut: e.target.value })}
                            className="h-7 w-36 text-xs bg-background"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Label className="text-[11px] text-muted-foreground">Au</Label>
                          <Input
                            type="date"
                            value={currentProrata?.fin || _monthEndStr}
                            min={_monthStartStr}
                            max={_monthEndStr}
                            onChange={(e) => setProrata({ fin: e.target.value })}
                            className="h-7 w-36 text-xs bg-background"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Section 3 : Jours et heures */}

                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Jours d'intervention *
                    </Label>
                    <span className="text-[11px] text-muted-foreground">
                      {aboJours.length}/{maxJours} jour(s) sélectionné(s)
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                    {JOURS_SEMAINE.map((j) => {
                      const selected = aboJours.find((aj) => aj.jour === j.value);
                      const disabled = !selected && aboJours.length >= maxJours;
                      return (
                        <button
                          key={j.value}
                          type="button"
                          onClick={() => toggleJour(j.value)}
                          disabled={disabled}
                          className={cn(
                            "text-xs font-medium px-2 py-2 rounded-lg border transition-all",
                            selected
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : disabled
                                ? "bg-muted text-muted-foreground border-border opacity-50 cursor-not-allowed"
                                : "bg-background border-border hover:border-primary/40 hover:bg-primary/5",
                          )}
                        >
                          {j.label}
                        </button>
                      );
                    })}
                  </div>

                  {aboJours.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <Label className="text-[11px] text-muted-foreground">Horaires par jour (début / fin)</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {aboJours.map((jd) => (
                          <div key={jd.jour} className="flex items-center gap-2 p-2 rounded-lg border bg-background/60">
                            <span className="text-xs font-semibold w-20 shrink-0">
                              {JOURS_SEMAINE.find((j) => j.value === jd.jour)?.label}
                            </span>
                            <Input
                              type="time"
                              value={jd.heure_debut}
                              onChange={(e) => setJourHeureField(jd.jour, "heure_debut", e.target.value)}
                              className="h-8 text-xs flex-1"
                              aria-label="Heure de début"
                            />
                            <span className="text-xs text-muted-foreground">→</span>
                            <Input
                              type="time"
                              value={jd.heure_fin}
                              onChange={(e) => setJourHeureField(jd.jour, "heure_fin", e.target.value)}
                              className="h-8 text-xs flex-1"
                              aria-label="Heure de fin"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}


                  {/* Calendrier mensuel des interventions */}
                  {aboJours.length > 0 && (() => {
                    const dayMap: Record<string, number> = {
                      dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6,
                    };
                    const heureByDow: Record<number, string> = {};
                    aboJours.forEach((j) => { heureByDow[dayMap[j.jour]] = j.heure_debut; });
                    const selectedDows = aboJours.map((j) => dayMap[j.jour]);
                    let start: Date;
                    try { start = aboDateDebut ? parseISO(aboDateDebut) : new Date(); } catch { start = new Date(); }
                    let end: Date;
                    try { end = dateFinAuto ? parseISO(dateFinAuto) : addMonthsFn(start, 1); } catch { end = addMonthsFn(start, 1); }
                    const startMs = start.getTime();
                    const interventionSet = new Set<string>();
                    const seenMonth = new Set<string>();
                    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
                      if (!selectedDows.includes(d.getDay())) continue;
                      if (aboFrequence === "bi_hebdomadaire") {
                        const weekNo = Math.floor((d.getTime() - startMs) / (7 * 24 * 3600 * 1000));
                        if (weekNo % 2 !== 0) continue;
                      }
                      if (aboFrequence === "1_fois_mois") {
                        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDay()}`;
                        if (seenMonth.has(key)) continue;
                        seenMonth.add(key);
                      }
                      interventionSet.add(format(d, "yyyy-MM-dd"));
                    }
                    const monthStart = startOfMonth(aboCalMonth);
                    const monthEnd = endOfMonth(aboCalMonth);
                    const gridStart = addDays(monthStart, -monthStart.getDay());
                    const gridEnd = addDays(monthEnd, 6 - monthEnd.getDay());
                    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
                    const headers = ["DIM", "LUN", "MAR", "MER", "JEU", "VEN", "SAM"];
                    return (
                      <div className="pt-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Calendrier des interventions
                          </Label>
                          <div className="flex items-center gap-2">
                            <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0"
                              onClick={() => setAboCalMonth(subMonths(aboCalMonth, 1))}>‹</Button>
                            <span className="text-sm font-semibold capitalize min-w-[130px] text-center">
                              {format(aboCalMonth, "MMMM yyyy", { locale: fr })}
                            </span>
                            <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0"
                              onClick={() => setAboCalMonth(addMonthsFn(aboCalMonth, 1))}>›</Button>
                          </div>
                        </div>
                        <div className="rounded-xl border overflow-hidden bg-background">
                          <div className="grid grid-cols-7 bg-primary/10">
                            {headers.map((h) => (
                              <div key={h} className="text-[11px] font-bold text-primary/80 text-center py-2 border-r last:border-r-0">
                                {h}
                              </div>
                            ))}
                          </div>
                          <div className="grid grid-cols-7">
                            {days.map((d, i) => {
                              const key = format(d, "yyyy-MM-dd");
                              const inMonth = isSameMonth(d, aboCalMonth);
                              const override = aboDateOverrides[key];
                              const isPattern = interventionSet.has(key);
                              const isIntervention = (isPattern && !override?.excluded) || (!!override?.heure && !override?.excluded);
                              const heure = override?.heure || (isPattern ? heureByDow[d.getDay()] : "");
                              const heureFin = override?.heure_fin || "";
                              const statut = override?.statut || null;
                              const isToday = isSameDay(d, new Date());
                              return (
                                <Popover key={i}>
                                  <PopoverTrigger asChild>
                                    <button
                                      type="button"
                                      className={cn(
                                        "min-h-[68px] border-r border-b last:border-r-0 p-1.5 flex flex-col items-start text-left transition-colors",
                                        (i + 1) % 7 === 0 && "border-r-0",
                                        !inMonth && "bg-muted/30 text-muted-foreground/50 hover:bg-muted/50",
                                        inMonth && !isIntervention && "hover:bg-muted/40",
                                        isIntervention && inMonth && !statut && (override?.reprogrammed_from ? "bg-indigo-100 hover:bg-indigo-200" : "bg-primary/10 hover:bg-primary/15"),
                                        isIntervention && inMonth && statut === "termine" && "bg-emerald-100 hover:bg-emerald-200",
                                        isIntervention && inMonth && statut === "annule" && "bg-rose-100 hover:bg-rose-200",
                                        (statut === "a_recuperer") && "bg-amber-100 hover:bg-amber-200",
                                      )}
                                    >
                                      <span className={cn(
                                        "text-xs font-semibold",
                                        isToday && "text-primary",
                                        isIntervention && inMonth && !statut && !override?.reprogrammed_from && "text-primary",
                                        override?.reprogrammed_from && "text-indigo-800",
                                        statut === "termine" && "text-emerald-800",
                                        statut === "annule" && "text-rose-800",
                                        statut === "a_recuperer" && "text-amber-900",
                                      )}>
                                        {format(d, "d")}
                                      </span>
                                      {(isIntervention || statut === "a_recuperer") && inMonth && (
                                        <div className="mt-auto w-full space-y-0.5">
                                          <span className={cn(
                                            "block text-[9px] font-bold uppercase tracking-wide rounded px-1 py-0.5 text-center",
                                            !statut && !override?.reprogrammed_from && "bg-primary text-primary-foreground",
                                            !statut && override?.reprogrammed_from && "bg-indigo-600 text-white",
                                            statut === "termine" && "bg-emerald-600 text-white",
                                            statut === "annule" && "bg-rose-600 text-white line-through",
                                            statut === "a_recuperer" && "bg-amber-600 text-white",
                                          )}>
                                            {statut === "a_recuperer"
                                              ? "À récup."
                                              : override?.reprogrammed_from && !statut
                                                ? "Reportée"
                                                : !statut ? "À venir" : statut === "termine" ? "Terminé" : "Annulé"}
                                          </span>
                                          {heure && (
                                            <span className={cn(
                                              "block text-[10px] font-medium rounded px-1 py-0.5 text-center",
                                              !statut && !override?.reprogrammed_from && "bg-primary/80 text-primary-foreground",
                                              !statut && override?.reprogrammed_from && "bg-indigo-500 text-white",
                                              statut === "termine" && "bg-emerald-500 text-white",
                                              statut === "annule" && "bg-rose-500 text-white line-through",
                                              statut === "a_recuperer" && "bg-amber-500 text-white",
                                            )}>
                                              {heure}{heureFin ? `–${heureFin}` : ""}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-80 p-3 space-y-3" align="start">
                                    <div className="text-sm font-semibold capitalize">
                                      {format(d, "EEEE d MMMM yyyy", { locale: fr })}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="space-y-1">
                                        <Label className="text-xs">Heure début</Label>
                                        <Input
                                          type="time"
                                          value={heure || ""}
                                          onChange={(e) => setAboDateOverrides((prev) => ({
                                            ...prev,
                                            [key]: { ...prev[key], heure: e.target.value, excluded: false },
                                          }))}
                                          className="h-8 text-xs"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">Heure fin</Label>
                                        <Input
                                          type="time"
                                          value={heureFin}
                                          onChange={(e) => setAboDateOverrides((prev) => ({
                                            ...prev,
                                            [key]: { ...prev[key], heure_fin: e.target.value, excluded: false },
                                          }))}
                                          className="h-8 text-xs"
                                        />
                                      </div>
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Statut</Label>
                                      <div className="grid grid-cols-2 gap-1">
                                        <Button type="button" size="sm" variant={!statut ? "default" : "outline"} className="h-7 text-[11px]"
                                          onClick={() => setAboDateOverrides((prev) => ({
                                            ...prev, [key]: { ...prev[key], statut: null },
                                          }))}>
                                          À venir
                                        </Button>
                                        <Button type="button" size="sm" variant={statut === "termine" ? "default" : "outline"}
                                          className={cn("h-7 text-[11px]", statut === "termine" && "bg-emerald-600 hover:bg-emerald-700")}
                                          onClick={() => setAboDateOverrides((prev) => ({
                                            ...prev, [key]: { ...prev[key], statut: "termine", excluded: false },
                                          }))}>
                                          Terminé
                                        </Button>
                                        <Button type="button" size="sm" variant={statut === "annule" ? "default" : "outline"}
                                          className={cn("h-7 text-[11px]", statut === "annule" && "bg-rose-600 hover:bg-rose-700")}
                                          onClick={() => setAboDateOverrides((prev) => ({
                                            ...prev, [key]: { ...prev[key], statut: "annule", excluded: false },
                                          }))}>
                                          Annulé (perdu)
                                        </Button>
                                        <Button type="button" size="sm" variant={statut === "a_recuperer" ? "default" : "outline"}
                                          className={cn("h-7 text-[11px]", statut === "a_recuperer" && "bg-amber-600 hover:bg-amber-700")}
                                          onClick={() => setAboDateOverrides((prev) => ({
                                            ...prev, [key]: { ...prev[key], statut: "a_recuperer", excluded: false, reprogrammed_to: null },
                                          }))}>
                                          Annulé à récupérer
                                        </Button>
                                      </div>
                                    </div>

                                    {/* Reprogrammation d'un crédit "à récupérer" */}
                                    {statut === "a_recuperer" && !override?.reprogrammed_to && (
                                      <div className="rounded-md border border-amber-200 bg-amber-50 p-2 space-y-1.5">
                                        <div className="text-[11px] font-semibold text-amber-900">Reprogrammer cette intervention</div>
                                        <div className="flex gap-1.5">
                                          <Input
                                            type="date"
                                            value={reprogTarget[key] || ""}
                                            onChange={(e) => setReprogTarget((prev) => ({ ...prev, [key]: e.target.value }))}
                                            className="h-7 text-xs flex-1 bg-background"
                                          />
                                          <Button type="button" size="sm" className="h-7 text-[11px] bg-amber-600 hover:bg-amber-700"
                                            disabled={!reprogTarget[key] || reprogTarget[key] === key}
                                            onClick={() => {
                                              const target = reprogTarget[key];
                                              if (!target) return;
                                              const h = heure || heureByDow[d.getDay()] || "09:00";
                                              const hf = heureFin || "";
                                              setAboDateOverrides((prev) => ({
                                                ...prev,
                                                [key]: { ...prev[key], statut: "a_recuperer", reprogrammed_to: target, excluded: false },
                                                [target]: { ...prev[target], heure: h, heure_fin: hf, statut: null, excluded: false, reprogrammed_from: key },
                                              }));
                                              setReprogTarget((prev) => { const { [key]: _, ...rest } = prev; return rest; });
                                              toast({ title: "Intervention reprogrammée", description: `Reportée au ${format(parseISO(target), "dd/MM/yyyy")}` });
                                            }}>
                                            Reprogrammer
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                    {statut === "a_recuperer" && override?.reprogrammed_to && (
                                      <div className="rounded-md border border-indigo-200 bg-indigo-50 p-2 text-[11px] text-indigo-900 flex items-center justify-between gap-2">
                                        <span>Reprogrammée au <b>{format(parseISO(override.reprogrammed_to), "dd/MM/yyyy")}</b></span>
                                        <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px]"
                                          onClick={() => {
                                            const target = override.reprogrammed_to!;
                                            setAboDateOverrides((prev) => {
                                              const next = { ...prev };
                                              next[key] = { ...next[key], reprogrammed_to: null };
                                              if (next[target]?.reprogrammed_from === key) {
                                                const { [target]: _, ...rest } = next;
                                                return { ...rest, [key]: next[key] };
                                              }
                                              return next;
                                            });
                                          }}>Annuler le report</Button>
                                      </div>
                                    )}
                                    {override?.reprogrammed_from && (
                                      <div className="rounded-md border border-indigo-200 bg-indigo-50 p-2 text-[11px] text-indigo-900 flex items-center justify-between gap-2">
                                        <span>Reportée depuis le <b>{format(parseISO(override.reprogrammed_from), "dd/MM/yyyy")}</b></span>
                                        <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px]"
                                          onClick={() => {
                                            const src = override.reprogrammed_from!;
                                            setAboDateOverrides((prev) => {
                                              const next = { ...prev };
                                              if (next[src]) next[src] = { ...next[src], reprogrammed_to: null };
                                              const { [key]: _, ...rest } = next;
                                              return rest;
                                            });
                                          }}>Annuler le report</Button>
                                      </div>
                                    )}

                                    {/* Utiliser un crédit "à récupérer" sur un jour libre */}
                                    {!isIntervention && !override?.reprogrammed_from && availableCreditSources.length > 0 && (
                                      <div className="rounded-md border border-amber-200 bg-amber-50 p-2 space-y-1.5">
                                        <div className="text-[11px] font-semibold text-amber-900">Utiliser un crédit à récupérer</div>
                                        <div className="flex gap-1.5">
                                          <select
                                            value={useCreditSource[key] || ""}
                                            onChange={(e) => setUseCreditSource((prev) => ({ ...prev, [key]: e.target.value }))}
                                            className="h-7 text-xs flex-1 rounded border bg-background px-1"
                                          >
                                            <option value="">Choisir un crédit…</option>
                                            {availableCreditSources.map((sk) => (
                                              <option key={sk} value={sk}>{format(parseISO(sk), "dd/MM/yyyy")}</option>
                                            ))}
                                          </select>
                                          <Button type="button" size="sm" className="h-7 text-[11px] bg-amber-600 hover:bg-amber-700"
                                            disabled={!useCreditSource[key]}
                                            onClick={() => {
                                              const src = useCreditSource[key];
                                              if (!src) return;
                                              const h = heure || heureByDow[d.getDay()] || "09:00";
                                              const hf = heureFin || "";
                                              setAboDateOverrides((prev) => ({
                                                ...prev,
                                                [src]: { ...prev[src], statut: "a_recuperer", reprogrammed_to: key, excluded: false },
                                                [key]: { ...prev[key], heure: h, heure_fin: hf, statut: null, excluded: false, reprogrammed_from: src },
                                              }));
                                              setUseCreditSource((prev) => { const { [key]: _, ...rest } = prev; return rest; });
                                              toast({ title: "Crédit utilisé", description: `Intervention du ${format(parseISO(src), "dd/MM/yyyy")} reportée ici.` });
                                            }}>
                                            Utiliser
                                          </Button>
                                        </div>
                                      </div>
                                    )}

                                    <div className="flex gap-2">
                                      {isIntervention ? (
                                        <Button type="button" size="sm" variant="outline" className="flex-1 h-8 text-xs text-destructive"
                                          onClick={() => setAboDateOverrides((prev) => ({
                                            ...prev, [key]: { ...prev[key], excluded: true },
                                          }))}>
                                          Retirer
                                        </Button>
                                      ) : (
                                        <Button type="button" size="sm" variant="outline" className="flex-1 h-8 text-xs"
                                          onClick={() => setAboDateOverrides((prev) => ({
                                            ...prev,
                                            [key]: { heure: prev[key]?.heure || heureByDow[d.getDay()] || "09:00", heure_fin: prev[key]?.heure_fin || "", excluded: false },
                                          }))}>
                                          Ajouter
                                        </Button>
                                      )}
                                      {aboDateOverrides[key] && (
                                        <Button type="button" size="sm" variant="ghost" className="h-8 text-xs"
                                          onClick={() => setAboDateOverrides((prev) => {
                                            const { [key]: _, ...rest } = prev; return rest;
                                          })}>
                                          Reset
                                        </Button>
                                      )}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              );
                            })}
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {monthlyInterventions} intervention(s) sur le mois de {format(aboCalMonth, "MMMM yyyy", { locale: fr })}
                          {cancelledInterventions > 0 && (
                            <span className="text-rose-600 font-medium ml-1">({cancelledInterventions} annulée(s))</span>
                          )}
                          . Cliquez sur un jour pour ajuster l'heure ou l'exclure.
                        </p>
                      </div>
                    );
                  })()}
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Notes complémentaires
                  </Label>
                  <Textarea
                    value={aboNotes}
                    onChange={(e) => setAboNotes(e.target.value)}
                    rows={2}
                    placeholder="Précisions sur l'abonnement..."
                    className="resize-none bg-background/60"
                  />
                </div>

              </div>
            );
          })()}
        </Section>


        {/* Détails besoin actuel */}
        <Section title="Détails Besoin Actuel" icon={Briefcase} defaultOpen colorClass="bg-[#027A76]">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
            <InfoItem label="Réf commande" value={<span className="font-mono">#{demande.num_demande}</span>} />
            <InfoItem label="Type de service" value={demande.type_prestation} />
            <InfoItem label="Type d'habitation" value={demande.type_bien} />
            <InfoItem label="Nombre d'heures" value={demande.duree_heures ? `${demande.duree_heures}h` : undefined} />
            <InfoItem label="Tarif" value={demande.montant_total ? `${demande.montant_total} MAD` : undefined} />
            <InfoItem label="Date intervention" value={demande.date_prestation} />
            <InfoItem label="Heure intervention" value={demande.heure_prestation} />
            <InfoItem label="Adresse" value={demande.adresse} />
            <InfoItem label="Ville" value={demande.ville} />
            <InfoItem label="Repère / Quartier" value={demande.quartier} />
            <InfoItem label="Date création" value={format(new Date(demande.created_at), "dd MMM yyyy à HH:mm", { locale: fr })} />
            <InfoItem label="Dernière modification" value={format(new Date(demande.created_at), "dd MMM yyyy à HH:mm", { locale: fr })} />
            {d.superficie_m2 && <InfoItem label="Superficie" value={`${d.superficie_m2} m²`} />}
            {d.etat_logement && <InfoItem label="État logement" value={d.etat_logement} />}
            {d.nature_intervention && <InfoItem label="Nature intervention" value={d.nature_intervention} />}
            <InfoItem label="Avec produit" value={d.avec_produit ? "Oui" : "Non"} />
            <InfoItem label="Mode paiement" value={d.mode_paiement} />
            <InfoItem label="Nbre intervenants" value={demande.nombre_intervenants} />
          </div>
          {demande.notes_client && (
            <div className="mt-3 p-3 bg-background/60 rounded-lg border border-border">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Notes du client</p>
              <p className="text-sm text-foreground">{demande.notes_client}</p>
            </div>
          )}
        </Section>

        {/* Historique Documents */}
        <Section
          title="Historique Documents"
          icon={FileText}
          defaultOpen
          colorClass="bg-[#F4A24C]"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date d'émission</TableHead>
                <TableHead>Commercial</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead>Type de service</TableHead>
                <TableHead>Statut demande</TableHead>
                <TableHead className="text-center">Fichier (PNG/PDF)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="text-xs">{format(new Date(demande.created_at), "dd/MM/yyyy")}</TableCell>
                <TableCell className="text-xs font-medium">—</TableCell>
                <TableCell>
                  <Badge className={demande.type_service === "SPP" ? "bg-primary text-primary-foreground text-[10px]" : "bg-spe text-spe-foreground text-[10px]"}>
                    {demande.type_service === "SPP" ? "Particulier" : "Entreprise"}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">{demande.type_prestation}</TableCell>
                <TableCell>
                  {s ? (
                    <Badge variant="outline" className="border-0 text-[10px]" style={{ backgroundColor: s.hex, color: "#fff" }}>
                      {s.label}
                    </Badge>
                  ) : demande.statut}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Voir le formulaire">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Télécharger">
                      <FileDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Section>

        {/* Candidatures proposées */}
        <Section title="Candidats Proposés" icon={Users} colorClass="bg-[#BFDDCE]" count={d.candidat_nom ? 1 : 0}>
          {d.candidat_nom ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date d'intervention</TableHead>
                  <TableHead>Nom du profil</TableHead>
                  <TableHead>Statut profil</TableHead>
                  <TableHead>Statut paiement</TableHead>
                  <TableHead>Note du profil</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-xs">{demande.date_prestation || "—"}</TableCell>
                  <TableCell className="font-medium">{d.candidat_nom}</TableCell>
                  <TableCell>
                    {(() => {
                      const statutMap: Record<string, { label: string; color: string }> = {
                        envoye: { label: "Présenté", color: "bg-blue-100 text-blue-800" },
                        accepte: { label: "Présenté", color: "bg-green-100 text-green-800" },
                        refuse: { label: "Désistement", color: "bg-red-100 text-red-800" },
                        desistement: { label: "Désistement", color: "bg-red-100 text-red-800" },
                      };
                      const st = statutMap[d.statut_candidature] || { label: "Présenté", color: "bg-blue-100 text-blue-800" };
                      return <Badge className={st.color}>{st.label}</Badge>;
                    })()}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const paiementMap: Record<string, { label: string; color: string }> = {
                        non_paye: { label: "Paiement en attente", color: "bg-red-100 text-red-800" },
                        paye: { label: "Payé", color: "bg-green-100 text-green-800" },
                        partiel: { label: "Partiel", color: "bg-yellow-100 text-yellow-800" },
                      };
                      const sp = facturation?.statut_paiement || d.statut_paiement_commercial || "non_paye";
                      const st = paiementMap[sp] || paiementMap.non_paye;
                      return <Badge className={st.color}>{st.label}</Badge>;
                    })()}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      // Map satisfaction from feedback to stars
                      const satisfactionStars: Record<string, number> = {
                        "Très satisfait": 5,
                        "Très satisfaite": 5,
                        "Satisfait": 4,
                        "Satisfaite": 4,
                        "Moyennement satisfait": 3,
                        "Moyennement satisfaite": 3,
                        "Pas satisfait": 2,
                        "Pas satisfaite": 2,
                        "Pas content": 1,
                        "Pas contente": 1,
                      };
                      const stars = feedback?.satisfaction ? (satisfactionStars[feedback.satisfaction] || 0) : 0;
                      if (!stars) return <span className="text-xs text-muted-foreground">—</span>;
                      return (
                        <span className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-3.5 w-3.5 ${i < stars ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                          ))}
                        </span>
                      );
                    })()}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-2">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Aucune candidature proposée</p>
            </div>
          )}
        </Section>

        {/* Historique des actions */}
        <Section title="Historique des actions" icon={History} colorClass="bg-[#6366f1]" count={demandeHistorique.length}>
          {demandeHistorique.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Détails</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {demandeHistorique.map((h: any) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-xs whitespace-nowrap">{format(new Date(h.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}</TableCell>
                    <TableCell className="text-sm font-medium">{h.action}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[300px]">{h.details || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground italic py-4 text-center">Aucune action enregistrée.</p>
          )}
        </Section>

        {/* Feedback Client */}
        <Section title="Feedback Client" icon={Star} colorClass="bg-[#E86C4F]" count={allClientFeedbacks.length}>
          {allClientFeedbacks.length > 0 ? (
            <div className="space-y-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Profil</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Satisfaction</TableHead>
                    <TableHead>Note agence</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allClientFeedbacks.map((f: any) => {
                    const stKey = f.statut as string;
                    const stMap: Record<string, { label: string; color: string }> = {
                      en_attente: { label: "En attente", color: "bg-yellow-100 text-yellow-800" },
                      lien_envoye: { label: "Lien envoyé", color: "bg-blue-100 text-blue-800" },
                      positif: { label: "Positif", color: "bg-green-100 text-green-800" },
                      negatif: { label: "Négatif", color: "bg-red-100 text-red-800" },
                    };
                    const st = stMap[stKey] || stMap.en_attente;
                    return (
                      <TableRow key={f.id}>
                        <TableCell className="text-sm">{f.type_service || "—"}</TableCell>
                        <TableCell className="text-sm">
                          {f.profil_nom ? (
                            <button
                              className="text-primary hover:underline cursor-pointer font-medium"
                              onClick={() => {
                                // Find profil by name and navigate
                                supabase.from("profils").select("id").ilike("nom", f.profil_nom).limit(1).then(({ data }) => {
                                  if (data && data.length > 0) {
                                    navigate(`/compte-profil?id=${data[0].id}&from=/compte-client?id=${demandeId}`);
                                  }
                                });
                              }}
                            >
                              {f.profil_nom}
                            </button>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-xs">{f.date_prestation || "—"}</TableCell>
                        <TableCell>
                          {f.satisfaction ? (
                            <Badge className={
                              f.satisfaction === "Très satisfait" || f.satisfaction === "Satisfait"
                                ? "bg-green-100 text-green-800" : f.satisfaction === "Pas satisfait"
                                ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"
                            }>{f.satisfaction}</Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          {f.note_agence ? (
                            <span className="flex items-center gap-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star key={i} className={`h-3.5 w-3.5 ${i < f.note_agence ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                              ))}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell><Badge className={st.color}>{st.label}</Badge></TableCell>
                        <TableCell>
                          {f.submitted_at && (
                            <Button size="sm" variant="ghost" onClick={() => setDetailFeedback(f)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center py-6 text-center">
              <p className="text-sm text-muted-foreground">Aucun feedback associé à ce client</p>
            </div>
          )}
        </Section>

        {/* Detail feedback modal */}
        <Dialog open={!!detailFeedback} onOpenChange={() => setDetailFeedback(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Détail feedback — {detailFeedback?.nom_client}</DialogTitle>
            </DialogHeader>
            {detailFeedback && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Satisfaction :</span> <strong>{detailFeedback.satisfaction}</strong></div>
                  <div><span className="text-muted-foreground">Qualité ménage :</span> <strong>{detailFeedback.qualite_menage}</strong></div>
                  <div><span className="text-muted-foreground">Professionnel :</span> <strong>{detailFeedback.professionnel}</strong></div>
                  <div><span className="text-muted-foreground">Recommande profil :</span> <strong>{detailFeedback.recommande_profil ? "Oui" : "Non"}</strong></div>
                  <div><span className="text-muted-foreground">Recommande agence :</span> <strong>{detailFeedback.recommande_agence ? "Oui" : "Non"}</strong></div>
                  <div>
                    <span className="text-muted-foreground">Note agence :</span>{" "}
                    <span className="inline-flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3.5 w-3.5 ${i < (detailFeedback.note_agence || 0) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                      ))}
                    </span>
                  </div>
                </div>
                {detailFeedback.commentaire && (
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-muted-foreground text-xs mb-1">Commentaire</p>
                    <p>{detailFeedback.commentaire}</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Soumis le {new Date(detailFeedback.submitted_at!).toLocaleDateString("fr-FR")}</p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Historique actions */}
        <Section title="Historique" icon={Clock} colorClass="bg-[#DBAE8D]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyActions.map((h, i) => (
                <TableRow key={i}>
                  <TableCell className="text-sm font-medium">{h.user}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(h.date), "dd/MM/yy HH:mm")}</TableCell>
                  <TableCell className="text-sm">{h.action}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{h.note || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
      </div>

      {/* Renouveler Modal */}
      <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" /> Renouveler la demande
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Les informations ci-dessous sont pré-remplies depuis la demande actuelle. Vous pouvez les modifier avant de valider.
          </p>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Nom du client</Label>
                <Input value={String(renewForm.nom || "")} onChange={(e) => setRenewForm({ ...renewForm, nom: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Téléphone direct</Label>
                <Input value={String(renewForm.telephone_direct || "")} onChange={(e) => setRenewForm({ ...renewForm, telephone_direct: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>WhatsApp</Label>
                <Input value={String(renewForm.telephone_whatsapp || "")} onChange={(e) => setRenewForm({ ...renewForm, telephone_whatsapp: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Type de prestation</Label>
                <Input value={String(renewForm.type_prestation || "")} onChange={(e) => setRenewForm({ ...renewForm, type_prestation: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Ville</Label>
                <Input value={String(renewForm.ville || "")} onChange={(e) => setRenewForm({ ...renewForm, ville: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Quartier</Label>
                <Input value={String(renewForm.quartier || "")} onChange={(e) => setRenewForm({ ...renewForm, quartier: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Adresse</Label>
                <Input value={String(renewForm.adresse || "")} onChange={(e) => setRenewForm({ ...renewForm, adresse: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Tarif total (MAD)</Label>
                <Input type="number" value={String(renewForm.montant_total || "")} onChange={(e) => setRenewForm({ ...renewForm, montant_total: Number(e.target.value) || null })} />
              </div>
              <div className="space-y-1">
                <Label>Durée (heures)</Label>
                <Input type="number" value={String(renewForm.duree_heures || "")} onChange={(e) => setRenewForm({ ...renewForm, duree_heures: Number(e.target.value) || null })} />
              </div>
              <div className="space-y-1">
                <Label>Nombre d'intervenants</Label>
                <Input type="number" value={String(renewForm.nombre_intervenants || 1)} onChange={(e) => setRenewForm({ ...renewForm, nombre_intervenants: Number(e.target.value) || 1 })} />
              </div>
              <div className="space-y-1">
                <Label>Date intervention</Label>
                <Input type="date" value="" onChange={(e) => setRenewForm({ ...renewForm, date_prestation: e.target.value || null })} />
              </div>
              <div className="space-y-1">
                <Label>Heure intervention</Label>
                <Input type="time" value="" onChange={(e) => setRenewForm({ ...renewForm, heure_prestation: e.target.value || null })} />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => { setRenewOpen(false); setActiveDemande(null); }}>Annuler</Button>
            <Button onClick={handleRenew} disabled={createRenewalMutation.isPending} className="gap-1.5">
              <RefreshCw className="h-4 w-4" /> Activer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Switcher en abonnement Modal */}
      <Dialog open={switchAboOpen} onOpenChange={(open) => { setSwitchAboOpen(open); if (!open) setActiveDemande(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Repeat className="h-5 w-5 text-primary" /> Switcher en abonnement
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-3">
            <div className="space-y-1">
              <Label>Fréquence</Label>
              <Select value={selectedFrequence} onValueChange={setSelectedFrequence}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une fréquence" />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCES.filter(f => f.value !== "ponctuel").map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Nombre de personnes</Label>
              <Input type="number" min={1} value={aboNbPersonnes} onChange={(e) => setAboNbPersonnes(e.target.value)} placeholder="1" />
            </div>
            <div className="space-y-1">
              <Label>Nombre d'heures</Label>
              <Input type="number" min={1} value={aboNbHeures} onChange={(e) => setAboNbHeures(e.target.value)} placeholder="3" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => { setSwitchAboOpen(false); setActiveDemande(null); }}>Annuler</Button>
            <Button
              onClick={() => switchToAboMutation.mutate(selectedFrequence)}
              disabled={!selectedFrequence || switchToAboMutation.isPending}
              className="gap-1.5"
            >
              <Repeat className="h-4 w-4" /> Confirmer l'abonnement
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
