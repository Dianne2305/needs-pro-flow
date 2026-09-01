/**
 * NouvelleCommandeTab.tsx
 * Écran 02 — Saisie d'un turnover : bien, date/heure, nature du passage linge, options et sous-total.
 * Le linge n'est jamais chiffré ici : il est ajouté après comptage du runner.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Info, ShieldCheck, Camera, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  NATURES_LINGE, OPTIONS_AUTRES, OPTIONS_REASSORT, SEUIL_CONCIERGERIE, SUPPLEMENT_ZONE,
  formatDH, labelTypologie,
} from "@/lib/airbnb-constants";
import { cn } from "@/lib/utils";

export function NouvelleCommandeTab() {
  const qc = useQueryClient();
  const [clientId, setClientId] = useState("");
  const [bienId, setBienId] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [heure, setHeure] = useState("11:00");
  const [nature, setNature] = useState("depot_ramassage");
  const [reassort, setReassort] = useState<string | null>("essentiel");
  const [autres, setAutres] = useState<string[]>([]);

  const { data: clients = [] } = useQuery({
    queryKey: ["airbnb_clients"],
    queryFn: async () => (await supabase.from("airbnb_clients").select("*").order("nom")).data ?? [],
  });
  const { data: biens = [] } = useQuery({
    queryKey: ["airbnb_biens"],
    queryFn: async () => (await supabase.from("airbnb_biens").select("*").order("code")).data ?? [],
  });

  const client = clients.find((c) => c.id === clientId);
  const biensClient = biens.filter((b) => b.client_id === clientId);
  const bien = biens.find((b) => b.id === bienId);
  const suspendu = client?.statut === "suspendu";

  const montants = useMemo(() => {
    const base = bien ? Number(bien.tarif_base) : 0;
    const zone = bien?.zone_eloignee ? SUPPLEMENT_ZONE : 0;
    const pr = OPTIONS_REASSORT.find((o) => o.value === reassort)?.prix ?? 0;
    const autresTotal = autres.reduce((s, v) => s + (OPTIONS_AUTRES.find((o) => o.value === v)?.prix ?? 0), 0);
    return { base, zone, reassort: pr, autresTotal, sousTotal: base + zone + pr + autresTotal };
  }, [bien, reassort, autres]);

  const enregistrer = useMutation({
    mutationFn: async (statut: "brouillon" | "confirmee") => {
      if (!bien) throw new Error("Sélectionnez un bien");
      const numero = `CMD-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      const options = [
        ...(reassort ? [reassort] : []),
        ...autres,
      ];
      const { error } = await supabase.from("airbnb_commandes").insert({
        numero, client_id: clientId, bien_id: bienId,
        date_intervention: date, heure_intervention: heure,
        nature_linge: nature, options,
        montant_menage: montants.base, montant_zone: montants.zone,
        montant_options: montants.reassort + montants.autresTotal,
        statut,
      });
      if (error) throw error;
      return numero;
    },
    onSuccess: (numero) => {
      toast.success(`Commande ${numero} enregistrée`);
      qc.invalidateQueries({ queryKey: ["airbnb_commandes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAutre = (v: string) => setAutres((a) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Le bien et l'intervention</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Client *</Label>
              <Select value={clientId} onValueChange={(v) => { setClientId(v); setBienId(""); }}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}</SelectContent>
              </Select>
              {client && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {biensClient.length >= SEUIL_CONCIERGERIE
                    ? `✓ ${biensClient.length} biens confiés — tarif conciergerie applicable`
                    : `${biensClient.length} bien(s) confié(s) — tarif standard`}
                </p>
              )}
            </div>
            <div>
              <Label>Bien *</Label>
              <Select value={bienId} onValueChange={setBienId} disabled={!clientId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un bien" /></SelectTrigger>
                <SelectContent>{biensClient.map((b) => <SelectItem key={b.id} value={b.id}>{b.code} — {labelTypologie(b.typologie)}, {b.quartier}</SelectItem>)}</SelectContent>
              </Select>
              {bien && <p className="mt-1 text-xs text-muted-foreground">{labelTypologie(bien.typologie)} → {formatDH(Number(bien.tarif_base))} par turnover</p>}
            </div>
            <div>
              <Label>Date d'intervention *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">J+1 — standard de service</p>
            </div>
            <div>
              <Label>Heure d'intervention *</Label>
              <Input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">Heure de présentation de l'intervenante sur place</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Linge — nature du passage</CardTitle>
            <p className="text-xs text-muted-foreground">quantités relevées sur place</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 md:grid-cols-4">
              {NATURES_LINGE.map((n) => (
                <button
                  key={n.value}
                  type="button"
                  onClick={() => setNature(n.value)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    nature === n.value ? "border-primary bg-primary/10" : "hover:bg-muted",
                  )}
                >
                  <div className="text-lg">{n.icon}</div>
                  <div className="text-sm font-medium">{n.label}</div>
                  <div className="text-xs text-muted-foreground">{n.hint}</div>
                </button>
              ))}
            </div>
            {nature !== "aucun" && (
              <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
                <Info className="h-4 w-4 shrink-0" />
                <div>
                  <b>Aucune quantité n'est saisie ici.</b> Le nombre de pièces est inconnu avant le déplacement.
                  C'est le runner qui compte article par article sur place, et le système en déduit les sets et les pièces supplémentaires.
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Options de cette intervention</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Réassort — une seule formule</div>
              <div className="grid gap-2 md:grid-cols-2">
                {OPTIONS_REASSORT.map((o) => (
                  <button key={o.value} type="button" onClick={() => setReassort(reassort === o.value ? null : o.value)}
                    className={cn("rounded-lg border p-3 text-left", reassort === o.value ? "border-primary bg-primary/10" : "hover:bg-muted")}>
                    <div className="font-semibold">{o.prix} DH — {o.label}</div>
                    <div className="text-xs text-muted-foreground">{o.detail}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Autres options</div>
              <div className="grid gap-2 md:grid-cols-2">
                {OPTIONS_AUTRES.map((o) => (
                  <button key={o.value} type="button" onClick={() => toggleAutre(o.value)}
                    className={cn("rounded-lg border p-3 text-left", autres.includes(o.value) ? "border-primary bg-primary/10" : "hover:bg-muted")}>
                    <div className="font-semibold">{o.prix} DH — {o.label}</div>
                    <div className="text-xs text-muted-foreground">{o.detail}</div>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {suspendu && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-xs text-destructive">
            <b>Compte suspendu</b> — impossible de créer une nouvelle commande pour ce client tant que la facture échue n'est pas réglée.
          </div>
        )}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Montant de l'intervention</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Ligne label={`Ménage${bien ? " — " + labelTypologie(bien.typologie) : ""}`} value={montants.base} />
            {montants.zone > 0 && <Ligne label="Supplément zone éloignée" value={montants.zone} />}
            {montants.reassort > 0 && <Ligne label={OPTIONS_REASSORT.find((o) => o.value === reassort)!.label} value={montants.reassort} />}
            {autres.map((v) => <Ligne key={v} label={OPTIONS_AUTRES.find((o) => o.value === v)!.label} value={OPTIONS_AUTRES.find((o) => o.value === v)!.prix} />)}
            <div className="flex justify-between border-t pt-2 text-base font-bold">
              <span>Sous-total</span><span>{formatDH(montants.sousTotal)}</span>
            </div>
            {nature !== "aucun" && (
              <p className="pt-2 text-xs text-muted-foreground">
                <b>+ Linge — chiffré au ramassage.</b> Le montant sera ajouté automatiquement après le comptage du runner et le contrôle de la responsable linge.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Ce qui est inclus</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-xs">
            <p className="flex gap-2"><Camera className="h-4 w-4 shrink-0" />Photos de fin d'intervention — jamais facturées</p>
            <p className="flex gap-2"><Zap className="h-4 w-4 shrink-0" />Intervention à J+1 — standard, sans supplément</p>
            <p className="flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0" />Garantie 24h — ménage non conforme, on revient gratuitement</p>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" disabled={!bien || suspendu} onClick={() => enregistrer.mutate("brouillon")}>Brouillon</Button>
          <Button className="flex-1" disabled={!bien || suspendu} onClick={() => enregistrer.mutate("confirmee")}>Confirmer</Button>
        </div>
        <Badge variant="outline" className="w-full justify-center py-2 text-xs font-normal">
          Une commande avec ramassage n'est facturable qu'après validation du comptage par la responsable linge.
        </Badge>
      </div>
    </div>
  );
}

function Ligne({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between border-b border-dashed py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{formatDH(value)}</span>
    </div>
  );
}
