import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const TYPES_HABITATION = ["Studio", "Appartement", "Duplex", "Villa", "Maison"] as const;
const TYPES_HABITATION_SINISTRE = ["Studio", "Appartement", "Duplex", "Villa", "Bureau"] as const;
const ETATS_LOGEMENT = ["Vide", "Semi meublé", "Meublé"] as const;
const TYPES_SALISSURE = ["Normal", "Intensif"] as const;
const NATURES_INTERVENTION = [
  "Nettoyage après sinistre",
  "Nettoyage post/après évènement",
  "Remise en état express",
  "Autre situation urgente",
] as const;
const SUPERFICIES_BUREAUX = ["0-70 m²", "71-150 m²", "151-300 m²", "300+ m²"] as const;

interface ServiceFormFields {
  typeBien: string;
  setTypeBien: (v: string) => void;
  superficie: string;
  setSuperficie: (v: string) => void;
  etatLogement: string;
  setEtatLogement: (v: string) => void;
  typeSalissure: string;
  setTypeSalissure: (v: string) => void;
  natureIntervention: string;
  setNatureIntervention: (v: string) => void;
  descriptionIntervention: string;
  setDescriptionIntervention: (v: string) => void;
  duree: string;
  setDuree: (v: string) => void;
  nbIntervenants: string;
  setNbIntervenants: (v: string) => void;
  frequence: string;
  setFrequence: (v: string) => void;
  avecProduit: boolean;
  setAvecProduit: (v: boolean) => void;
  avecTorchons: boolean;
  setAvecTorchons: (v: boolean) => void;
  datePrestation: string;
  setDatePrestation: (v: string) => void;
  heurePrestation: string;
  setHeurePrestation: (v: string) => void;
  preferenceHoraire: string;
  setPreferenceHoraire: (v: string) => void;
  nomEntreprise: string;
  setNomEntreprise: (v: string) => void;
  contactEntreprise: string;
  setContactEntreprise: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
}

interface Props {
  typePrestation: string;
  segment: string;
  fields: ServiceFormFields;
}

function FrequenceField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>Fréquence</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="ponctuel">Une fois</SelectItem>
          <SelectItem value="abonnement">Abonnement</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function TypeHabitationField({ value, onChange, options = TYPES_HABITATION }: { value: string; onChange: (v: string) => void; options?: readonly string[] }) {
  return (
    <div>
      <Label>Type d'habitation</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
        <SelectContent>
          {options.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function PlanningFields({ fields }: { fields: ServiceFormFields }) {
  return (
    <>
      <div>
        <Label>Date d'intervention</Label>
        <Input type="date" value={fields.datePrestation} onChange={(e) => fields.setDatePrestation(e.target.value)} />
      </div>
      <div>
        <Label>Heure</Label>
        <Input type="time" value={fields.heurePrestation} onChange={(e) => fields.setHeurePrestation(e.target.value)} />
      </div>
      <div>
        <Label>Préférence horaire</Label>
        <Select value={fields.preferenceHoraire} onValueChange={fields.setPreferenceHoraire}>
          <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="matin">Le matin</SelectItem>
            <SelectItem value="apres_midi">L'après-midi</SelectItem>
            <SelectItem value="flexible">Flexible</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

function ServicesOptionnels({ fields }: { fields: ServiceFormFields }) {
  return (
    <>
      <div className="flex items-center gap-3">
        <Switch checked={fields.avecProduit} onCheckedChange={fields.setAvecProduit} />
        <Label>Produit ménager (+90 MAD)</Label>
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={fields.avecTorchons} onCheckedChange={fields.setAvecTorchons} />
        <Label>Torchons et serpillères (+40 MAD)</Label>
      </div>
    </>
  );
}

function DureePersonnesFields({ fields }: { fields: ServiceFormFields }) {
  return (
    <>
      <div>
        <Label>Durée (heures)</Label>
        <Input type="number" value={fields.duree} onChange={(e) => fields.setDuree(e.target.value)} />
      </div>
      <div>
        <Label>Nb intervenants</Label>
        <Input type="number" value={fields.nbIntervenants} onChange={(e) => fields.setNbIntervenants(e.target.value)} />
      </div>
    </>
  );
}

// ——————————— Formulaires par service ———————————

function MenageStandardForm({ fields }: { fields: ServiceFormFields }) {
  return (
    <>
      <TypeHabitationField value={fields.typeBien} onChange={fields.setTypeBien} />
      <FrequenceField value={fields.frequence} onChange={fields.setFrequence} />
      <DureePersonnesFields fields={fields} />
      <PlanningFields fields={fields} />
      <div className="col-span-2 border-t pt-3 mt-1">
        <p className="text-sm font-semibold text-muted-foreground mb-2">Services optionnels</p>
      </div>
      <ServicesOptionnels fields={fields} />
    </>
  );
}

function GrandMenageForm({ fields }: { fields: ServiceFormFields }) {
  return (
    <>
      <TypeHabitationField value={fields.typeBien} onChange={fields.setTypeBien} />
      <div>
        <Label>Superficie (m²)</Label>
        <Input type="number" placeholder="ex: 70" value={fields.superficie} onChange={(e) => fields.setSuperficie(e.target.value)} />
      </div>
      <FrequenceField value={fields.frequence} onChange={fields.setFrequence} />
      <DureePersonnesFields fields={fields} />
      <PlanningFields fields={fields} />
      <div className="col-span-2 border-t pt-3 mt-1">
        <p className="text-sm font-semibold text-muted-foreground mb-2">Services optionnels</p>
      </div>
      <ServicesOptionnels fields={fields} />
    </>
  );
}

function MenageAirbnbForm({ fields }: { fields: ServiceFormFields }) {
  return (
    <>
      <TypeHabitationField value={fields.typeBien} onChange={fields.setTypeBien} />
      <FrequenceField value={fields.frequence} onChange={fields.setFrequence} />
      <div>
        <Label>Nb intervenants</Label>
        <Input type="number" value={fields.nbIntervenants} onChange={(e) => fields.setNbIntervenants(e.target.value)} />
      </div>
      <PlanningFields fields={fields} />
    </>
  );
}

function PostDemenagementForm({ fields }: { fields: ServiceFormFields }) {
  return (
    <>
      <TypeHabitationField value={fields.typeBien} onChange={fields.setTypeBien} />
      <div>
        <Label>Superficie (m²)</Label>
        <Input type="number" placeholder="ex: 50" value={fields.superficie} onChange={(e) => fields.setSuperficie(e.target.value)} />
      </div>
      <div>
        <Label>État du logement</Label>
        <Select value={fields.etatLogement} onValueChange={fields.setEtatLogement}>
          <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
          <SelectContent>
            {ETATS_LOGEMENT.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Type de salissure</Label>
        <Select value={fields.typeSalissure} onValueChange={fields.setTypeSalissure}>
          <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
          <SelectContent>
            {TYPES_SALISSURE.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <PlanningFields fields={fields} />
      <div className="col-span-2 border-t pt-3 mt-1">
        <p className="text-sm font-semibold text-muted-foreground mb-2">Services optionnels</p>
      </div>
      <ServicesOptionnels fields={fields} />
    </>
  );
}

function FinChantierForm({ fields }: { fields: ServiceFormFields }) {
  return (
    <>
      <TypeHabitationField value={fields.typeBien} onChange={fields.setTypeBien} />
      <div>
        <Label>Superficie (m²)</Label>
        <Input type="number" placeholder="ex: 50" value={fields.superficie} onChange={(e) => fields.setSuperficie(e.target.value)} />
      </div>
      <PlanningFields fields={fields} />
    </>
  );
}

function AuxiliaireDeVieForm() {
  return (
    <div className="col-span-2 text-center py-6 text-muted-foreground border rounded-lg bg-muted/30">
      <p className="font-medium">Service sur mesure</p>
      <p className="text-sm mt-1">Un assistant social et garde-malade prendront contact avec le client pour valider les points essentiels.</p>
    </div>
  );
}

function PostSinistreForm({ fields }: { fields: ServiceFormFields }) {
  return (
    <>
      <TypeHabitationField value={fields.typeBien} onChange={fields.setTypeBien} options={TYPES_HABITATION_SINISTRE} />
      <div>
        <Label>Nature de l'intervention</Label>
        <Select value={fields.natureIntervention} onValueChange={fields.setNatureIntervention}>
          <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
          <SelectContent>
            {NATURES_INTERVENTION.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2">
        <Label>Description de la situation</Label>
        <Textarea value={fields.descriptionIntervention} onChange={(e) => fields.setDescriptionIntervention(e.target.value)} rows={3} placeholder="Donnez-nous plus d'informations..." />
      </div>
      <PlanningFields fields={fields} />
      <div className="col-span-2 border-t pt-3 mt-1">
        <p className="text-sm font-semibold text-muted-foreground mb-2">Services optionnels</p>
      </div>
      <ServicesOptionnels fields={fields} />
    </>
  );
}

function MenageBureauxForm({ fields }: { fields: ServiceFormFields }) {
  return (
    <>
      <div>
        <Label>Superficie</Label>
        <Select value={fields.superficie} onValueChange={fields.setSuperficie}>
          <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
          <SelectContent>
            {SUPERFICIES_BUREAUX.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <FrequenceField value={fields.frequence} onChange={fields.setFrequence} />
      <DureePersonnesFields fields={fields} />
      <PlanningFields fields={fields} />
      <div className="col-span-2 border-t pt-3 mt-1">
        <p className="text-sm font-semibold text-muted-foreground mb-2">Services optionnels</p>
      </div>
      <ServicesOptionnels fields={fields} />
      <div className="col-span-2 border-t pt-3 mt-1">
        <p className="text-sm font-semibold text-muted-foreground mb-2">Informations entreprise</p>
      </div>
      <div><Label>Nom de l'entreprise</Label><Input value={fields.nomEntreprise} onChange={(e) => fields.setNomEntreprise(e.target.value)} /></div>
      <div><Label>Personne à contacter</Label><Input value={fields.contactEntreprise} onChange={(e) => fields.setContactEntreprise(e.target.value)} /></div>
      <div><Label>Email</Label><Input type="email" value={fields.email} onChange={(e) => fields.setEmail(e.target.value)} /></div>
    </>
  );
}

function PlacementGestionForm() {
  return (
    <div className="col-span-2 text-center py-6 text-muted-foreground border rounded-lg bg-muted/30">
      <p className="font-medium">Service sur mesure — Placement & Gestion</p>
      <p className="text-sm mt-1">Un chargé de clientèle prendra contact avec l'entreprise pour établir une offre personnalisée.</p>
    </div>
  );
}

export function ServiceFormFields({ typePrestation, segment, fields }: Props) {
  const formMap: Record<string, JSX.Element> = {
    "Ménage standard": <MenageStandardForm fields={fields} />,
    "Grand ménage": <GrandMenageForm fields={fields} />,
    "Ménage Air BnB": <MenageAirbnbForm fields={fields} />,
    "Nettoyage post-déménagement": <PostDemenagementForm fields={fields} />,
    "Ménage fin de chantier": <FinChantierForm fields={fields} />,
    "Auxiliaire de vie": <AuxiliaireDeVieForm />,
    "Ménage post-sinistre": <PostSinistreForm fields={fields} />,
    "Ménage Bureaux": <MenageBureauxForm fields={fields} />,
    "Placement & gestion": <PlacementGestionForm />,
  };

  const form = formMap[typePrestation];

  if (!form) {
    return (
      <div className="col-span-2 text-center py-4 text-muted-foreground">
        Sélectionnez un type de service pour afficher le formulaire correspondant.
      </div>
    );
  }

  return <>{form}</>;
}
