/**
 * RunnerLingeTab.tsx
 * Écran 04 — Tournée du runner et contrôle laverie : comptage article par article,
 * conversion automatique en sets + pièces supplémentaires, recomptage laverie et figeage du montant.
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
import { AlertTriangle, Lock, Truck } from "lucide-react";
import { toast } from "sonner";
import {
  ARTICLES_HORS_SET, MINIMUM_LINGE, SET_COMPOSITION, TARIF_PIECE_SUPP, TARIF_SET,
  calculerLinge, formatDH,
} from "@/lib/airbnb-constants";

type Q = Record<string, number>;

export function RunnerLingeTab() {
  const qc = useQueryClient();
  const [commandeId, setCommandeId] = useState("");
  const [etape, setEtape] = useState<"runner" | "laverie">("runner");
  const [q, setQ] = useState<Q>({});
  const [abime, setAbime] = useState(0);

  const { data: commandes = [] } = useQuery({
    queryKey: ["airbnb_commandes"],
    queryFn: async () => (await supabase.from("airbnb_commandes").select("*").order("date_intervention")).data ?? [],
  });
  const { data: biens = [] } = useQuery({
    queryKey: ["airbnb_biens"],
    queryFn: async () => (await supabase.from("airbnb_biens").select("*")).data ?? [],
  });

  const aRamasser = commandes.filter((c) => c.nature_linge === "ramassage" || c.nature_linge === "depot_ramassage");
  const commande = commandes.find((c) => c.id === commandeId);

  const { data: comptages = [] } = useQuery({
    queryKey: ["airbnb_comptages", commandeId],
    enabled: !!commandeId,
    queryFn: async () => (await supabase.from("airbnb_comptages").select("*").eq("commande_id", commandeId).order("created_at")).data ?? [],
  });

  const comptageRunner = comptages.find((c) => c.etape === "runner");
  const res = useMemo(() => calculerLinge(q), [q]);
  const ecart = etape === "laverie" && comptageRunner ? res.totalPieces - comptageRunner.total_pieces : 0;

  const set = (k: string, v: string) => setQ((p) => ({ ...p, [k]: Math.max(0, Number(v) || 0) }));

  const enregistrer = useMutation({
    mutationFn: async (figer: boolean) => {
      if (!commande) throw new Error("Sélectionnez une commande");
      const bien = biens.find((b) => b.id === commande.bien_id);
      const { error } = await supabase.from("airbnb_comptages").insert({
        commande_id: commande.id,
        bien_code: bien?.code ?? null,
        etape,
        quantites: q,
        total_pieces: res.totalPieces,
        sets: res.sets,
        pieces_supp: res.piecesSupp,
        montant: res.montant,
        ecart,
        montant_fige: figer,
      });
      if (error) throw error;
      if (figer) {
        const { error: e2 } = await supabase.from("airbnb_commandes").update({
          montant_linge: res.montant,
          montant_linge_abime: abime,
          comptage_valide: true,
          statut: "facturable",
        }).eq("id", commande.id);
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      toast.success(etape === "laverie" ? "Comptage laverie enregistré" : "Comptage runner enregistré");
      qc.invalidateQueries({ queryKey: ["airbnb_comptages", commandeId] });
      qc.invalidateQueries({ queryKey: ["airbnb_commandes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Truck className="h-4 w-4" />Tournée du jour — ramassages à effectuer</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {aRamasser.length === 0 && <p className="text-sm text-muted-foreground">Aucun ramassage programmé.</p>}
            {aRamasser.map((c) => {
              const b = biens.find((x) => x.id === c.bien_id);
              return (
                <button key={c.id} type="button" onClick={() => { setCommandeId(c.id); setQ({}); }}
                  className={`flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm ${commandeId === c.id ? "border-primary bg-primary/10" : "hover:bg-muted"}`}>
                  <div>
                    <div className="font-semibold">{b?.code} — {b?.quartier}</div>
                    <div className="text-xs text-muted-foreground">{c.numero} · {c.date_intervention} {c.heure_intervention ?? ""}</div>
                  </div>
                  {c.comptage_valide
                    ? <Badge className="bg-green-100 text-green-800"><Lock className="mr-1 h-3 w-3" />Figé</Badge>
                    : <Badge variant="outline">À compter</Badge>}
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Comptage article par article</CardTitle>
            <div className="flex gap-2 pt-1">
              <Select value={etape} onValueChange={(v) => setEtape(v as "runner" | "laverie")}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="runner">Comptage runner (sur place)</SelectItem>
                  <SelectItem value="laverie">Recomptage laverie (contrôle)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Articles composant un set</div>
              <div className="grid gap-3 md:grid-cols-3">
                {SET_COMPOSITION.map((a) => (
                  <div key={a.key}>
                    <Label className="text-xs">{a.label} <span className="text-muted-foreground">(×{a.parSet} / set)</span></Label>
                    <Input type="number" min={0} value={q[a.key] ?? ""} onChange={(e) => set(a.key, e.target.value)} placeholder="0" />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Articles hors set — facturés à la pièce</div>
              <div className="grid gap-3 md:grid-cols-4">
                {ARTICLES_HORS_SET.map((a) => (
                  <div key={a.key}>
                    <Label className="text-xs">{a.label}</Label>
                    <Input type="number" min={0} value={q[a.key] ?? ""} onChange={(e) => set(a.key, e.target.value)} placeholder="0" />
                  </div>
                ))}
              </div>
            </div>
            {etape === "laverie" && (
              <div>
                <Label className="text-xs">Montant linge abîmé / manquant (DH)</Label>
                <Input type="number" min={0} value={abime} onChange={(e) => setAbime(Number(e.target.value) || 0)} className="w-48" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Conversion automatique</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Total pièces comptées</span><b>{res.totalPieces}</b></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Sets complets</span><b>{res.sets} × {TARIF_SET} DH</b></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Pièces supplémentaires</span><b>{res.piecesSupp} × {TARIF_PIECE_SUPP} DH</b></div>
            <div className="flex justify-between border-t pt-2 text-lg font-bold"><span>Montant linge</span><span>{formatDH(res.montant)}</span></div>
            {res.minimumApplique && <p className="text-xs text-amber-700">Minimum de facturation de {MINIMUM_LINGE} DH appliqué.</p>}
            <p className="text-xs text-muted-foreground">
              Le nombre de sets correspond au plus petit ratio disponible parmi les articles du set. Tout ce qui dépasse devient une pièce supplémentaire.
            </p>
          </CardContent>
        </Card>

        {etape === "laverie" && comptageRunner && (
          <Card className={ecart !== 0 ? "border-destructive" : "border-green-300"}>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base">
              {ecart !== 0 && <AlertTriangle className="h-4 w-4 text-destructive" />}Contrôle d'écart
            </CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Comptage runner</span><b>{comptageRunner.total_pieces} pièces</b></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Recomptage laverie</span><b>{res.totalPieces} pièces</b></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Écart</span><b className={ecart !== 0 ? "text-destructive" : ""}>{ecart > 0 ? `+${ecart}` : ecart}</b></div>
              {ecart !== 0 && <p className="text-xs text-destructive">Écart à justifier avant figeage : un signalement est créé et le commercial est notifié.</p>}
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          <Button className="w-full" variant="outline" disabled={!commandeId || res.totalPieces === 0} onClick={() => enregistrer.mutate(false)}>
            Enregistrer le comptage
          </Button>
          <Button className="w-full" disabled={!commandeId || etape !== "laverie" || res.totalPieces === 0} onClick={() => enregistrer.mutate(true)}>
            <Lock className="mr-1 h-4 w-4" />Valider et figer le montant
          </Button>
          <p className="text-xs text-muted-foreground">
            Seule la responsable linge fige le montant. Une fois figé, la commande passe en « À facturer » et le linge n'est plus modifiable.
          </p>
        </div>
      </div>
    </div>
  );
}
