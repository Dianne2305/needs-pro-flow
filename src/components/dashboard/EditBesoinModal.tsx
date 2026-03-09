import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  STATUTS, SEGMENTS,
  TYPES_PRESTATION_PARTICULIER, TYPES_PRESTATION_ENTREPRISE,
  STATUTS_PAIEMENT_COMMERCIAL,
} from "@/lib/constants";
import { ArrowLeft, Save, X, Send, FileText } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";
import { ServiceFormFields } from "./ServiceFormFields";
import { DevisPreviewModal } from "@/components/pending/DevisPreviewModal";

type Demande = Tables<"demandes">;

const MODES_PAIEMENT = ["Virement", "Par chèque", "À l'agence", "Sur place"] as const;

interface Props {
  demande: Demande;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: Record<string, unknown>) => void;
}

export function EditBesoinModal({ demande, open, onOpenChange, onSave }: Props) {
  const [statut, setStatut] = useState(demande.statut);
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
  const [montant, setMontant] = useState(String(demande.montant_total || ""));
  const [modePaiement, setModePaiement] = useState(demande.mode_paiement || "");
  const [statutPaiement, setStatutPaiement] = useState(demande.statut_paiement_commercial || "non_paye");
  const [montantVerse, setMontantVerse] = useState(String(demande.montant_verse_client || ""));
  const [notesClient, setNotesClient] = useState(demande.notes_client || "");
  const [sendWhatsApp, setSendWhatsApp] = useState(false);

  // Devis preview
  const [devisOpen, setDevisOpen] = useState(false);

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

  const handleSave = () => {
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
      montant_total: montant ? Number(montant) : null,
      mode_paiement: modePaiement || null,
      statut_paiement_commercial: statutPaiement || "non_paye",
      montant_verse_client: montantVerse ? Number(montantVerse) : null,
      avec_produit: avecProduit,
      notes_client: notesClient || null,
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

    if (sendWhatsApp && whatsapp) {
      toast({
        title: isReservation ? "Confirmation régénérée" : "Devis régénéré",
        description: `Le document sera envoyé au client via WhatsApp (${whatsapp})`,
      });
    }

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
                  Formulaire : {typePrestation}
                </span>
              )}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Row 1: Statut, Segment, Type de service, Mode paiement */}
        <div className="grid grid-cols-4 gap-4">
          <div>
            <Label>Statut du besoin</Label>
            <Select value={statut} onValueChange={setStatut}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full shrink-0 border border-border"
                    style={{ backgroundColor: STATUTS[statut as keyof typeof STATUTS]?.hex || "#ffffff" }}
                  />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUTS)
                  .filter(([key]) => !["en_attente_confirmation", "en_attente_profil", "confirme_intervention", "standby", "cloturee"].includes(key))
                  .map(([key, s]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full shrink-0 border border-border"
                        style={{ backgroundColor: s.hex }}
                      />
                      {s.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <div>
            <Label>Mode de paiement</Label>
            <Select value={modePaiement} onValueChange={setModePaiement}>
              <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
              <SelectContent>
                {MODES_PAIEMENT.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Dynamic form based on service type */}
        <div className="grid grid-cols-2 gap-4 mt-2">
          <ServiceFormFields typePrestation={typePrestation} segment={segment} fields={serviceFields} />
        </div>

        {/* Client info */}
        <div className="grid grid-cols-2 gap-4 mt-2">
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
        </div>

        {/* Tarification */}
        <div className="grid grid-cols-2 gap-4 mt-2">
          <div className="col-span-2 border-t pt-4">
            <p className="text-sm font-semibold text-muted-foreground mb-3">Tarification</p>
          </div>
          <div>
            <Label>Montant total (MAD)</Label>
            <Input type="number" value={montant} onChange={(e) => setMontant(e.target.value)} />
            {montant && <p className="text-xs text-muted-foreground mt-1">Candidat : {(Number(montant) / 2).toFixed(0)} MAD</p>}
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
          {(statutPaiement === "acompte_verse" || statutPaiement === "paiement_partiel") && (
            <div>
              <Label>Montant versé par le client (MAD)</Label>
              <Input type="number" value={montantVerse} onChange={(e) => setMontantVerse(e.target.value)} />
              {montant && montantVerse && (
                <p className="text-xs text-destructive mt-1">
                  Reste à payer : {(Number(montant) - Number(montantVerse)).toFixed(0)} MAD
                </p>
              )}
            </div>
          )}
          <div className="col-span-2">
            <Label>Notes client</Label>
            <Textarea value={notesClient} onChange={(e) => setNotesClient(e.target.value)} rows={3} />
          </div>
        </div>

        {/* WhatsApp toggle */}
        <div className="border rounded-lg p-4 mt-2 bg-muted/30">
          <div className="flex items-center gap-3">
            <Switch checked={sendWhatsApp} onCheckedChange={setSendWhatsApp} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium">
                  {isReservation
                    ? "Régénérer la confirmation de réservation et renvoyer au client via WhatsApp"
                    : "Régénérer le devis et renvoyer au client via WhatsApp"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {isReservation
                  ? "La confirmation sera régénérée et envoyée automatiquement au numéro WhatsApp du client."
                  : "Le devis sera régénéré et envoyé automatiquement au numéro WhatsApp du client."}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => setDevisOpen(true)}>
            <FileText className="h-4 w-4 mr-1" />
            {isReservation ? "Générer récapitulatif" : "Générer devis"}
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