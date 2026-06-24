/**
 * PromoCodeForm.tsx
 * Formulaire partagé (création + édition) d'un code promo selon CDC v1.
 *
 * Inclut : limite d'utilisations, 1 usage/client, compteur SMS, aperçu temps réel,
 * variables ({prénom}, {code}, {valeur}, {expiration}, {lien}), workflow Brouillon vs Publier.
 */
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import {
  TYPES_REDUCTION,
  SEGMENTS_CLIENT,
  STATUTS_CLIENT,
  SERVICES_PARTICULIER,
  SERVICES_ENTREPRISE,
  CANAUX_DIFFUSION,
  renderPromoMessage,
} from "@/lib/marketing-constants";

export type PromoFormVariant = "simple" | "bd";

export interface PromoFormState {
  nom: string;
  code_promo: string;
  type_reduction: string;
  valeur_reduction: string;
  segment_client: string;
  statut_client: string;
  services: string[];
  canaux: string[];
  limite_utilisation: string;
  quota_par_client: boolean;
  message_promotionnel: string;
  date_debut: string;
  date_fin: string;
  date_indeterminee: boolean;
}

interface Props {
  value: PromoFormState;
  onChange: (next: PromoFormState) => void;
  /** Erreur d'unicité du code (renvoyée par le parent après tentative). */
  codeError?: string | null;
  /** "simple" masque : statut client, limite d'utilisation, canal de diffusion, message. */
  variant?: PromoFormVariant;
}

export function defaultPromoForm(): PromoFormState {
  return {
    nom: "",
    code_promo: "",
    type_reduction: "pourcentage",
    valeur_reduction: "",
    segment_client: "particulier",
    statut_client: "tous",
    services: [],
    canaux: [],
    limite_utilisation: "",
    quota_par_client: false,
    message_promotionnel: "",
    date_debut: new Date().toISOString().split("T")[0],
    date_fin: "",
    date_indeterminee: false,
  };
}

/** Valide l'état du formulaire (utilisé par les parents pour activer les boutons). */
export function validatePromoForm(f: PromoFormState): boolean {
  if (!f.nom || !f.code_promo) return false;
  if (f.type_reduction !== "abonnement_offert") {
    if (!f.valeur_reduction) return false;
    const v = Number(f.valeur_reduction);
    if (f.type_reduction === "pourcentage" && (v < 1 || v > 100)) return false;
    if (f.type_reduction === "montant_fixe" && v <= 0) return false;
  }
  if (f.services.length === 0) return false;
  if (!f.date_debut) return false;
  if (!f.date_indeterminee && !f.date_fin) return false;
  if (!f.date_indeterminee && f.date_fin && f.date_fin < f.date_debut) return false;
  if (f.nom.length > 80) return false;
  if (f.code_promo.length > 20) return false;
  return true;
}

const SMS_LIMIT = 160;
const SMS_WARN = 145;

export function PromoCodeForm({ value, onChange, codeError, variant = "bd" }: Props) {
  const f = value;
  const set = (patch: Partial<PromoFormState>) => onChange({ ...f, ...patch });
  const isSimple = variant === "simple";

  const copyCode = () => {
    if (!f.code_promo) return;
    navigator.clipboard.writeText(f.code_promo);
    toast.success("Code copié !");
  };

  const shareCode = async () => {
    if (!f.code_promo) return;
    const text = `Profitez du code promo ${f.code_promo} sur Agence Éclat`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Code promo", text });
        return;
      } catch {
        // utilisateur annule, on retombe sur le copier
      }
    }
    navigator.clipboard.writeText(text);
    toast.success("Lien de partage copié !");
  };

  const servicesDisponibles = useMemo(
    () => (f.segment_client === "entreprise" ? [...SERVICES_ENTREPRISE] : [...SERVICES_PARTICULIER]),
    [f.segment_client],
  );

  const toggleService = (s: string) =>
    set({ services: f.services.includes(s) ? f.services.filter((x) => x !== s) : [...f.services, s] });

  const toggleCanal = (c: string) =>
    set({ canaux: f.canaux.includes(c) ? f.canaux.filter((x) => x !== c) : [...f.canaux, c] });

  const valeurAffichee = useMemo(() => {
    if (f.type_reduction === "abonnement_offert") return "1 mois offert";
    if (!f.valeur_reduction) return "";
    return f.type_reduction === "pourcentage" ? `${f.valeur_reduction}%` : `${f.valeur_reduction} MAD`;
  }, [f.type_reduction, f.valeur_reduction]);

  const apercu = useMemo(
    () =>
      renderPromoMessage(f.message_promotionnel, {
        code: f.code_promo || "BIENVENUE20",
        valeur: valeurAffichee || "20%",
        expiration: f.date_fin ? f.date_fin.split("-").reverse().join("/") : "30/06/2026",
      }),
    [f.message_promotionnel, f.code_promo, valeurAffichee, f.date_fin],
  );

  const len = apercu.length;
  const isSms = f.canaux.includes("sms");
  const counterColor = isSms && len > SMS_WARN ? "text-destructive" : "text-emerald-600";

  return (
    <div className="space-y-4">
      <div>
        <Label>Nom de l'offre *</Label>
        <Input
          placeholder="ex: Promo Nouveau Client"
          value={f.nom}
          maxLength={80}
          onChange={(e) => set({ nom: e.target.value })}
        />
        <p className="text-[10px] text-muted-foreground mt-0.5">{f.nom.length} / 80</p>
      </div>

      <div>
        <Label>Code promo *</Label>
        <Input
          placeholder="ex: BIENVENUE10"
          value={f.code_promo}
          maxLength={20}
          onChange={(e) => set({ code_promo: e.target.value.toUpperCase().replace(/\s+/g, "") })}
          className="font-mono"
        />
        {codeError && <p className="text-xs text-destructive mt-1">{codeError}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Type de réduction *</Label>
          <Select value={f.type_reduction} onValueChange={(v) => set({ type_reduction: v, valeur_reduction: v === "abonnement_offert" ? "" : f.valeur_reduction })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TYPES_REDUCTION.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {f.type_reduction !== "abonnement_offert" && (
          <div>
            <Label>Valeur *</Label>
            <Input
              type="number"
              min={f.type_reduction === "pourcentage" ? 1 : 0}
              max={f.type_reduction === "pourcentage" ? 100 : undefined}
              placeholder={f.type_reduction === "pourcentage" ? "ex: 10" : "ex: 50"}
              value={f.valeur_reduction}
              onChange={(e) => set({ valeur_reduction: e.target.value })}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Segment *</Label>
          <Select value={f.segment_client} onValueChange={(v) => set({ segment_client: v, services: [] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SEGMENTS_CLIENT.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Statut client *</Label>
          <Select value={f.statut_client} onValueChange={(v) => set({ statut_client: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUTS_CLIENT.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Services concernés *</Label>
        <div className="grid grid-cols-2 gap-2 mt-1">
          {servicesDisponibles.map((s) => (
            <label key={s} className="flex items-center gap-2 text-sm">
              <Checkbox checked={f.services.includes(s)} onCheckedChange={() => toggleService(s)} />
              {s}
            </label>
          ))}
        </div>
        {f.services.length === 0 && (
          <p className="text-xs text-destructive mt-1">Sélectionnez au moins un service</p>
        )}
      </div>

      {/* Quotas (NOUVEAU CDC) */}
      <div className="rounded-md border bg-muted/30 p-3 space-y-3">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Règles d'utilisation</p>
        <div>
          <Label className="text-sm">Limite d'utilisations <span className="text-xs text-muted-foreground">(facultatif)</span></Label>
          <Input
            type="number"
            min={1}
            placeholder="Laisser vide = illimité"
            value={f.limite_utilisation}
            onChange={(e) => set({ limite_utilisation: e.target.value })}
            className="mt-1"
          />
          <p className="text-[11px] text-muted-foreground mt-1">Décrémenté à chaque utilisation validée. Bascule en « Épuisé » à 100 %.</p>
        </div>
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <Checkbox
            className="mt-0.5"
            checked={f.quota_par_client}
            onCheckedChange={(c) => set({ quota_par_client: !!c })}
          />
          <span>
            <span className="font-medium">1 utilisation par client</span>
            <span className="block text-[11px] text-muted-foreground">Un même client ne pourra pas utiliser ce code deux fois.</span>
          </span>
        </label>
      </div>

      <div>
        <Label>Canal de diffusion *</Label>
        <div className="flex flex-wrap gap-4 mt-1">
          {CANAUX_DIFFUSION.map((c) => (
            <label key={c.value} className="flex items-center gap-2 text-sm">
              <Checkbox checked={f.canaux.includes(c.value)} onCheckedChange={() => toggleCanal(c.value)} />
              {c.label}
            </label>
          ))}
        </div>
        {f.canaux.length === 0 && (
          <p className="text-[11px] text-muted-foreground mt-1">Aucun canal coché : code disponible uniquement en saisie manuelle.</p>
        )}
      </div>

      <div>
        <Label>
          Message promotionnel <span className="text-xs text-muted-foreground">(facultatif)</span>
        </Label>
        <Textarea
          placeholder="Bonjour {prénom}, profitez de {valeur} avec le code {code}, valable jusqu'au {expiration}."
          value={f.message_promotionnel}
          onChange={(e) => set({ message_promotionnel: e.target.value })}
          rows={3}
        />
        <div className="flex items-center justify-between mt-1">
          <p className="text-[11px] text-muted-foreground">
            Variables : <code>{"{prénom} {code} {valeur} {expiration} {lien}"}</code>
          </p>
          <p className={`text-[11px] font-mono ${counterColor}`}>
            {len} / {SMS_LIMIT}
          </p>
        </div>
        {f.message_promotionnel && (
          <div className="mt-2 rounded-md border bg-card p-3">
            <p className="text-[10px] uppercase text-muted-foreground mb-1">Aperçu</p>
            <p className="text-sm whitespace-pre-wrap">{apercu}</p>
          </div>
        )}
      </div>

      <div>
        <Label>Promotion valable</Label>
        <div className="grid grid-cols-2 gap-3 mt-1">
          <div>
            <Label className="text-xs text-muted-foreground">Date début *</Label>
            <Input
              type="date"
              value={f.date_debut}
              onChange={(e) => set({ date_debut: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Date fin {f.date_indeterminee ? "" : "*"}</Label>
            <Input
              type="date"
              value={f.date_fin}
              onChange={(e) => set({ date_fin: e.target.value })}
              disabled={f.date_indeterminee}
              min={f.date_debut}
              className={f.date_indeterminee ? "opacity-50" : ""}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm mt-2">
          <Checkbox
            checked={f.date_indeterminee}
            onCheckedChange={(c) => set({ date_indeterminee: !!c, date_fin: "" })}
          />
          Date indéterminée
        </label>
        {!f.date_indeterminee && f.date_fin && f.date_fin < f.date_debut && (
          <p className="text-xs text-destructive mt-1">La date de fin doit être ≥ à la date de début</p>
        )}
      </div>
    </div>
  );
}

/** Mappe une row Supabase `offres_marketing` vers l'état formulaire. */
export function rowToForm(row: any): PromoFormState {
  return {
    nom: row?.nom ?? "",
    code_promo: row?.code_promo ?? "",
    type_reduction: row?.type_reduction ?? "pourcentage",
    valeur_reduction: row?.valeur_reduction != null ? String(row.valeur_reduction) : "",
    segment_client: row?.segment_client ?? "particulier",
    statut_client: row?.statut_client ?? "tous",
    services: Array.isArray(row?.services_concernes) ? row.services_concernes : [],
    canaux: Array.isArray(row?.canaux_diffusion) ? row.canaux_diffusion : [],
    limite_utilisation: row?.limite_utilisation != null ? String(row.limite_utilisation) : "",
    quota_par_client: !!row?.quota_par_client,
    message_promotionnel: row?.message_promotionnel ?? "",
    date_debut: row?.date_debut ?? new Date().toISOString().split("T")[0],
    date_fin: row?.date_fin ?? "",
    date_indeterminee: !row?.date_fin,
  };
}

/** Mappe l'état formulaire vers un payload Supabase. */
export function formToPayload(f: PromoFormState) {
  return {
    nom: f.nom,
    code_promo: f.code_promo,
    type_reduction: f.type_reduction,
    valeur_reduction: f.type_reduction === "abonnement_offert" ? 0 : Number(f.valeur_reduction),
    segment_client: f.segment_client,
    statut_client: f.statut_client,
    services_concernes: f.services,
    canaux_diffusion: f.canaux,
    limite_utilisation: f.limite_utilisation ? Number(f.limite_utilisation) : null,
    quota_par_client: f.quota_par_client,
    message_promotionnel: f.message_promotionnel || null,
    date_debut: f.date_debut,
    date_fin: f.date_indeterminee ? null : f.date_fin || null,
  };
}
