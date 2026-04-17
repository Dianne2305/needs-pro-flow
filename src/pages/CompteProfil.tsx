import { useState, useRef, useMemo } from "react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ArrowLeft, User, ChevronDown, MessageSquare, Image, History, Briefcase,
  Save, Search, Phone, MapPin, CreditCard, Calendar, IdCard, Edit, UserPlus, Upload, Download, ExternalLink,
  ShieldBan, Star, ThumbsUp, ThumbsDown, Eye, ClipboardCheck,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PRESENTATIONS_PHYSIQUES, CORPULENCES, STATUT_PROFIL_OPTIONS } from "@/lib/profil-constants";
import { PostulerModal } from "@/components/profils/PostulerModal";
import { EditProfilModal } from "@/components/profils/EditProfilModal";
import { partAgence, partProfil } from "@/lib/finance-types";

function Section({ title, icon: Icon, children, defaultOpen = false, colorClass = "bg-card" }: {
  title: string; icon: any; defaultOpen?: boolean; children: React.ReactNode; colorClass?: string;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className={cn(
        "flex items-center justify-between w-full px-5 py-3.5 rounded-t-xl text-sm font-semibold border border-border hover:shadow-sm transition-all group",
        colorClass
      )}>
        <span className="flex items-center gap-2.5">
          <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-background/60 text-foreground">
            <Icon className="h-4 w-4" />
          </span>
          {title}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className={cn("px-5 pt-3 pb-4 border border-t-0 border-border rounded-b-xl", colorClass)}>
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

export default function CompteProfil() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const profilId = new URLSearchParams(location.search).get("id");

  const [noteOperateur, setNoteOperateur] = useState("");
  const [histSearch, setHistSearch] = useState("");
  const [notesInitialized, setNotesInitialized] = useState(false);
  const [showPostuler, setShowPostuler] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [detailFeedback, setDetailFeedback] = useState<any>(null);

  const photoRef = useRef<HTMLInputElement>(null);
  const cinRef = useRef<HTMLInputElement>(null);
  const attestationRef = useRef<HTMLInputElement>(null);

  const { data: profil, isLoading } = useQuery({
    queryKey: ["profil", profilId],
    queryFn: async () => {
      if (!profilId) return null;
      const { data, error } = await supabase.from("profils").select("*").eq("id", profilId).single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!profilId,
  });

  const { data: historique = [] } = useQuery({
    queryKey: ["profil_historique", profilId],
    queryFn: async () => {
      if (!profilId) return [];
      const { data, error } = await supabase
        .from("profil_historique").select("*").eq("profil_id", profilId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profilId,
  });

  const { data: missions = [] } = useQuery({
    queryKey: ["facturation_profil", profilId],
    queryFn: async () => {
      if (!profilId) return [];
      const { data } = await supabase.from("facturation").select("*").eq("profil_id", profilId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!profilId,
  });

  const { data: feedbacks = [] } = useQuery({
    queryKey: ["feedbacks_profil", profilId, profil?.prenom, profil?.nom],
    queryFn: async () => {
      if (!profilId) return [];
      // Search by profil_id
      const { data: byId } = await supabase.from("feedbacks").select("*").eq("profil_id", profilId).order("created_at", { ascending: false });
      
      let byName: any[] = [];
      let byNom: any[] = [];
      let byPrenom: any[] = [];
      if (profil) {
        // Try "PRENOM NOM" and "NOM PRENOM" patterns
        const fullName1 = `${profil.prenom} ${profil.nom}`.trim();
        const fullName2 = `${profil.nom} ${profil.prenom}`.trim();
        if (fullName1) {
          const { data } = await supabase.from("feedbacks").select("*").ilike("profil_nom", `%${fullName1}%`).order("created_at", { ascending: false });
          byName = data || [];
        }
        if (fullName2 !== fullName1) {
          const { data } = await supabase.from("feedbacks").select("*").ilike("profil_nom", `%${fullName2}%`).order("created_at", { ascending: false });
          byPrenom = data || [];
        }
        // Also try just nom
        if (profil.nom) {
          const { data } = await supabase.from("feedbacks").select("*").ilike("profil_nom", `%${profil.nom.trim()}%`).order("created_at", { ascending: false });
          byNom = data || [];
        }
      }
      // Merge and deduplicate
      const allFbs = [...(byId || []), ...byName, ...byPrenom, ...byNom];
      const seen = new Set<string>();
      return allFbs.filter(f => { if (seen.has(f.id)) return false; seen.add(f.id); return true; });
    },
    enabled: !!profilId && !!profil,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      if (!profilId) return;
      const { error } = await supabase.from("profils").update(updates).eq("id", profilId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profil", profilId] });
      toast({ title: "Mis à jour avec succès" });
    },
  });

  const handleUpload = async (file: File, type: "photo" | "cin" | "attestation") => {
    if (!profilId) return;
    setUploading(type);
    try {
      const ext = file.name.split(".").pop();
      const path = `${profilId}/${type}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("profil-media").upload(path, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("profil-media").getPublicUrl(path);
      const columnMap = { photo: "photo_url", cin: "cin_url", attestation: "attestation_url" };
      const { error } = await supabase.from("profils").update({ [columnMap[type]]: urlData.publicUrl } as any).eq("id", profilId);
      if (error) throw error;

      await supabase.from("profil_historique").insert({
        profil_id: profilId,
        action: `Upload ${type === "photo" ? "photo de profil" : type === "cin" ? "CIN" : "attestation"}`,
        utilisateur: "Opérateur",
      });

      queryClient.invalidateQueries({ queryKey: ["profil", profilId] });
      toast({ title: `${type === "photo" ? "Photo" : type === "cin" ? "CIN" : "Attestation"} uploadé(e) avec succès` });
    } catch (err: any) {
      toast({ title: "Erreur upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(null);
    }
  };

  if (profil && !notesInitialized) {
    setNoteOperateur(profil.note_operateur || "");
    setNotesInitialized(true);
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Chargement du profil...</p>
      </div>
    );
  }

  if (!profil) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <User className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground font-medium">Profil introuvable</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/profils")}><ArrowLeft className="h-4 w-4 mr-1" />Retour</Button>
      </div>
    );
  }

  const p = profil;
  const languesArr: string[] = Array.isArray(p.langue) ? p.langue : [];
  const experiences: any[] = Array.isArray(p.experiences) ? p.experiences : [];
  const statutOpt = STATUT_PROFIL_OPTIONS.find(s => s.value === p.statut_profil);
  const presOpt = PRESENTATIONS_PHYSIQUES.find(pr => pr.value === p.presentation_physique);
  const corpOpt = CORPULENCES.find(c => c.value === p.corpulence);
  const age = p.date_naissance ? Math.floor((Date.now() - new Date(p.date_naissance).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;

  const filteredHist = histSearch
    ? historique.filter((h: any) => h.action?.toLowerCase().includes(histSearch.toLowerCase()) || h.note?.toLowerCase().includes(histSearch.toLowerCase()))
    : historique;

  const autoHistory = [{ date: p.created_at, action: "Profil créé", note: "", utilisateur: "Système" }];
  const allHistory = [...autoHistory, ...filteredHist.map((h: any) => ({
    date: h.created_at, action: h.action, note: h.note || "", utilisateur: h.utilisateur || "—",
  }))].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate("/profils")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />Retour
          </Button>
          <Separator orientation="vertical" className="h-8" />
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11">
              <AvatarImage src={p.photo_url || ""} />
              <AvatarFallback className="bg-primary text-primary-foreground font-bold text-lg">
                {p.prenom?.charAt(0)}{p.nom?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-foreground leading-tight">{p.prenom} {p.nom}</h1>
                {statutOpt && (
                  <Badge variant="outline" className={cn("border-0 text-xs", statutOpt.color)}>{statutOpt.label}</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">{p.type_profil || "Non défini"}</span>
                {p.telephone && <span className="text-xs text-muted-foreground">• {p.telephone}</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowEdit(true)} className="gap-1.5">
            <Edit className="h-4 w-4" /> Éditer
          </Button>
          <Button size="sm" onClick={() => setShowPostuler(true)} className="gap-1.5">
            <UserPlus className="h-4 w-4" /> Postuler
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              updateMutation.mutate({ statut_profil: p.statut_profil === "blackliste" ? "disponible" : "blackliste" });
            }}
          >
            <ShieldBan className="h-4 w-4" />
            {p.statut_profil === "blackliste" ? "Débloquer" : "Blacklister"}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {/* Infos personnelles */}
        <Section title="Informations du profil" icon={User} defaultOpen colorClass="bg-[hsl(210,40%,96%)]">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1">
            <InfoItem label="Nom" value={p.nom} />
            <InfoItem label="Prénom" value={p.prenom} />
            <InfoItem label="Sexe" value={p.sexe === "homme" ? "Homme" : p.sexe === "femme" ? "Femme" : p.sexe} />
            <InfoItem label="Date de naissance" value={p.date_naissance ? format(new Date(p.date_naissance), "dd/MM/yyyy") : undefined} />
            <InfoItem label="Âge" value={age ? `${age} ans` : undefined} />
            <InfoItem label="CIN" value={p.numero_cin} />
            <InfoItem label="Téléphone" value={p.telephone} />
            <InfoItem label="WhatsApp" value={p.whatsapp} />
            <InfoItem label="Ville" value={p.ville} />
            <InfoItem label="Quartier" value={p.quartier} />
            <InfoItem label="Nationalité" value={p.nationalite} />
            <InfoItem label="Situation matrimoniale" value={p.situation_matrimoniale} />
            <InfoItem label="Enfants" value={p.a_des_enfants ? "Oui" : "Non"} />
            <InfoItem label="Langues" value={languesArr.length > 0 ? languesArr.join(", ") : undefined} />
            <InfoItem label="Niveau d'étude" value={p.niveau_etude} />
            <InfoItem label="Expérience totale" value={`${p.experience_annees || 0} an(s) ${p.experience_mois || 0} mois`} />
            <InfoItem label="Type de profil" value={p.type_profil} />
            <InfoItem label="Formation requise" value={p.formation_requise || "—"} />
            <InfoItem label="Sait lire et écrire" value={p.sait_lire_ecrire ? "Oui" : "Non"} />
            <InfoItem label="Maladie / Handicap" value={p.maladie_handicap || "Aucun"} />
            <InfoItem label="Présentation physique" value={presOpt?.label} />
            <InfoItem label="Corpulence" value={corpOpt?.label} />
          </div>

          {/* Disponibilités */}
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Disponibilités</p>
            <div className="flex flex-wrap gap-2">
              {p.dispo_urgences && <Badge variant="secondary" className="text-xs">Urgences</Badge>}
              {p.dispo_journee && <Badge variant="secondary" className="text-xs">Journée (7h–18h)</Badge>}
              {p.dispo_soiree && <Badge variant="secondary" className="text-xs">Soirée (après 18h)</Badge>}
              {p.dispo_7j7 && <Badge variant="secondary" className="text-xs">7j/7</Badge>}
              {p.dispo_jours_feries && <Badge variant="secondary" className="text-xs">Jours fériés</Badge>}
              {!p.dispo_urgences && !p.dispo_journee && !p.dispo_soiree && !p.dispo_7j7 && !p.dispo_jours_feries && (
                <span className="text-xs text-muted-foreground">Aucune disponibilité renseignée</span>
              )}
            </div>
          </div>

          {/* Expériences */}
          {experiences.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Expériences</p>
              {experiences.map((exp, idx) => (
                <div key={idx} className="p-3 bg-background/60 rounded-lg mb-2">
                  <p className="font-medium text-sm">{exp.poste}</p>
                  {exp.duree_menage && <p className="text-xs text-muted-foreground">Durée : {exp.duree_menage}</p>}
                  {exp.lieux_travail?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {exp.lieux_travail.map((l: string) => <Badge key={l} variant="outline" className="text-[10px]">{l}</Badge>)}
                    </div>
                  )}
                  {exp.taches?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {exp.taches.map((t: string) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                    </div>
                  )}
                  {exp.grand_menage && <Badge className="mt-1 text-[10px] bg-primary/10 text-primary">Grand ménage</Badge>}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Avis opérateur */}
        <Section title="Avis opérateur sur le profil" icon={MessageSquare} defaultOpen colorClass="bg-[hsl(45,50%,95%)]">
          <Textarea
            value={noteOperateur}
            onChange={e => setNoteOperateur(e.target.value)}
            rows={3}
            placeholder="Saisir un avis sur ce profil..."
            className="resize-none bg-background/60 border-border focus:bg-background"
          />
          <div className="flex justify-end mt-2">
            <Button size="sm" onClick={() => updateMutation.mutate({ note_operateur: noteOperateur || null })} disabled={updateMutation.isPending} className="gap-1.5">
              <Save className="h-3.5 w-3.5" /> Enregistrer
            </Button>
          </div>
        </Section>

        {/* Média — Upload & Download */}
        <Section title="Média" icon={Image} defaultOpen colorClass="bg-[hsl(270,25%,96%)]">
          <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleUpload(e.target.files[0], "photo"); }} />
          <input ref={cinRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleUpload(e.target.files[0], "cin"); }} />
          <input ref={attestationRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleUpload(e.target.files[0], "attestation"); }} />

          <div className="grid grid-cols-3 gap-4">
            {/* Photo */}
            <div className="text-center space-y-2">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Photo de profil</p>
              <div
                onClick={() => p.photo_url ? window.open(p.photo_url, "_blank") : photoRef.current?.click()}
                className="h-28 w-28 mx-auto rounded-lg bg-muted flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all relative group"
              >
                {p.photo_url ? (
                  <>
                    <img src={p.photo_url} alt="Photo" className="h-full w-full object-cover rounded-lg" />
                    <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Download className="h-5 w-5 text-white" />
                    </div>
                  </>
                ) : (
                  <User className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => photoRef.current?.click()} disabled={uploading === "photo"}>
                <Upload className="h-3 w-3" /> {uploading === "photo" ? "Upload..." : "Télécharger"}
              </Button>
            </div>

            {/* CIN */}
            <div className="text-center space-y-2">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">CIN</p>
              <div
                onClick={() => p.cin_url ? window.open(p.cin_url, "_blank") : cinRef.current?.click()}
                className="h-28 w-28 mx-auto rounded-lg bg-muted flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all relative group"
              >
                {p.cin_url ? (
                  <>
                    <img src={p.cin_url} alt="CIN" className="h-full w-full object-cover rounded-lg" />
                    <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Download className="h-5 w-5 text-white" />
                    </div>
                  </>
                ) : (
                  <IdCard className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => cinRef.current?.click()} disabled={uploading === "cin"}>
                <Upload className="h-3 w-3" /> {uploading === "cin" ? "Upload..." : "Télécharger"}
              </Button>
            </div>

            {/* Attestation */}
            <div className="text-center space-y-2">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Attestation</p>
              <div
                onClick={() => p.attestation_url ? window.open(p.attestation_url, "_blank") : attestationRef.current?.click()}
                className="h-28 w-28 mx-auto rounded-lg bg-muted flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all relative group"
              >
                {p.attestation_url ? (
                  <>
                    <img src={p.attestation_url} alt="Attestation" className="h-full w-full object-cover rounded-lg" />
                    <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Download className="h-5 w-5 text-white" />
                    </div>
                  </>
                ) : (
                  <CreditCard className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => attestationRef.current?.click()} disabled={uploading === "attestation"}>
                <Upload className="h-3 w-3" /> {uploading === "attestation" ? "Upload..." : "Télécharger"}
              </Button>
            </div>
          </div>
        </Section>

        {/* Solde financier */}
        {missions.length > 0 && (() => {
          const totalCA = missions.reduce((s: number, m: any) => s + (Number(m.montant_total) || 0), 0);
          const nbMissions = missions.length;
          const profilDoitAgence = missions
            .filter((m: any) => m.encaisse_par === "profil" && !m.part_agence_reversee)
            .reduce((s: number, m: any) => s + partAgence(m), 0);
          const agenceDoitProfil = missions
            .filter((m: any) => m.encaisse_par !== "profil" && !m.part_profil_versee)
            .reduce((s: number, m: any) => s + partProfil(m), 0);
          const factAnnulee = missions
            .filter((m: any) => m.statut_mission === "facturation_annulee")
            .reduce((s: number, m: any) => s + (Number(m.montant_total) || 0), 0);
          const nbFactAnnulee = missions.filter((m: any) => m.statut_mission === "facturation_annulee").length;
          const fmt = (n: number) => n.toLocaleString("fr-MA") + " DH";
          return (
            <Section title="Solde financier" icon={CreditCard} defaultOpen colorClass="bg-[hsl(30,40%,95%)]">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1">Total CA généré</p>
                  <p className="text-2xl font-bold text-primary">{fmt(totalCA)}</p>
                </div>
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1">Nombre de missions</p>
                  <p className="text-2xl font-bold text-primary">{nbMissions}</p>
                </div>
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1">Le profil doit à l'agence</p>
                  <p className="text-2xl font-bold text-destructive">{fmt(profilDoitAgence)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Part agence non reversée</p>
                </div>
                <div className="rounded-lg border border-sky-300/50 bg-sky-50/50 p-4 text-center">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1">L'agence doit au profil</p>
                  <p className="text-2xl font-bold text-sky-700">{fmt(agenceDoitProfil)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Part profil non versée</p>
                </div>
              </div>
            </Section>
          );
        })()}

        {/* Évaluation Profil */}
        <Section title="Évaluation Profil" icon={ClipboardCheck} defaultOpen colorClass="bg-[hsl(45,60%,95%)]">
          {feedbacks.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Étoiles</TableHead>
                  <TableHead>Satisfaction</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feedbacks.map((f: any) => {
                  const stMap: Record<string, { label: string; color: string }> = {
                    en_attente: { label: "En attente", color: "bg-yellow-100 text-yellow-800" },
                    lien_envoye: { label: "Lien envoyé", color: "bg-blue-100 text-blue-800" },
                    positif: { label: "Positif", color: "bg-green-100 text-green-800" },
                    negatif: { label: "Négatif", color: "bg-red-100 text-red-800" },
                  };
                  const st = stMap[f.statut as string] || stMap.en_attente;
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="text-xs">{f.date_prestation || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {f.nom_client ? (
                          <button
                            className="text-primary hover:underline cursor-pointer font-medium"
                            onClick={() => {
                              supabase.from("demandes").select("id").ilike("nom", f.nom_client.trim()).limit(1).then(({ data }) => {
                                if (data && data.length > 0) {
                                  navigate(`/compte-client?id=${data[0].id}&from=/compte-profil?id=${profilId}`);
                                }
                              });
                            }}
                          >
                            {f.nom_client}
                          </button>
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
                      <TableCell>
                        {f.satisfaction ? (
                          <Badge className={
                            f.satisfaction === "Très satisfait" || f.satisfaction === "Satisfait"
                              ? "bg-green-100 text-green-800" : f.satisfaction === "Pas satisfait"
                              ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"
                          }>{f.satisfaction}</Badge>
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
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">Aucune évaluation pour le moment</p>
          )}
        </Section>

        <Section title="Historique Mission" icon={Briefcase} defaultOpen colorClass="bg-[hsl(160,30%,95%)]">
          {missions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Aucune mission pour le moment</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Feedback</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {missions.map((m: any) => {
                  const fb = feedbacks.find((f: any) => f.demande_id === m.demande_id);
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs">M-{m.num_mission}</TableCell>
                      <TableCell className="text-xs">{m.date_intervention ? format(new Date(m.date_intervention), "dd/MM/yyyy") : "—"}</TableCell>
                      <TableCell className="text-sm">{m.nom_client}</TableCell>
                      <TableCell className="text-xs">{m.type_service || "—"}</TableCell>
                      <TableCell className="font-semibold text-sm">{m.montant_total?.toLocaleString("fr-MA")} DH</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{m.statut_mission}</Badge></TableCell>
                      <TableCell>
                        {fb ? (
                          <div className="flex items-center gap-1.5">
                            {fb.statut === "positif" ? (
                              <Badge className="bg-green-100 text-green-800 text-[10px]"><ThumbsUp className="h-3 w-3 mr-1" />Positif</Badge>
                            ) : fb.statut === "negatif" ? (
                              <Badge className="bg-red-100 text-red-800 text-[10px]"><ThumbsDown className="h-3 w-3 mr-1" />Négatif</Badge>
                            ) : (
                              <Badge className="bg-yellow-100 text-yellow-800 text-[10px]">En attente</Badge>
                            )}
                            {fb.note_agence && (
                              <span className="flex items-center gap-0.5">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star key={i} className={`h-3 w-3 ${i < fb.note_agence ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                                ))}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Section>

        {/* Historique actions */}
        <Section title="Historique" icon={History} defaultOpen colorClass="bg-[hsl(220,30%,96%)]">
          <div className="mb-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher une action..." value={histSearch} onChange={e => setHistSearch(e.target.value)} className="pl-9 h-9" />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Note</TableHead>
                <TableHead>Utilisateur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-sm">Aucun historique</TableCell>
                </TableRow>
              ) : allHistory.map((h, idx) => (
                <TableRow key={idx}>
                  <TableCell className="text-xs whitespace-nowrap">{format(new Date(h.date), "dd/MM/yy HH:mm", { locale: fr })}</TableCell>
                  <TableCell className="text-sm">{h.action}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{h.note || "—"}</TableCell>
                  <TableCell className="text-xs">{h.utilisateur}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
      </div>

      {/* Modals */}
      <PostulerModal open={showPostuler} onOpenChange={setShowPostuler} profil={p} />
      <EditProfilModal
        open={showEdit}
        onOpenChange={setShowEdit}
        profil={p}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["profil", profilId] })}
      />

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
    </div>
  );
}
