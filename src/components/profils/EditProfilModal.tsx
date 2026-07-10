/**
 * EditProfilModal.tsx
 * Modal d'édition d'un profil Femme de ménage.
 * Structure alignée sur AddProfilModal :
 *  - Statut & Blacklisté en haut.
 *  - Calendrier de disponibilité obligatoire.
 *  - Champs : allergie animaux, pointure, remarque recruteur.
 *  - Retirés : formation requise, note opérateur.
 */
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Plus, Save, X } from "lucide-react";
import {
  LANGUES, NIVEAUX_ETUDE, SITUATIONS_MATRIMONIALES, NATIONALITES,
  PRESENTATIONS_PHYSIQUES, CORPULENCES, TYPES_PROFIL, TYPES_POSTE_EXPERIENCE,
  LIEUX_TRAVAIL, TACHES_MENAGE, DEFAULT_DISPONIBILITE_CALENDRIER,
  DISPONIBILITE_INTERVENTION_OPTIONS, FUME_OPTIONS,
  type DisponibiliteCalendrier,
} from "@/lib/profil-constants";
import { AvailabilityCalendar } from "./AvailabilityCalendar";
import { StatutProfilField, type StatutProfilValue } from "./StatutProfilField";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
  profil: any;
}

interface ExperienceForm {
  poste: string;
  duree_menage: string;
  lieux_travail: string[];
  allergies: boolean;
  taches: string[];
  grand_menage: boolean;
}

export function EditProfilModal({ open, onOpenChange, onSuccess, profil }: Props) {
  const [saving, setSaving] = useState(false);

  const [statut, setStatut] = useState<StatutProfilValue>({ statut: "nouveau" });
  const [disponibiliteIntervention, setDisponibiliteIntervention] = useState<string>("disponible");
  const [blackliste, setBlackliste] = useState(false);

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
  const [niveauEtude, setNiveauEtude] = useState("");
  const [expAnnees, setExpAnnees] = useState(0);
  const [expMois, setExpMois] = useState(0);
  const [typeProfil, setTypeProfil] = useState("");
  const [saitLireEcrire, setSaitLireEcrire] = useState(false);
  const [maladieHandicap, setMaladieHandicap] = useState("");
  const [presentationPhysique, setPresentationPhysique] = useState("");
  const [corpulence, setCorpulence] = useState("");

  const [allergieAnimaux, setAllergieAnimaux] = useState(false);
  const [pointureChaussures, setPointureChaussures] = useState<string>("");
  const [fume, setFume] = useState<string>("non");
  const [remarqueRecruteur, setRemarqueRecruteur] = useState("");
  const [calendrier, setCalendrier] = useState<DisponibiliteCalendrier>(DEFAULT_DISPONIBILITE_CALENDRIER);
  const [dateEnregistrement, setDateEnregistrement] = useState<string>("");

  const [dispoUrgences, setDispoUrgences] = useState(false);
  const [dispoJournee, setDispoJournee] = useState(false);
  const [dispoSoiree, setDispoSoiree] = useState(false);
  const [dispo7j7, setDispo7j7] = useState(false);
  const [dispoJoursFeries, setDispoJoursFeries] = useState(false);

  const [experiences, setExperiences] = useState<ExperienceForm[]>([]);
  const [showExpForm, setShowExpForm] = useState(false);
  const [currentExp, setCurrentExp] = useState<ExperienceForm>({
    poste: "", duree_menage: "", lieux_travail: [], allergies: false, taches: [], grand_menage: false,
  });

  useEffect(() => {
    if (profil && open) {
      const s = profil.statut_profil || "nouveau";
      setBlackliste(s === "blackliste");
      setStatut({
        statut: s === "blackliste" ? "nouveau" : s,
        standbyJours: profil.standby_jours ?? null,
        congeDebut: profil.conge_debut ?? null,
        congeFin: profil.conge_fin ?? null,
      });

      setNom(profil.nom || "");
      setPrenom(profil.prenom || "");
      setQuartier(profil.quartier || "");
      setVille(profil.ville || "Casablanca");
      setNumeroCin(profil.numero_cin || "");
      setDateNaissance(profil.date_naissance || "");
      setSexe(profil.sexe || "");
      setTelephone(profil.telephone || "");
      setWhatsapp(profil.whatsapp || "");
      setSituationMatrimoniale(profil.situation_matrimoniale || "");
      setADesEnfants(!!profil.a_des_enfants);
      const nat = profil.nationalite || "Marocaine";
      if ((NATIONALITES as readonly string[]).includes(nat)) {
        setNationalite(nat); setNationaliteAutre("");
      } else {
        setNationalite("Autre"); setNationaliteAutre(nat);
      }
      setLangues(Array.isArray(profil.langue) ? profil.langue : []);
      setNiveauEtude(profil.niveau_etude || "");
      setExpAnnees(profil.experience_annees || 0);
      setExpMois(profil.experience_mois || 0);
      setTypeProfil(profil.type_profil || "");
      setSaitLireEcrire(!!profil.sait_lire_ecrire);
      setMaladieHandicap(profil.maladie_handicap || "");
      setPresentationPhysique(profil.presentation_physique || "");
      setCorpulence(profil.corpulence || "");
      setAllergieAnimaux(!!profil.allergie_animaux);
      setPointureChaussures(profil.pointure_chaussures ? String(profil.pointure_chaussures) : "");
      setRemarqueRecruteur(profil.remarque_recruteur || "");
      setCalendrier({ ...DEFAULT_DISPONIBILITE_CALENDRIER, ...(profil.disponibilite_calendrier || {}) });
      const d = profil.date_enregistrement || profil.created_at;
      setDateEnregistrement(d ? format(new Date(d), "dd/MM/yyyy") : "");
      setDispoUrgences(!!profil.dispo_urgences);
      setDispoJournee(!!profil.dispo_journee);
      setDispoSoiree(!!profil.dispo_soiree);
      setDispo7j7(!!profil.dispo_7j7);
      setDispoJoursFeries(!!profil.dispo_jours_feries);
      setDisponibiliteIntervention(profil.disponibilite_intervention || "disponible");
      setFume(profil.fume || "non");
      setExperiences(Array.isArray(profil.experiences) ? profil.experiences : []);
    }
  }, [profil, open]);

  const age = dateNaissance
    ? Math.floor((Date.now() - new Date(dateNaissance).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const toggleLangue = (l: string) => setLangues(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]);
  const toggleLieu = (l: string) => setCurrentExp(prev => ({ ...prev, lieux_travail: prev.lieux_travail.includes(l) ? prev.lieux_travail.filter(x => x !== l) : [...prev.lieux_travail, l] }));
  const toggleTache = (t: string) => setCurrentExp(prev => ({ ...prev, taches: prev.taches.includes(t) ? prev.taches.filter(x => x !== t) : [...prev.taches, t] }));
  const addExperience = () => { if (!currentExp.poste) return; setExperiences(prev => [...prev, currentExp]); setCurrentExp({ poste: "", duree_menage: "", lieux_travail: [], allergies: false, taches: [], grand_menage: false }); setShowExpForm(false); };
  const removeExperience = (idx: number) => setExperiences(prev => prev.filter((_, i) => i !== idx));

  const calendrierAuMoinsUnJour = Object.values(calendrier).some(j => j.actif);

  const handleSave = async () => {
    if (!nom.trim() || !prenom.trim()) {
      toast({ title: "Erreur", description: "Nom et prénom sont requis.", variant: "destructive" });
      return;
    }
    if (!calendrierAuMoinsUnJour) {
      toast({ title: "Disponibilité manquante", description: "Cochez au moins un jour dans le calendrier.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const finalNationalite = nationalite === "Autre" ? nationaliteAutre : nationalite;
      const finalStatut = blackliste ? "blackliste" : statut.statut;
      const wasStandby = profil.statut_profil === "stand_by";
      const nowIso = new Date().toISOString();
      const { error } = await supabase.from("profils").update({
        nom: nom.trim(), prenom: prenom.trim(), quartier: quartier || null, ville,
        numero_cin: numeroCin || null, date_naissance: dateNaissance || null,
        sexe: sexe || null, telephone: telephone || null, whatsapp: whatsapp || null,
        situation_matrimoniale: situationMatrimoniale || null, a_des_enfants: aDesEnfants,
        nationalite: finalNationalite, langue: langues as any, niveau_etude: niveauEtude || null,
        experience_annees: expAnnees, experience_mois: expMois,
        statut_profil: finalStatut,
        standby_jours: finalStatut === "stand_by" ? statut.standbyJours ?? null : null,
        standby_debut: finalStatut === "stand_by" ? (wasStandby ? profil.standby_debut : nowIso) : null,
        conge_debut: finalStatut === "en_conge" ? statut.congeDebut ?? null : null,
        conge_fin: finalStatut === "en_conge" ? statut.congeFin ?? null : null,
        type_profil: typeProfil || null,
        sait_lire_ecrire: saitLireEcrire, maladie_handicap: maladieHandicap || null,
        presentation_physique: presentationPhysique || null, corpulence: corpulence || null,
        dispo_urgences: dispoUrgences, dispo_journee: dispoJournee, dispo_soiree: dispoSoiree,
        dispo_7j7: dispo7j7, dispo_jours_feries: dispoJoursFeries,
        disponibilite_calendrier: calendrier as any,
        disponibilite_intervention: disponibiliteIntervention,
        allergie_animaux: allergieAnimaux,
        pointure_chaussures: pointureChaussures ? Number(pointureChaussures) : null,
        fume,
        remarque_recruteur: remarqueRecruteur || null,
        experiences: experiences as any,
      } as any).eq("id", profil.id);
      if (error) throw error;

      await supabase.from("profil_historique").insert({
        profil_id: profil.id, action: "Modification de la fiche profil", utilisateur: "Opérateur",
      });

      toast({ title: "Profil modifié avec succès" });
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-lg font-bold">Modifier la femme de ménage</DialogTitle>
        </DialogHeader>
        <ScrollArea className="px-6 pb-6 max-h-[75vh]">
          <div className="space-y-6">
            {/* Statut & Blacklisté */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border bg-muted/30">
              <div className="space-y-3">
                <StatutProfilField value={statut} onChange={setStatut} idPrefix="edit" />
                <div>
                  <Label className="text-xs font-semibold">Disponibilité d'intervention</Label>
                  <Select value={disponibiliteIntervention} onValueChange={setDisponibiliteIntervention}>
                    <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                    <SelectContent>
                      {DISPONIBILITE_INTERVENTION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-semibold">Blacklisté</Label>
                <div className="flex items-center gap-2 h-10 px-3 rounded-md border bg-background">
                  <Checkbox id="edit-blackliste" checked={blackliste} onCheckedChange={v => setBlackliste(!!v)} />
                  <Label htmlFor="edit-blackliste" className="text-sm cursor-pointer">Marquer ce profil comme blacklisté</Label>
                </div>
                {dateEnregistrement && (
                  <div className="text-[11px] text-muted-foreground">
                    Date d'enregistrement : <span className="font-medium">{dateEnregistrement}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Informations personnelles */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Informations personnelles</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div><Label className="text-xs">Nom *</Label><Input value={nom} onChange={e => setNom(e.target.value)} /></div>
                <div><Label className="text-xs">Prénom *</Label><Input value={prenom} onChange={e => setPrenom(e.target.value)} /></div>
                <div><Label className="text-xs">Quartier</Label><Input value={quartier} onChange={e => setQuartier(e.target.value)} placeholder="Saisir le quartier" /></div>
                <div><Label className="text-xs">Ville</Label><Input value={ville} onChange={e => setVille(e.target.value)} /></div>
                <div><Label className="text-xs">Numéro CIN</Label><Input value={numeroCin} onChange={e => setNumeroCin(e.target.value)} /></div>
                <div><Label className="text-xs">Date de naissance</Label><Input type="date" value={dateNaissance} onChange={e => setDateNaissance(e.target.value)} /></div>
                {age !== null && (
                  <div><Label className="text-xs">Âge</Label><Input value={`${age} ans`} disabled className="bg-muted" /></div>
                )}
                <div>
                  <Label className="text-xs">Sexe</Label>
                  <Select value={sexe} onValueChange={setSexe}>
                    <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="homme">Homme</SelectItem>
                      <SelectItem value="femme">Femme</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Téléphone</Label><Input value={telephone} onChange={e => setTelephone(e.target.value)} /></div>
                <div><Label className="text-xs">WhatsApp</Label><Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} /></div>
                <div>
                  <Label className="text-xs">Situation matrimoniale</Label>
                  <Select value={situationMatrimoniale} onValueChange={setSituationMatrimoniale}>
                    <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                    <SelectContent>{SITUATIONS_MATRIMONIALES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2 pb-1">
                  <Checkbox checked={aDesEnfants} onCheckedChange={(v) => setADesEnfants(!!v)} id="edit-enfants" />
                  <Label htmlFor="edit-enfants" className="text-xs">A des enfants</Label>
                </div>
                <div>
                  <Label className="text-xs">Nationalité</Label>
                  <Select value={nationalite} onValueChange={setNationalite}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{NATIONALITES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {nationalite === "Autre" && (
                  <div><Label className="text-xs">Préciser la nationalité</Label><Input value={nationaliteAutre} onChange={e => setNationaliteAutre(e.target.value)} placeholder="Saisir la nationalité" /></div>
                )}
              </div>
            </div>

            {/* Langues */}
            <div>
              <Label className="text-xs font-semibold">Langues</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {LANGUES.map(l => (
                  <Badge key={l} variant={langues.includes(l) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleLangue(l)}>{l}</Badge>
                ))}
              </div>
            </div>

            {/* Éducation & Expérience */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Niveau d'étude</Label>
                <Select value={niveauEtude} onValueChange={setNiveauEtude}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>{NIVEAUX_ETUDE.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Expérience (années)</Label><Input type="number" min={0} value={expAnnees} onChange={e => setExpAnnees(Number(e.target.value))} /></div>
              <div><Label className="text-xs">Expérience (mois)</Label><Input type="number" min={0} max={11} value={expMois} onChange={e => setExpMois(Number(e.target.value))} /></div>
              <div>
                <Label className="text-xs">Type de profil</Label>
                <Select value={typeProfil} onValueChange={setTypeProfil}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>{TYPES_PROFIL.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Caractéristiques */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Caractéristiques</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox checked={saitLireEcrire} onCheckedChange={v => setSaitLireEcrire(!!v)} id="edit-lire" />
                  <Label htmlFor="edit-lire" className="text-xs">Sait lire et écrire</Label>
                </div>
                <div><Label className="text-xs">Maladie / Handicap</Label><Input value={maladieHandicap} onChange={e => setMaladieHandicap(e.target.value)} placeholder="Aucun" /></div>
                <div>
                  <Label className="text-xs">Présentation physique</Label>
                  <Select value={presentationPhysique} onValueChange={setPresentationPhysique}>
                    <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                    <SelectContent>{PRESENTATIONS_PHYSIQUES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Corpulence</Label>
                  <Select value={corpulence} onValueChange={setCorpulence}>
                    <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                    <SelectContent>{CORPULENCES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Pointure de chaussures</Label>
                  <Input type="number" min={30} max={50} value={pointureChaussures} onChange={e => setPointureChaussures(e.target.value)} placeholder="Ex: 38" />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox checked={allergieAnimaux} onCheckedChange={v => setAllergieAnimaux(!!v)} id="edit-allergie-anim" />
                  <Label htmlFor="edit-allergie-anim" className="text-xs">Allergie aux animaux</Label>
                </div>
              </div>
            </div>

            {/* Calendrier */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Calendrier de disponibilité <span className="text-destructive">*</span>
                </h3>
                {!calendrierAuMoinsUnJour && (
                  <span className="text-[11px] text-destructive">Au moins un jour requis</span>
                )}
              </div>
              <AvailabilityCalendar value={calendrier} onChange={setCalendrier} />
            </div>

            {/* Dispos rapides */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Disponibilités additionnelles</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: "edit-urg", label: "Disponible pour les urgences", checked: dispoUrgences, set: setDispoUrgences },
                  { id: "edit-jour", label: "Journée (7h–18h)", checked: dispoJournee, set: setDispoJournee },
                  { id: "edit-soir", label: "Soirée (après 18h)", checked: dispoSoiree, set: setDispoSoiree },
                  { id: "edit-7j", label: "7 jours / 7", checked: dispo7j7, set: setDispo7j7 },
                  { id: "edit-ferie", label: "Jours fériés", checked: dispoJoursFeries, set: setDispoJoursFeries },
                ].map(d => (
                  <div key={d.id} className="flex items-center gap-2">
                    <Checkbox checked={d.checked} onCheckedChange={v => d.set(!!v)} id={d.id} />
                    <Label htmlFor={d.id} className="text-xs">{d.label}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Remarque recruteur */}
            <div>
              <Label className="text-xs font-semibold">Remarque du recruteur</Label>
              <Textarea
                value={remarqueRecruteur}
                onChange={e => setRemarqueRecruteur(e.target.value)}
                rows={3}
                placeholder="Visible sur le profil interne et sur la fiche envoyée au client..."
                className="resize-none mt-1"
              />
            </div>

            <Separator />

            {/* Expériences */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Les expériences</h3>
                <Button variant="outline" size="sm" onClick={() => setShowExpForm(true)} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Ajouter un poste
                </Button>
              </div>
              {experiences.map((exp, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg mb-2">
                  <div>
                    <span className="font-medium text-sm">{exp.poste}</span>
                    <span className="text-xs text-muted-foreground ml-2">{exp.taches?.length || 0} tâches • {exp.lieux_travail?.length || 0} lieux</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeExperience(idx)}><X className="h-3.5 w-3.5" /></Button>
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
                      <div><Label className="text-xs">Depuis combien de temps ?</Label><Input value={currentExp.duree_menage} onChange={e => setCurrentExp(prev => ({ ...prev, duree_menage: e.target.value }))} placeholder="Ex: 3 ans" /></div>
                      <div>
                        <Label className="text-xs">Lieux de travail</Label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {LIEUX_TRAVAIL.map(l => (<Badge key={l} variant={currentExp.lieux_travail.includes(l) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleLieu(l)}>{l}</Badge>))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox checked={currentExp.allergies} onCheckedChange={v => setCurrentExp(prev => ({ ...prev, allergies: !!v }))} id="edit-allergies" />
                        <Label htmlFor="edit-allergies" className="text-xs">Allergies produits ménagers</Label>
                      </div>
                      <div>
                        <Label className="text-xs">Tâches</Label>
                        <div className="grid grid-cols-2 gap-1.5 mt-1">
                          {TACHES_MENAGE.map(t => (
                            <div key={t} className="flex items-center gap-2">
                              <Checkbox checked={currentExp.taches.includes(t)} onCheckedChange={() => toggleTache(t)} id={`edit-tache-${t}`} />
                              <Label htmlFor={`edit-tache-${t}`} className="text-xs">{t}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox checked={currentExp.grand_menage} onCheckedChange={v => setCurrentExp(prev => ({ ...prev, grand_menage: !!v }))} id="edit-gm" />
                        <Label htmlFor="edit-gm" className="text-xs">Grand ménage</Label>
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

            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                <Save className="h-4 w-4" /> Enregistrer les modifications
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
