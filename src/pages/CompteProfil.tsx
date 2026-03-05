import { useState } from "react";
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
  Save, Search, Phone, MapPin, CreditCard, Calendar, IdCard,
} from "lucide-react";
import {
  PRESENTATIONS_PHYSIQUES, CORPULENCES, STATUT_PROFIL_OPTIONS,
} from "@/lib/profil-constants";

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
        .from("profil_historique")
        .select("*")
        .eq("profil_id", profilId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profilId,
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
        <Button variant="outline" size="sm" onClick={() => navigate("/profils")}>
          <ArrowLeft className="h-4 w-4 mr-1" />Retour
        </Button>
      </div>
    );
  }

  const p = profil;
  const languesArr: string[] = Array.isArray(p.langue) ? p.langue : [];
  const experiences: any[] = Array.isArray(p.experiences) ? p.experiences : [];
  const statutOpt = STATUT_PROFIL_OPTIONS.find(s => s.value === p.statut_profil);
  const presOpt = PRESENTATIONS_PHYSIQUES.find(pr => pr.value === p.presentation_physique);
  const corpOpt = CORPULENCES.find(c => c.value === p.corpulence);

  const age = p.date_naissance
    ? Math.floor((Date.now() - new Date(p.date_naissance).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const filteredHist = histSearch
    ? historique.filter((h: any) => h.action?.toLowerCase().includes(histSearch.toLowerCase()) || h.note?.toLowerCase().includes(histSearch.toLowerCase()))
    : historique;

  // Auto-generated history entries
  const autoHistory = [
    { date: p.created_at, action: "Profil créé", note: "", utilisateur: "Système" },
  ];

  const allHistory = [...autoHistory, ...filteredHist.map((h: any) => ({
    date: h.created_at,
    action: h.action,
    note: h.note || "",
    utilisateur: h.utilisateur || "—",
  }))].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
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
                  <Badge variant="outline" className={cn("border-0 text-xs", statutOpt.color)}>
                    {statutOpt.label}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">{p.type_profil || "Non défini"}</span>
                {p.telephone && <span className="text-xs text-muted-foreground">• {p.telephone}</span>}
              </div>
            </div>
          </div>
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
            <InfoItem label="Formation requise" value={p.formation_requise ? "Oui" : "Non"} />
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

        {/* Média */}
        <Section title="Média" icon={Image} defaultOpen colorClass="bg-[hsl(270,25%,96%)]">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Photo de profil</p>
              <div className="h-24 w-24 mx-auto rounded-lg bg-muted flex items-center justify-center">
                {p.photo_url ? (
                  <img src={p.photo_url} alt="Photo" className="h-full w-full object-cover rounded-lg" />
                ) : (
                  <User className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
            </div>
            <div className="text-center">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">CIN</p>
              <div className="h-24 w-24 mx-auto rounded-lg bg-muted flex items-center justify-center">
                {p.cin_url ? (
                  <img src={p.cin_url} alt="CIN" className="h-full w-full object-cover rounded-lg" />
                ) : (
                  <IdCard className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
            </div>
            <div className="text-center">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Attestation</p>
              <div className="h-24 w-24 mx-auto rounded-lg bg-muted flex items-center justify-center">
                {p.attestation_url ? (
                  <img src={p.attestation_url} alt="Attestation" className="h-full w-full object-cover rounded-lg" />
                ) : (
                  <CreditCard className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
            </div>
          </div>
        </Section>

        {/* Historique Mission */}
        <Section title="Historique Mission" icon={Briefcase} defaultOpen colorClass="bg-[hsl(160,30%,95%)]">
          <p className="text-sm text-muted-foreground">Les missions assignées à ce profil apparaîtront ici automatiquement.</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-sm">Aucune mission pour le moment</TableCell>
              </TableRow>
            </TableBody>
          </Table>
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
    </div>
  );
}
