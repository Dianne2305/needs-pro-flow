/**
 * AddProfilModal.tsx
 * Modal de création d'un profil Femme de ménage (FDM).
 * Design aligné sur la maquette PDF fournie (Canva) :
 *  - En-tête : Informations personnelles (gauche), Date d'enregistrement (centre), Type de profil (droite).
 *  - Grille identité en 3 colonnes.
 *  - Langues + "Sait lire et écrire" sur la même ligne.
 *  - Bloc "Expérience" (années / mois).
 *  - Bloc "Caractéristiques" avec fond gris clair.
 *  - Statut profil placé sous les caractéristiques.
 *  - Calendrier de disponibilité (une ligne par jour).
 *  - Disponibilités additionnelles : Urgences / Jours fériés / Soirée.
 *  - Remarque du recruteur (fond gris clair).
 *  - Bloc "Média (Documents et Photos)" : 3 photos + CIN + Attestation + Fiche antropométrique.
 *  - Bloc "Les expériences" avec bouton "+ Ajouter un poste".
 *  - Barre d'actions : Annuler / Enregistrer.
 */
import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Plus, Save, X, UserRound, RefreshCw, Search, FileText, Image as ImageIcon, XCircle } from "lucide-react";
import {
  LANGUES, SITUATIONS_MATRIMONIALES, NATIONALITES,
  PRESENTATIONS_PHYSIQUES, CORPULENCES, TYPES_PROFIL, TYPES_POSTE_EXPERIENCE,
  LIEUX_TRAVAIL, TACHES_MENAGE, DEFAULT_DISPONIBILITE_CALENDRIER,
  JOURS_SEMAINE,
  type DisponibiliteCalendrier,
} from "@/lib/profil-constants";
import { TYPES_PRESTATION } from "@/lib/constants";
import { StatutProfilField, type StatutProfilValue } from "./StatutProfilField";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

interface ExperienceForm {
  poste: string;
  duree_menage: string;
  lieux_travail: string[];
  allergies: boolean;
  taches: string[];
  grand_menage: boolean;
}

/** Bloc calendrier inline (une ligne par jour) — style maquette. */
function CalendrierRows({
  value, onChange,
}: { value: DisponibiliteCalendrier; onChange: (v: DisponibiliteCalendrier) => void }) {
  const cal = { ...DEFAULT_DISPONIBILITE_CALENDRIER, ...(value || {}) };
  const set = (k: string, patch: Partial<DisponibiliteCalendrier[string]>) =>
    onChange({ ...cal, [k]: { ...cal[k], ...patch } });
  return (
    <div className="border rounded-lg divide-y bg-background">
      {JOURS_SEMAINE.map(j => {
        const d = cal[j.key];
        return (
          <div key={j.key} className="grid grid-cols-[1fr,auto,auto,auto] items-center gap-3 px-4 py-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id={`add-cal-${j.key}`}
                checked={d.actif}
                onCheckedChange={v => set(j.key, { actif: !!v })}
              />
              <Label htmlFor={`add-cal-${j.key}`} className="text-sm font-medium cursor-pointer">{j.label}</Label>
            </div>
            <Input
              type="time" value={d.debut} disabled={!d.actif}
              onChange={e => set(j.key, { debut: e.target.value })}
              className="h-9 w-32"
            />
            <span className="text-xs text-muted-foreground">à</span>
            <Input
              type="time" value={d.fin} disabled={!d.actif}
              onChange={e => set(j.key, { fin: e.target.value })}
              className="h-9 w-32"
            />
          </div>
        );
      })}
    </div>
  );
}

export function AddProfilModal({ open, onOpenChange, onSuccess }: Props) {
  const [saving, setSaving] = useState(false);

  // Identité
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [quartier, setQuartier] = useState("");
  const [ville, setVille] = useState("Casablanca");
  const [numeroCin, setNumeroCin] = useState("");
  const [dateNaissance, setDateNaissance] = useState("");
  const [sexe, setSexe] = useState("");
  const [telephone, setTelephone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [situationMatrimoniale, setSituationMatrimoniale] = useState("");
  const [aDesEnfants, setADesEnfants] = useState(false);
  const [nationalite, setNationalite] = useState("Marocaine");
  const [nationaliteAutre, setNationaliteAutre] = useState("");
  const [langues, setLangues] = useState<string[]>([]);
  const [saitLireEcrire, setSaitLireEcrire] = useState(false);

  // Expérience globale
  const [expAnnees, setExpAnnees] = useState(0);
  const [expMois, setExpMois] = useState(0);

  // Type profil
  const [typeProfil, setTypeProfil] = useState("");

  // Caractéristiques
  const [maladieHandicap, setMaladieHandicap] = useState("");
  const [presentationPhysique, setPresentationPhysique] = useState("");
  const [corpulence, setCorpulence] = useState("");
  const [allergieAnimaux, setAllergieAnimaux] = useState(false);
  const [pointureChaussures, setPointureChaussures] = useState<string>("");

  // Statut
  const [statut, setStatut] = useState<StatutProfilValue>({ statut: "active" });

  // Calendrier & dispos rapides
  const [calendrier, setCalendrier] = useState<DisponibiliteCalendrier>(DEFAULT_DISPONIBILITE_CALENDRIER);
  const [dispoUrgences, setDispoUrgences] = useState(false);
  const [dispoJoursFeries, setDispoJoursFeries] = useState(false);
  const [dispoSoiree, setDispoSoiree] = useState(false);

  // Remarque
  const [remarqueRecruteur, setRemarqueRecruteur] = useState("");
  const dateEnregistrement = format(new Date(), "dd/MM/yyyy");

  // Domaine d'intervention
  const [servicesAffectables, setServicesAffectables] = useState<string[]>([]);
  const [segmentAffectable, setSegmentAffectable] = useState<string>("tout");
  const [autreService, setAutreService] = useState("");
  const toggleService = (s: string) =>
    setServicesAffectables(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);


  // Expériences détaillées
  const [experiences, setExperiences] = useState<ExperienceForm[]>([]);
  const [showExpForm, setShowExpForm] = useState(false);
  const [currentExp, setCurrentExp] = useState<ExperienceForm>({
    poste: "", duree_menage: "", lieux_travail: [], allergies: false, taches: [], grand_menage: false,
  });

  // Media
  const [photo1, setPhoto1] = useState<File | null>(null);
  const [photo2, setPhoto2] = useState<File | null>(null);
  const [cinRectoFile, setCinRectoFile] = useState<File | null>(null);
  const [cinVersoFile, setCinVersoFile] = useState<File | null>(null);
  const [attestationFile, setAttestationFile] = useState<File | null>(null);
  const [ficheFile, setFicheFile] = useState<File | null>(null);

  const p1Ref = useRef<HTMLInputElement>(null);
  const p2Ref = useRef<HTMLInputElement>(null);
  const cinRectoRef = useRef<HTMLInputElement>(null);
  const cinVersoRef = useRef<HTMLInputElement>(null);
  const attRef = useRef<HTMLInputElement>(null);
  const ficheRef = useRef<HTMLInputElement>(null);

  const toggleLangue = (l: string) =>
    setLangues(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]);
  const toggleLieu = (l: string) =>
    setCurrentExp(prev => ({ ...prev, lieux_travail: prev.lieux_travail.includes(l) ? prev.lieux_travail.filter(x => x !== l) : [...prev.lieux_travail, l] }));
  const toggleTache = (t: string) =>
    setCurrentExp(prev => ({ ...prev, taches: prev.taches.includes(t) ? prev.taches.filter(x => x !== t) : [...prev.taches, t] }));
  const addExperience = () => {
    if (!currentExp.poste) return;
    setExperiences(prev => [...prev, currentExp]);
    setCurrentExp({ poste: "", duree_menage: "", lieux_travail: [], allergies: false, taches: [], grand_menage: false });
    setShowExpForm(false);
  };
  const removeExperience = (idx: number) => setExperiences(prev => prev.filter((_, i) => i !== idx));

  const uploadFile = async (file: File, profilId: string, type: string) => {
    const ext = file.name.split(".").pop();
    const path = `${profilId}/${type}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("profil-media").upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from("profil-media").getPublicUrl(path);
    return data.publicUrl;
  };

  const calendrierAuMoinsUnJour = Object.values(calendrier).some(j => j.actif);

  const handleSave = async () => {
    if (!nom.trim() || !prenom.trim()) {
      toast({ title: "Erreur", description: "Nom et prénom sont requis.", variant: "destructive" });
      return;
    }
    if (!calendrierAuMoinsUnJour) {
      toast({ title: "Disponibilité manquante", description: "Cochez au moins un jour dans le calendrier de disponibilité.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const finalNationalite = nationalite === "Autre" ? nationaliteAutre : nationalite;
      const finalStatut = statut.statut;
      const { data: inserted, error } = await supabase.from("profils").insert({
        nom: nom.trim(), prenom: prenom.trim(), quartier: quartier || null, ville,
        numero_cin: numeroCin || null, date_naissance: dateNaissance || null,
        sexe: sexe || null, telephone: telephone || null, whatsapp: whatsapp || null,
        situation_matrimoniale: situationMatrimoniale || null, a_des_enfants: aDesEnfants,
        nationalite: finalNationalite, langue: langues as any,
        experience_annees: expAnnees, experience_mois: expMois,
        statut_profil: finalStatut,
        standby_jours: finalStatut === "stand_by" ? statut.standbyJours ?? null : null,
        standby_debut: finalStatut === "stand_by" ? new Date().toISOString() : null,
        conge_debut: finalStatut === "en_conge" ? statut.congeDebut ?? null : null,
        conge_fin: finalStatut === "en_conge" ? statut.congeFin ?? null : null,
        type_profil: typeProfil || null,
        sait_lire_ecrire: saitLireEcrire, maladie_handicap: maladieHandicap || null,
        presentation_physique: presentationPhysique || null, corpulence: corpulence || null,
        dispo_urgences: dispoUrgences, dispo_soiree: dispoSoiree,
        dispo_jours_feries: dispoJoursFeries,
        disponibilite_calendrier: calendrier as any,
        allergie_animaux: allergieAnimaux,
        pointure_chaussures: pointureChaussures ? Number(pointureChaussures) : null,
        remarque_recruteur: remarqueRecruteur || null,
        experiences: experiences as any,
        services_affectables: servicesAffectables as any,
        segment_affectable: segmentAffectable,
        autre_service: autreService || null,
      } as any).select("id").single();
      if (error) throw error;

      const updates: Record<string, string> = {};
      if (photo1 && inserted) updates.photo_url = await uploadFile(photo1, inserted.id, "photo1");
      if (photo2 && inserted) updates.photo2_url = await uploadFile(photo2, inserted.id, "photo2");
      if (cinRectoFile && inserted) updates.cin_url = await uploadFile(cinRectoFile, inserted.id, "cin_recto");
      if (cinVersoFile && inserted) updates.cin_verso_url = await uploadFile(cinVersoFile, inserted.id, "cin_verso");
      if (attestationFile && inserted) updates.attestation_url = await uploadFile(attestationFile, inserted.id, "attestation");
      if (ficheFile && inserted) updates.fiche_antropometrique_url = await uploadFile(ficheFile, inserted.id, "fiche");
      if (Object.keys(updates).length > 0 && inserted) {
        await supabase.from("profils").update(updates as any).eq("id", inserted.id);
      }

      toast({ title: "Profil enregistré avec succès" });
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  /** Composant réutilisable pour les uploads media (style maquette). */
  const FilePicker = ({
    label, file, setFile, refEl, accept, Icon,
  }: {
    label: string; file: File | null; setFile: (f: File | null) => void;
    refEl: React.RefObject<HTMLInputElement>; accept: string;
    Icon: React.ElementType;
  }) => (
    <div>
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <input ref={refEl} type="file" accept={accept} className="hidden"
        onChange={e => e.target.files?.[0] && setFile(e.target.files[0])} />
      <Button
        type="button" variant="outline"
        className="w-full mt-1 h-11 justify-center gap-2 font-normal text-sm rounded-lg"
        onClick={() => refEl.current?.click()}
      >
        <Icon className="h-4 w-4 text-primary" />
        <span className="truncate">{file ? file.name : (label === "PHOTO 1" || label === "PHOTO 2" || label === "PHOTO 3" ? "Choisir l'image" : "Choisir un fichier")}</span>
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle className="text-lg font-bold">Ajouter une femme de ménage</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[80vh]">
          <div className="px-6 py-5 space-y-6">

            {/* ==== HEADER : Informations personnelles + Date + Type ==== */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="flex items-center gap-2 text-primary">
                <UserRound className="h-4 w-4" />
                <h3 className="text-sm font-bold">Informations personnelles</h3>
              </div>
              <div>
                <Label className="text-xs text-foreground/80">Date d'enregistrement</Label>
                <Input value={dateEnregistrement} readOnly className="mt-1 bg-muted/30 text-center" />
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Type de profil <span className="text-destructive">*</span>
                </Label>
                <Select value={typeProfil} onValueChange={setTypeProfil}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>{TYPES_PROFIL.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* ==== Grille identité ==== */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-4">
              <div>
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Nom <span className="text-destructive">*</span></Label>
                <Input value={nom} onChange={e => setNom(e.target.value)} placeholder="Bernat" className="mt-1" />
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Prénom <span className="text-destructive">*</span></Label>
                <Input value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="Jean" className="mt-1" />
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Quartier <span className="text-destructive">*</span></Label>
                <Input value={quartier} onChange={e => setQuartier(e.target.value)} placeholder="Saisir le quartier" className="mt-1" />
              </div>

              <div>
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Ville <span className="text-destructive">*</span></Label>
                <Input value={ville} onChange={e => setVille(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Numéro CIN <span className="text-destructive">*</span></Label>
                <Input value={numeroCin} onChange={e => setNumeroCin(e.target.value)} placeholder="Z123456" className="mt-1" />
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Date de naissance <span className="text-destructive">*</span></Label>
                <Input type="date" value={dateNaissance} onChange={e => setDateNaissance(e.target.value)} className="mt-1" />
              </div>

              <div>
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Sexe <span className="text-destructive">*</span></Label>
                <Select value={sexe} onValueChange={setSexe}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="homme">Homme</SelectItem>
                    <SelectItem value="femme">Femme</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Téléphone <span className="text-destructive">*</span></Label>
                <Input value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="06.." className="mt-1" />
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">WhatsApp <span className="text-destructive">*</span></Label>
                <Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="06.." className="mt-1" />
              </div>

              <div>
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Situation matrimoniale <span className="text-destructive">*</span></Label>
                <Select value={situationMatrimoniale} onValueChange={setSituationMatrimoniale}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>{SITUATIONS_MATRIMONIALES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-end justify-end pb-2">
                <div className="flex items-center gap-2">
                  <Checkbox id="add-enfants" checked={aDesEnfants} onCheckedChange={v => setADesEnfants(!!v)} />
                  <Label htmlFor="add-enfants" className="text-sm cursor-pointer">A des enfants</Label>
                </div>
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Nationalité <span className="text-destructive">*</span></Label>
                <Select value={nationalite} onValueChange={setNationalite}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{NATIONALITES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {nationalite === "Autre" && (
                <div className="md:col-span-3">
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Préciser la nationalité</Label>
                  <Input value={nationaliteAutre} onChange={e => setNationaliteAutre(e.target.value)} className="mt-1" />
                </div>
              )}
            </div>

            {/* ==== Langues + Sait lire/écrire ==== */}
            <div>
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Langues <span className="text-destructive">*</span></Label>
              <div className="flex items-center justify-between gap-4 mt-2 flex-wrap">
                <div className="flex flex-wrap gap-2">
                  {LANGUES.map(l => (
                    <Badge
                      key={l}
                      variant={langues.includes(l) ? "default" : "outline"}
                      className="cursor-pointer rounded-full px-4 py-1 text-sm font-normal"
                      onClick={() => toggleLangue(l)}
                    >
                      {l}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="add-lire-top" checked={saitLireEcrire} onCheckedChange={v => setSaitLireEcrire(!!v)} />
                  <Label htmlFor="add-lire-top" className="text-sm cursor-pointer">Sait lire et écrire</Label>
                </div>
              </div>
            </div>

            {/* ==== Expérience ==== */}
            <div>
              <h3 className="text-base font-bold text-foreground mb-3">Expérience</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Expérience (années)</Label>
                  <Input type="number" min={0} value={expAnnees} onChange={e => setExpAnnees(Number(e.target.value))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Expérience (mois)</Label>
                  <Input type="number" min={0} max={11} value={expMois} onChange={e => setExpMois(Number(e.target.value))} className="mt-1" />
                </div>
              </div>
            </div>

            {/* ==== Caractéristiques ==== */}
            <div>
              <h3 className="text-base font-bold text-foreground mb-3">Caractéristiques</h3>
              <div className="rounded-xl border bg-muted/40 p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Maladie / Handicap</Label>
                  <Input
                    value={maladieHandicap}
                    onChange={e => setMaladieHandicap(e.target.value)}
                    placeholder="Aucun"
                    className="mt-1 bg-background"
                  />
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Présentation physique</Label>
                  <Select value={presentationPhysique} onValueChange={setPresentationPhysique}>
                    <SelectTrigger className="mt-1 bg-background"><SelectValue placeholder="Choisir" /></SelectTrigger>
                    <SelectContent>{PRESENTATIONS_PHYSIQUES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Corpulence</Label>
                  <Select value={corpulence} onValueChange={setCorpulence}>
                    <SelectTrigger className="mt-1 bg-background"><SelectValue placeholder="Choisir" /></SelectTrigger>
                    <SelectContent>{CORPULENCES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Pointure de chaussures</Label>
                  <Input
                    type="number"
                    min={30}
                    max={50}
                    value={pointureChaussures}
                    onChange={e => setPointureChaussures(e.target.value)}
                    placeholder="Ex: 38"
                    className="mt-1 bg-background"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <div className="flex items-center gap-2 h-9 bg-background rounded-md border px-3">
                    <Checkbox id="add-allergie-anim" checked={allergieAnimaux} onCheckedChange={v => setAllergieAnimaux(!!v)} />
                    <Label htmlFor="add-allergie-anim" className="text-sm cursor-pointer">Allergie aux animaux</Label>
                  </div>
                </div>
              </div>
            </div>

            {/* ==== Statut profil ==== */}
            <div className="max-w-sm">
              <StatutProfilField value={statut} onChange={setStatut} idPrefix="add" />
            </div>

            {/* ==== Calendrier ==== */}
            <div>
              <Label className="text-sm text-foreground/80">
                Calendrier de disponibilité <span className="text-destructive">*</span>
              </Label>
              <div className="mt-2">
                <CalendrierRows value={calendrier} onChange={setCalendrier} />
              </div>
              {!calendrierAuMoinsUnJour && (
                <p className="text-[11px] text-destructive mt-1">Au moins un jour requis.</p>
              )}
            </div>

            {/* ==== Disponibilités additionnelles ==== */}
            <div>
              <h3 className="text-base font-semibold text-foreground mb-3">Disponibilités additionnelles</h3>
              <div className="flex flex-wrap gap-6">
                {[
                  { id: "add-urg", label: "Disponible pour les urgences", checked: dispoUrgences, set: setDispoUrgences },
                  { id: "add-ferie", label: "Jours fériés", checked: dispoJoursFeries, set: setDispoJoursFeries },
                  { id: "add-soir", label: "Soirée (après 18h)", checked: dispoSoiree, set: setDispoSoiree },
                ].map(d => (
                  <div key={d.id} className="flex items-center gap-2">
                    <Checkbox id={d.id} checked={d.checked} onCheckedChange={v => d.set(!!v)} />
                    <Label htmlFor={d.id} className="text-sm cursor-pointer">{d.label}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* ==== Domaine d'intervention ==== */}
            <div>
              <h3 className="text-lg font-bold text-foreground mb-3">Domaine d'intervention</h3>
              <div className="rounded-xl border bg-muted/40 p-4 space-y-4">
                <div>
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Services affectables
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                    {TYPES_PRESTATION.map(s => (
                      <div key={s} className="flex items-center gap-2 bg-background rounded-md border px-3 h-9">
                        <Checkbox
                          id={`add-svc-${s}`}
                          checked={servicesAffectables.includes(s)}
                          onCheckedChange={() => toggleService(s)}
                        />
                        <Label htmlFor={`add-svc-${s}`} className="text-sm cursor-pointer">{s}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Autre service
                  </Label>
                  <Textarea
                    value={autreService}
                    onChange={e => setAutreService(e.target.value)}
                    rows={2}
                    placeholder="Préciser un service non listé…"
                    className="resize-none mt-1 bg-background"
                  />
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Segment affectable
                  </Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {[
                      { value: "tout", label: "Tout" },
                      { value: "particulier", label: "Particulier" },
                      { value: "entreprise", label: "Entreprise" },
                    ].map(o => (
                      <Badge
                        key={o.value}
                        variant={segmentAffectable === o.value ? "default" : "outline"}
                        className="cursor-pointer rounded-full px-4 py-1 text-sm font-normal"
                        onClick={() => setSegmentAffectable(o.value)}
                      >
                        {o.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ==== Remarque du recruteur ==== */}
            <div className="rounded-xl border bg-muted/40 p-4">
              <Label className="text-sm">Remarque du recruteur</Label>
              <Textarea
                value={remarqueRecruteur}
                onChange={e => setRemarqueRecruteur(e.target.value)}
                rows={3}
                placeholder="Visible uniquement sur le profil interne et sur la fiche envoyée au client…"
                className="resize-none mt-2 bg-background"
              />
            </div>

            {/* ==== Média ==== */}
            <div className="rounded-xl border p-4">
              <div className="flex items-center gap-2 mb-4 text-primary">
                <Save className="h-4 w-4" />
                <h3 className="text-sm font-bold">Média (Documents et Photos)</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FilePicker label="PHOTO 1" file={photo1} setFile={setPhoto1} refEl={p1Ref} accept="image/*" Icon={UserRound} />
                <FilePicker label="PHOTO 2" file={photo2} setFile={setPhoto2} refEl={p2Ref} accept="image/*" Icon={UserRound} />
                <FilePicker label="CIN RECTO" file={cinRectoFile} setFile={setCinRectoFile} refEl={cinRectoRef} accept="image/*,.pdf" Icon={Search} />
                <FilePicker label="CIN VERSO" file={cinVersoFile} setFile={setCinVersoFile} refEl={cinVersoRef} accept="image/*,.pdf" Icon={Search} />
                <FilePicker label="ATTESTATION" file={attestationFile} setFile={setAttestationFile} refEl={attRef} accept="image/*,.pdf" Icon={RefreshCw} />
                <FilePicker label="FICHE ANTROPOMÉTRIQUE" file={ficheFile} setFile={setFicheFile} refEl={ficheRef} accept="image/*,.pdf" Icon={FileText} />
              </div>
            </div>

            {/* ==== Les expériences ==== */}
            <div className="rounded-xl border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-primary">
                  <RefreshCw className="h-4 w-4" />
                  <h3 className="text-sm font-bold">Les expériences</h3>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowExpForm(true)} className="gap-1.5 rounded-lg">
                  <Plus className="h-3.5 w-3.5" /> Ajouter un poste
                </Button>
              </div>
              {experiences.length === 0 && !showExpForm && (
                <p className="text-xs text-muted-foreground text-center py-4">Aucun poste ajouté</p>
              )}
              {experiences.map((exp, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg mb-2">
                  <div>
                    <span className="font-medium text-sm">{exp.poste}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {exp.taches.length} tâches • {exp.lieux_travail.length} lieux
                    </span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeExperience(idx)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {showExpForm && (
                <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
                  <div>
                    <Label className="text-xs">Poste</Label>
                    <Select value={currentExp.poste} onValueChange={v => setCurrentExp(prev => ({ ...prev, poste: v }))}>
                      <SelectTrigger><SelectValue placeholder="Choisir le poste" /></SelectTrigger>
                      <SelectContent>{TYPES_POSTE_EXPERIENCE.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {currentExp.poste === "Femme de ménage" && (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">Depuis combien de temps ?</Label>
                        <Input value={currentExp.duree_menage} onChange={e => setCurrentExp(prev => ({ ...prev, duree_menage: e.target.value }))} placeholder="Ex: 3 ans" />
                      </div>
                      <div>
                        <Label className="text-xs">Lieux de travail</Label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {LIEUX_TRAVAIL.map(l => (
                            <Badge key={l} variant={currentExp.lieux_travail.includes(l) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleLieu(l)}>{l}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox checked={currentExp.allergies} onCheckedChange={v => setCurrentExp(prev => ({ ...prev, allergies: !!v }))} id="add-allergies" />
                        <Label htmlFor="add-allergies" className="text-xs">Allergies produits ménagers</Label>
                      </div>
                      <div>
                        <Label className="text-xs">Tâches</Label>
                        <div className="grid grid-cols-2 gap-1.5 mt-1">
                          {TACHES_MENAGE.map(t => (
                            <div key={t} className="flex items-center gap-2">
                              <Checkbox checked={currentExp.taches.includes(t)} onCheckedChange={() => toggleTache(t)} id={`add-tache-${t}`} />
                              <Label htmlFor={`add-tache-${t}`} className="text-xs">{t}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox checked={currentExp.grand_menage} onCheckedChange={v => setCurrentExp(prev => ({ ...prev, grand_menage: !!v }))} id="add-gm" />
                        <Label htmlFor="add-gm" className="text-xs">Grand ménage</Label>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setShowExpForm(false)}>Annuler</Button>
                    <Button size="sm" onClick={addExperience} disabled={!currentExp.poste}>Ajouter</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* ==== Actions ==== */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t bg-background">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="gap-1.5 rounded-lg">
            <XCircle className="h-4 w-4" /> Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5 rounded-lg">
            <Save className="h-4 w-4" /> Enregistrer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
