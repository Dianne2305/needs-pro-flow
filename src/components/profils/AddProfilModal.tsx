import { useState } from "react";
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
  LIEUX_TRAVAIL, TACHES_MENAGE,
} from "@/lib/profil-constants";
import { QUARTIERS_CASABLANCA } from "@/lib/constants";

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

export function AddProfilModal({ open, onOpenChange, onSuccess }: Props) {
  const [saving, setSaving] = useState(false);

  // Basic info
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
  const [langues, setLangues] = useState<string[]>([]);
  const [niveauEtude, setNiveauEtude] = useState("");
  const [expAnnees, setExpAnnees] = useState(0);
  const [expMois, setExpMois] = useState(0);
  const [statutProfil, setStatutProfil] = useState("disponible");
  const [typeProfil, setTypeProfil] = useState("");

  // Additional
  const [formationRequise, setFormationRequise] = useState(false);
  const [saitLireEcrire, setSaitLireEcrire] = useState(false);
  const [maladieHandicap, setMaladieHandicap] = useState("");
  const [presentationPhysique, setPresentationPhysique] = useState("");
  const [corpulence, setCorpulence] = useState("");

  // Disponibilité
  const [dispoUrgences, setDispoUrgences] = useState(false);
  const [dispoJournee, setDispoJournee] = useState(false);
  const [dispoSoiree, setDispoSoiree] = useState(false);
  const [dispo7j7, setDispo7j7] = useState(false);
  const [dispoJoursFeries, setDispoJoursFeries] = useState(false);

  const [noteOperateur, setNoteOperateur] = useState("");

  // Expériences
  const [experiences, setExperiences] = useState<ExperienceForm[]>([]);
  const [showExpForm, setShowExpForm] = useState(false);
  const [currentExp, setCurrentExp] = useState<ExperienceForm>({
    poste: "", duree_menage: "", lieux_travail: [], allergies: false, taches: [], grand_menage: false,
  });

  const toggleLangue = (l: string) => {
    setLangues(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]);
  };

  const toggleLieu = (l: string) => {
    setCurrentExp(prev => ({
      ...prev,
      lieux_travail: prev.lieux_travail.includes(l)
        ? prev.lieux_travail.filter(x => x !== l)
        : [...prev.lieux_travail, l],
    }));
  };

  const toggleTache = (t: string) => {
    setCurrentExp(prev => ({
      ...prev,
      taches: prev.taches.includes(t) ? prev.taches.filter(x => x !== t) : [...prev.taches, t],
    }));
  };

  const addExperience = () => {
    if (!currentExp.poste) return;
    setExperiences(prev => [...prev, currentExp]);
    setCurrentExp({ poste: "", duree_menage: "", lieux_travail: [], allergies: false, taches: [], grand_menage: false });
    setShowExpForm(false);
  };

  const removeExperience = (idx: number) => {
    setExperiences(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!nom.trim() || !prenom.trim()) {
      toast({ title: "Erreur", description: "Nom et prénom sont requis.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("profils").insert({
        nom: nom.trim(),
        prenom: prenom.trim(),
        quartier: quartier || null,
        ville,
        numero_cin: numeroCin || null,
        date_naissance: dateNaissance || null,
        sexe: sexe || null,
        telephone: telephone || null,
        whatsapp: whatsapp || null,
        situation_matrimoniale: situationMatrimoniale || null,
        a_des_enfants: aDesEnfants,
        nationalite,
        langue: langues,
        niveau_etude: niveauEtude || null,
        experience_annees: expAnnees,
        experience_mois: expMois,
        statut_profil: statutProfil,
        type_profil: typeProfil || null,
        formation_requise: formationRequise,
        sait_lire_ecrire: saitLireEcrire,
        maladie_handicap: maladieHandicap || null,
        presentation_physique: presentationPhysique || null,
        corpulence: corpulence || null,
        dispo_urgences: dispoUrgences,
        dispo_journee: dispoJournee,
        dispo_soiree: dispoSoiree,
        dispo_7j7: dispo7j7,
        dispo_jours_feries: dispoJoursFeries,
        note_operateur: noteOperateur || null,
        experiences: experiences as any,
      } as any);
      if (error) throw error;
      toast({ title: "Profil enregistré avec succès" });
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
          <DialogTitle className="text-lg font-bold">Ajouter un profil</DialogTitle>
        </DialogHeader>
        <ScrollArea className="px-6 pb-6 max-h-[75vh]">
          <div className="space-y-6">
            {/* Informations du profil */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Informations personnelles</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div><Label className="text-xs">Nom *</Label><Input value={nom} onChange={e => setNom(e.target.value)} /></div>
                <div><Label className="text-xs">Prénom *</Label><Input value={prenom} onChange={e => setPrenom(e.target.value)} /></div>
                <div>
                  <Label className="text-xs">Quartier</Label>
                  <Select value={quartier} onValueChange={setQuartier}>
                    <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                    <SelectContent>{QUARTIERS_CASABLANCA.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Ville</Label><Input value={ville} onChange={e => setVille(e.target.value)} /></div>
                <div><Label className="text-xs">Numéro CIN</Label><Input value={numeroCin} onChange={e => setNumeroCin(e.target.value)} /></div>
                <div><Label className="text-xs">Date de naissance</Label><Input type="date" value={dateNaissance} onChange={e => setDateNaissance(e.target.value)} /></div>
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
                  <Checkbox checked={aDesEnfants} onCheckedChange={(v) => setADesEnfants(!!v)} id="enfants" />
                  <Label htmlFor="enfants" className="text-xs">A des enfants</Label>
                </div>
                <div>
                  <Label className="text-xs">Nationalité</Label>
                  <Select value={nationalite} onValueChange={setNationalite}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{NATIONALITES.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Langues */}
            <div>
              <Label className="text-xs font-semibold">Langues</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {LANGUES.map(l => (
                  <Badge
                    key={l}
                    variant={langues.includes(l) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleLangue(l)}
                  >
                    {l}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Education & Expérience */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Niveau d'étude</Label>
                <Select value={niveauEtude} onValueChange={setNiveauEtude}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>{NIVEAUX_ETUDE.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Expérience (années)</Label>
                <Input type="number" min={0} value={expAnnees} onChange={e => setExpAnnees(Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Expérience (mois)</Label>
                <Input type="number" min={0} max={11} value={expMois} onChange={e => setExpMois(Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Statut profil</Label>
                <Select value={statutProfil} onValueChange={setStatutProfil}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disponible">Disponible</SelectItem>
                    <SelectItem value="non_disponible">Non disponible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                  <Checkbox checked={formationRequise} onCheckedChange={v => setFormationRequise(!!v)} id="formation" />
                  <Label htmlFor="formation" className="text-xs">Formation requise</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox checked={saitLireEcrire} onCheckedChange={v => setSaitLireEcrire(!!v)} id="lire" />
                  <Label htmlFor="lire" className="text-xs">Sait lire et écrire</Label>
                </div>
                <div>
                  <Label className="text-xs">Maladie / Handicap</Label>
                  <Input value={maladieHandicap} onChange={e => setMaladieHandicap(e.target.value)} placeholder="Aucun" />
                </div>
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
              </div>
            </div>

            {/* Disponibilité */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Disponibilité</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: "urg", label: "Disponible pour les urgences", checked: dispoUrgences, set: setDispoUrgences },
                  { id: "jour", label: "Disponible dans la journée (7h–18h)", checked: dispoJournee, set: setDispoJournee },
                  { id: "soir", label: "Disponible dans la soirée (après 18h)", checked: dispoSoiree, set: setDispoSoiree },
                  { id: "7j", label: "Disponible 7 jours / 7", checked: dispo7j7, set: setDispo7j7 },
                  { id: "ferie", label: "Disponible les jours fériés", checked: dispoJoursFeries, set: setDispoJoursFeries },
                ].map(d => (
                  <div key={d.id} className="flex items-center gap-2">
                    <Checkbox checked={d.checked} onCheckedChange={v => d.set(!!v)} id={d.id} />
                    <Label htmlFor={d.id} className="text-xs">{d.label}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Note opérateur */}
            <div>
              <Label className="text-xs">Note de l'opérateur</Label>
              <Textarea value={noteOperateur} onChange={e => setNoteOperateur(e.target.value)} rows={2} placeholder="Remarques..." className="resize-none" />
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

              {/* Existing experiences */}
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

              {/* Experience form */}
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
                        <Label className="text-xs">Depuis combien de temps faites-vous du ménage ?</Label>
                        <Input value={currentExp.duree_menage} onChange={e => setCurrentExp(prev => ({ ...prev, duree_menage: e.target.value }))} placeholder="Ex: 3 ans" />
                      </div>
                      <div>
                        <Label className="text-xs">Avez-vous déjà travaillé dans un(e) :</Label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {LIEUX_TRAVAIL.map(l => (
                            <Badge key={l} variant={currentExp.lieux_travail.includes(l) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleLieu(l)}>
                              {l}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox checked={currentExp.allergies} onCheckedChange={v => setCurrentExp(prev => ({ ...prev, allergies: !!v }))} id="allergies" />
                        <Label htmlFor="allergies" className="text-xs">Allergies ou intolérances à certains produits ménagers</Label>
                      </div>
                      <div>
                        <Label className="text-xs">Quels types de tâches pouvez-vous effectuer ?</Label>
                        <div className="grid grid-cols-2 gap-1.5 mt-1">
                          {TACHES_MENAGE.map(t => (
                            <div key={t} className="flex items-center gap-2">
                              <Checkbox checked={currentExp.taches.includes(t)} onCheckedChange={() => toggleTache(t)} id={`tache-${t}`} />
                              <Label htmlFor={`tache-${t}`} className="text-xs">{t}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox checked={currentExp.grand_menage} onCheckedChange={v => setCurrentExp(prev => ({ ...prev, grand_menage: !!v }))} id="gm" />
                        <Label htmlFor="gm" className="text-xs">Habitude du grand ménage</Label>
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

            {/* Save */}
            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                <Save className="h-4 w-4" /> Enregistrer
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
