import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  STATUTS, SEGMENTS, FREQUENCES, TYPES_BIEN,
  TYPES_PRESTATION_PARTICULIER, TYPES_PRESTATION_ENTREPRISE,
} from "@/lib/constants";
import { ArrowLeft, Save, X, Send } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";

type Demande = Tables<"demandes">;

const MODES_PAIEMENT = ["Par virement", "À l'agence", "Espèce", "Chèque"] as const;

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
  const [typeBien, setTypeBien] = useState(demande.type_bien || "");
  const [frequence, setFrequence] = useState(demande.frequence);
  const [nom, setNom] = useState(demande.nom);
  const [tel, setTel] = useState(demande.telephone_direct || "");
  const [whatsapp, setWhatsapp] = useState(demande.telephone_whatsapp || "");
  const [ville, setVille] = useState(demande.ville);
  const [quartier, setQuartier] = useState(demande.quartier || "");
  const [adresse, setAdresse] = useState(demande.adresse || "");
  const [datePrestation, setDatePrestation] = useState(demande.date_prestation || "");
  const [heurePrestation, setHeurePrestation] = useState(demande.heure_prestation || "");
  const [duree, setDuree] = useState(String(demande.duree_heures || ""));
  const [nbIntervenants, setNbIntervenants] = useState(String(demande.nombre_intervenants || 1));
  const [montant, setMontant] = useState(String(demande.montant_total || ""));
  const [modePaiement, setModePaiement] = useState(demande.mode_paiement || "");
  const [avecProduit, setAvecProduit] = useState(demande.avec_produit || false);
  const [notesClient, setNotesClient] = useState(demande.notes_client || "");
  const [sendWhatsApp, setSendWhatsApp] = useState(false);

  const isReservation = ["confirme", "prestation_effectuee", "paye"].includes(statut);
  const isDevis = !isReservation;

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
      montant_candidat: montant ? Number(montant) / 2 : null,
      mode_paiement: modePaiement || null,
      avec_produit: avecProduit,
      notes_client: notesClient || null,
    });

    if (sendWhatsApp && whatsapp) {
      toast({
        title: isDevis ? "Devis régénéré" : "Confirmation régénérée",
        description: `Le document sera envoyé au client via WhatsApp (${whatsapp})`,
      });
    }

    onOpenChange(false);
  };

  return (
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

        {/* Row 1: Statut, Segment, Type de service */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Statut du besoin</Label>
            <Select value={statut} onValueChange={setStatut}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUTS).map(([key, s]) => (
                  <SelectItem key={key} value={key}>{s.label}</SelectItem>
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
        </div>

        {/* Form fields */}
        <div className="grid grid-cols-2 gap-4 mt-2">
          <div>
            <Label>Type de bien</Label>
            <Select value={typeBien} onValueChange={setTypeBien}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES_BIEN.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Fréquence</Label>
            <Select value={frequence} onValueChange={setFrequence}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FREQUENCES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3 pt-6">
            <Switch checked={avecProduit} onCheckedChange={setAvecProduit} />
            <Label>Avec produit ménager</Label>
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

          <div className="col-span-2 border-t pt-4 mt-2">
            <p className="text-sm font-semibold text-muted-foreground mb-3">Informations client</p>
          </div>

          <div><Label>Nom</Label><Input value={nom} onChange={(e) => setNom(e.target.value)} /></div>
          <div><Label>Tél. direct</Label><Input value={tel} onChange={(e) => setTel(e.target.value)} /></div>
          <div><Label>Tél. WhatsApp</Label><Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} /></div>
          <div><Label>Ville</Label><Input value={ville} onChange={(e) => setVille(e.target.value)} /></div>
          <div><Label>Quartier</Label><Input value={quartier} onChange={(e) => setQuartier(e.target.value)} /></div>
          <div className="col-span-2"><Label>Adresse</Label><Input value={adresse} onChange={(e) => setAdresse(e.target.value)} /></div>

          <div className="col-span-2 border-t pt-4 mt-2">
            <p className="text-sm font-semibold text-muted-foreground mb-3">Intervention</p>
          </div>

          <div><Label>Date</Label><Input type="date" value={datePrestation} onChange={(e) => setDatePrestation(e.target.value)} /></div>
          <div><Label>Heure</Label><Input type="time" value={heurePrestation} onChange={(e) => setHeurePrestation(e.target.value)} /></div>
          <div><Label>Durée (heures)</Label><Input type="number" value={duree} onChange={(e) => setDuree(e.target.value)} /></div>
          <div><Label>Nb intervenants</Label><Input type="number" value={nbIntervenants} onChange={(e) => setNbIntervenants(e.target.value)} /></div>
          <div>
            <Label>Montant total (MAD)</Label>
            <Input type="number" value={montant} onChange={(e) => setMontant(e.target.value)} />
            {montant && <p className="text-xs text-muted-foreground mt-1">Candidat : {(Number(montant) / 2).toFixed(0)} MAD</p>}
          </div>

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
                  {isDevis
                    ? "Régénérer le devis et renvoyer au client via WhatsApp"
                    : "Régénérer la confirmation de réservation et renvoyer au client via WhatsApp"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {isDevis
                  ? "Le devis sera régénéré et envoyé automatiquement au numéro WhatsApp du client."
                  : "La confirmation de réservation sera régénérée et envoyée automatiquement au numéro WhatsApp du client."}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-1" />Annuler
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-1" />Enregistrer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
