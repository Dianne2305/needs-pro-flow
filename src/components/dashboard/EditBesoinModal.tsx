import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import {
  STATUTS, SEGMENTS,
  TYPES_PRESTATION_PARTICULIER, TYPES_PRESTATION_ENTREPRISE,
  STATUTS_PAIEMENT_COMMERCIAL,
} from "@/lib/constants";
import { ArrowLeft, Save, X, FileText, ChevronDown, Building2, ClipboardList, History, Receipt } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { ServiceFormFields } from "./ServiceFormFields";
import { DevisPreviewModal } from "@/components/pending/DevisPreviewModal";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type Demande = Tables<"demandes">;

const MODES_PAIEMENT = ["Virement", "Par chèque", "À l'agence", "Sur place"] as const;

interface Props {
  demande: Demande;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: Record<string, unknown>) => void;
}

export function EditBesoinModal({ demande, open, onOpenChange, onSave }: Props) {
  const queryClient = useQueryClient();
  const [statut] = useState(demande.statut);
  const [segment, setSegment] = useState(
    demande.type_service === "SPE" ? "entreprise" : "particulier"
  );
  const [typePrestation, setTypePrestation] = useState(demande.type_prestation);

  // Common fields
  const [nom, setNom] = useState(demande.nom);
  const [tel, setTel] = useState(demande.telephone_direct || "");
  const [whatsapp, setWhatsapp] = useState(demande.telephone_whatsapp || "");
  const [ville, setVille] = useState(demande.ville);
  const [quartier, setQuartier] = useState(demande.quartier || "");
  const [adresse, setAdresse] = useState(demande.adresse || "");
  const [modePaiement, setModePaiement] = useState(demande.mode_paiement || "");
  const [statutPaiement, setStatutPaiement] = useState(demande.statut_paiement_commercial || "non_paye");
  const [montantVerse, setMontantVerse] = useState(String(demande.montant_verse_client || ""));
  const [notesClient, setNotesClient] = useState(demande.notes_client || "");
  const [noteCommercial, setNoteCommercial] = useState(demande.note_commercial || "");
  const [noteOperationnel, setNoteOperationnel] = useState(demande.note_operationnel || "");

  // Facturation HT/TVA
  const [montantHT, setMontantHT] = useState(String(demande.montant_total || ""));
  const [appliquerTVA, setAppliquerTVA] = useState(true);

  const montantTTC = useMemo(() => {
    const ht = Number(montantHT) || 0;
    return appliquerTVA ? ht * 1.2 : ht;
  }, [montantHT, appliquerTVA]);

  const resteAPayer = useMemo(() => {
    return montantTTC - (Number(montantVerse) || 0);
  }, [montantTTC, montantVerse]);

  // Devis preview
  const [devisOpen, setDevisOpen] = useState(false);

  // Collapsible states
  const [formOpen, setFormOpen] = useState(false);
  const [historiqueOpen, setHistoriqueOpen] = useState(true);

  // Service-specific fields
  const [typeBien, setTypeBien] = useState(demande.type_bien || "");
  const [superficie, setSuperficie] = useState(String((demande as any).superficie_m2 || ""));
  const [etatLogement, setEtatLogement] = useState((demande as any).etat_logement || "");
  const [typeSalissure, setTypeSalissure] = useState((demande as any).type_salissure || "");
  const [natureIntervention, setNatureIntervention] = useState((demande as any).nature_intervention || "");
  const [descriptionIntervention, setDescriptionIntervention] = useState((demande as any).description_intervention || "");
  const [duree, setDuree] = useState(String(demande.duree_heures || ""));
  const [nbIntervenants, setNbIntervenants] = useState(String(demande.nombre_intervenants || 1));
  const [frequence, setFrequence] = useState(demande.frequence);
  const [avecProduit, setAvecProduit] = useState(demande.avec_produit || false);
  const [avecTorchons, setAvecTorchons] = useState(false);
  const [datePrestation, setDatePrestation] = useState(demande.date_prestation || "");
  const [heurePrestation, setHeurePrestation] = useState(demande.heure_prestation || "");
  const [preferenceHoraire, setPreferenceHoraire] = useState((demande as any).preference_horaire || "");
  const [nomEntreprise, setNomEntreprise] = useState((demande as any).nom_entreprise || "");
  const [contactEntreprise, setContactEntreprise] = useState((demande as any).contact_entreprise || "");
  const [email, setEmail] = useState((demande as any).email || "");

  const isReservation = ["confirme", "prestation_effectuee", "paye"].includes(statut);

  // Fetch action history
  const { data: historique = [] } = useQuery({
    queryKey: ["demande_historique", demande.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demande_historique")
        .select("*")
        .eq("demande_id", demande.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const prestationOptions = useMemo(() => {
    return segment === "entreprise"
      ? TYPES_PRESTATION_ENTREPRISE
      : TYPES_PRESTATION_PARTICULIER;
  }, [segment]);

  const handleSegmentChange = (val: string) => {
    setSegment(val);
    const newList = val === "entreprise" ? TYPES_PRESTATION_ENTREPRISE : TYPES_PRESTATION_PARTICULIER;
    if (!newList.includes(typePrestation as any)) {
      setTypePrestation("");
    }
  };

  const logAction = async (action: string, details?: string) => {
    await supabase.from("demande_historique").insert({
      demande_id: demande.id,
      action,
      details: details || null,
      utilisateur: null,
    });
  };

  const handleSave = async () => {
    // Build change log
    const changes: string[] = [];
    if (segment !== (demande.type_service === "SPE" ? "entreprise" : "particulier")) changes.push(`Segment → ${segment}`);
    if (typePrestation !== demande.type_prestation) changes.push(`Service → ${typePrestation}`);
    if (Number(montantHT) !== (demande.montant_total || 0)) changes.push(`Montant HT → ${montantHT} MAD`);
    if (modePaiement !== (demande.mode_paiement || "")) changes.push(`Mode paiement → ${modePaiement}`);
    if (statutPaiement !== (demande.statut_paiement_commercial || "non_paye")) changes.push(`Statut paiement → ${statutPaiement}`);
    if (noteCommercial !== (demande.note_commercial || "")) changes.push("Note commerciale modifiée");
    if (noteOperationnel !== (demande.note_operationnel || "")) changes.push("Note opérationnelle modifiée");

    if (changes.length > 0) {
      await logAction("Modification du besoin", changes.join(" | "));
    }

    onSave({
      statut,
      type_service: segment === "entreprise" ? "SPE" : "SPP",
      type_prestation: typePrestation,
      type_bien: typeBien || null,
      frequence,
      nom,
      telephone_direct: tel,
      telephone_whatsapp: whatsapp,
      ville,
      quartier: quartier || null,
      adresse: adresse || null,
      date_prestation: datePrestation || null,
      heure_prestation: heurePrestation || null,
      duree_heures: duree ? Number(duree) : null,
      nombre_intervenants: nbIntervenants ? Number(nbIntervenants) : 1,
      montant_total: montantHT ? Number(montantHT) : null,
      mode_paiement: modePaiement || null,
      statut_paiement_commercial: statutPaiement || "non_paye",
      montant_verse_client: montantVerse ? Number(montantVerse) : null,
      avec_produit: avecProduit,
      notes_client: notesClient || null,
      note_commercial: noteCommercial || null,
      note_operationnel: noteOperationnel || null,
      superficie_m2: superficie ? Number(superficie) : null,
      etat_logement: etatLogement || null,
      type_salissure: typeSalissure || null,
      nature_intervention: natureIntervention || null,
      description_intervention: descriptionIntervention || null,
      preference_horaire: preferenceHoraire || null,
      nom_entreprise: nomEntreprise || null,
      contact_entreprise: contactEntreprise || null,
      email: email || null,
      services_optionnels: JSON.stringify(
        [avecProduit && "produit", avecTorchons && "torchons"].filter(Boolean)
      ),
    });
    queryClient.invalidateQueries({ queryKey: ["demande_historique", demande.id] });
    onOpenChange(false);
  };

  const serviceFields = {
    typeBien, setTypeBien,
    superficie, setSuperficie,
    etatLogement, setEtatLogement,
    typeSalissure, setTypeSalissure,
    natureIntervention, setNatureIntervention,
    descriptionIntervention, setDescriptionIntervention,
    duree, setDuree,
    nbIntervenants, setNbIntervenants,
    frequence, setFrequence,
    avecProduit, setAvecProduit,
    avecTorchons, setAvecTorchons,
    datePrestation, setDatePrestation,
    heurePrestation, setHeurePrestation,
    preferenceHoraire, setPreferenceHoraire,
    nomEntreprise, setNomEntreprise,
    contactEntreprise, setContactEntreprise,
    email, setEmail,
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <DialogTitle className="flex flex-col">
                <span>Éditer le besoin — #{demande.num_demande}</span>
                {typePrestation && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {typePrestation}
                  </span>
                )}
              </DialogTitle>
            </div>
          </DialogHeader>

          {/* ——— Section 1: Formulaire demande (collapsible) ——— */}
          <Collapsible open={formOpen} onOpenChange={setFormOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 rounded-lg bg-[#027A76] text-white font-medium text-sm hover:opacity-90 transition-opacity">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Formulaire de la demande
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${formOpen ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <ServiceFormFields typePrestation={typePrestation} segment={segment} fields={serviceFields} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 border-t pt-4">
                  <p className="text-sm font-semibold text-muted-foreground mb-3">
                    {segment === "entreprise" ? "Informations contact" : "Informations client"}
                  </p>
                </div>
                <div><Label>Nom</Label><Input value={nom} onChange={(e) => setNom(e.target.value)} /></div>
                <div><Label>Tél. direct</Label><Input value={tel} onChange={(e) => setTel(e.target.value)} /></div>
                <div><Label>Tél. WhatsApp</Label><Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} /></div>
                <div><Label>Ville</Label><Input value={ville} onChange={(e) => setVille(e.target.value)} /></div>
                <div><Label>Quartier</Label><Input value={quartier} onChange={(e) => setQuartier(e.target.value)} /></div>
                <div className="col-span-2"><Label>Adresse</Label><Input value={adresse} onChange={(e) => setAdresse(e.target.value)} /></div>
                <div className="col-span-2">
                  <Label>Notes client</Label>
                  <Textarea value={notesClient} onChange={(e) => setNotesClient(e.target.value)} rows={2} />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ——— Section 2: Espace agence ——— */}
          <div className="mt-2">
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[#E86C4F] text-white font-medium text-sm">
              <Building2 className="h-4 w-4" />
              Espace agence
            </div>
            <div className="pt-4 space-y-5">

              {/* Sub-section: Besoin */}
              <div>
                <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" /> Besoin
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Statut du besoin</Label>
                    <div className="flex items-center gap-2 h-10 px-3 rounded-md border bg-muted/50 cursor-default">
                      <span
                        className="inline-block h-3 w-3 rounded-full shrink-0 border border-border"
                        style={{ backgroundColor: STATUTS[statut as keyof typeof STATUTS]?.hex || "#ccc" }}
                      />
                      <span className="text-sm">{STATUTS[statut as keyof typeof STATUTS]?.label || statut}</span>
                    </div>
                  </div>
                  <div>
                    <Label>Segment</Label>
                    <Select value={segment} onValueChange={handleSegmentChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SEGMENTS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Type de service</Label>
                    <Select value={typePrestation} onValueChange={setTypePrestation}>
                      <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                      <SelectContent>
                        {prestationOptions.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Sub-section: Facturation */}
              <div>
                <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                  <Receipt className="h-5 w-5" /> Facturation
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Montant HT (MAD)</Label>
                    <Input type="number" value={montantHT} onChange={(e) => setMontantHT(e.target.value)} />
                  </div>
                  <div>
                    <Label>TVA (20%)</Label>
                    <div className="flex items-center gap-3 h-10">
                      <Switch checked={appliquerTVA} onCheckedChange={setAppliquerTVA} />
                      <span className="text-sm">{appliquerTVA ? "Oui" : "Non"}</span>
                    </div>
                  </div>
                  <div>
                    <Label>Montant TTC (MAD)</Label>
                    <div className="flex items-center h-10 px-3 rounded-md border bg-muted/50 cursor-default">
                      <span className="text-sm font-semibold">{montantTTC.toFixed(2)}</span>
                    </div>
                    {!appliquerTVA && (
                      <p className="text-xs text-destructive mt-1 font-medium">Montant sans TVA</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div>
                    <Label>Mode de paiement</Label>
                    <Select value={modePaiement} onValueChange={setModePaiement}>
                      <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                      <SelectContent>
                        {MODES_PAIEMENT.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Statut de paiement</Label>
                    <Select value={statutPaiement} onValueChange={setStatutPaiement}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUTS_PAIEMENT_COMMERCIAL.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Montant versé (MAD)</Label>
                    <Input type="number" value={montantVerse} onChange={(e) => setMontantVerse(e.target.value)} />
                    {montantTTC > 0 && Number(montantVerse) > 0 && resteAPayer > 0 && (
                      <p className="text-xs text-destructive mt-1 font-medium">
                        Reste à payer : {resteAPayer.toFixed(0)} MAD
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Note commercial</Label>
                  <Textarea value={noteCommercial} onChange={(e) => setNoteCommercial(e.target.value)} rows={3} placeholder="Notes du commercial..." />
                </div>
                <div>
                  <Label>Note opération</Label>
                  <Textarea value={noteOperationnel} onChange={(e) => setNoteOperationnel(e.target.value)} rows={3} placeholder="Notes opérationnelles..." />
                </div>
              </div>
            </div>
          </div>

          {/* ——— Section 3: Historique des actions ——— */}
          <Collapsible open={historiqueOpen} onOpenChange={setHistoriqueOpen} className="mt-2">
            <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 rounded-lg bg-muted font-medium text-sm hover:opacity-90 transition-opacity">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Historique des actions ({historique.length})
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${historiqueOpen ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              {historique.length === 0 ? (
                <p className="text-sm text-muted-foreground italic px-2">Aucune action enregistrée.</p>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {historique.map((h) => (
                    <div key={h.id} className="flex items-start gap-2 px-3 py-2 bg-muted/30 rounded-lg text-sm">
                      <div className="flex-1">
                        <p className="font-medium">{h.action}</p>
                        {h.details && <p className="text-xs text-muted-foreground mt-0.5">{h.details}</p>}
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {format(new Date(h.created_at), "dd/MM/yy HH:mm", { locale: fr })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* ——— Actions ——— */}
          <div className="flex justify-between gap-2 pt-4 border-t mt-2">
            <Button variant="outline" onClick={() => setDevisOpen(true)}>
              <FileText className="h-4 w-4 mr-1" />
              {isReservation ? "Gérer PNG" : "Gérer devis"}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4 mr-1" />Annuler
              </Button>
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-1" />Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DevisPreviewModal
        demande={demande}
        open={devisOpen}
        onOpenChange={setDevisOpen}
      />
    </>
  );
}
