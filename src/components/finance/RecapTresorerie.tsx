/**
 * RecapTresorerie.tsx
 * Tableau de bord récapitulatif : encaissements & trésorerie (calculé depuis facturation + operations_caisse).
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Facturation, partAgence, partProfil } from "@/lib/finance-types";

const fmt = (n: number) => n.toLocaleString("fr-MA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " DH";

const CATEGORIES: { label: string; match: (s: string) => boolean }[] = [
  { label: "Salaires (équipe agence)", match: (s) => /salaire|paie\b|équipe|equipe/.test(s) },
  { label: "Paiement femmes de ménage", match: (s) => /femme|fdm|ménage|menage|profil/.test(s) },
  { label: "Achat produits ménagers", match: (s) => /produit|ménager|menager|nettoyage/.test(s) },
  { label: "Achat matériel / équipement", match: (s) => /matériel|materiel|équipement|equipement|achat/.test(s) },
  { label: "Loyer & charges bureaux", match: (s) => /loyer|bureau|charge/.test(s) },
  { label: "Frais de déplacement", match: (s) => /déplacement|deplacement|transport|essence|carburant/.test(s) },
  { label: "Publicité & Marketing", match: (s) => /pub|marketing|ads|facebook|google/.test(s) },
  { label: "Frais bancaires", match: (s) => /banc|bank|virement|cmi/.test(s) },
  { label: "Charges téléphoniques", match: (s) => /tél|tel|phone|inwi|orange|iam|maroc telecom/.test(s) },
  { label: "Formation", match: (s) => /formation|coaching/.test(s) },
  { label: "Divers / Imprévus", match: () => true },
];

function Row({ label, value, color = "text-foreground" }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center px-4 py-2 border-b last:border-b-0 text-sm">
      <span className="text-foreground/80">{label}</span>
      <span className={`font-semibold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-md overflow-hidden bg-card">
      <div className={`${color} text-white font-bold text-xs uppercase tracking-wider px-4 py-2`}>{title}</div>
      <div>{children}</div>
    </div>
  );
}

export default function RecapTresorerie() {
  const { data: missions = [] } = useQuery({
    queryKey: ["facturation", "recap"],
    queryFn: async () => {
      const { data } = await supabase.from("facturation").select("*");
      return (data || []) as unknown as Facturation[];
    },
  });
  const { data: ops = [] } = useQuery({
    queryKey: ["operations_caisse", "recap"],
    queryFn: async () => {
      const { data } = await supabase.from("operations_caisse").select("*");
      return data || [];
    },
  });

  const suivi = useMemo(() => {
    let total = missions.length;
    let montantTotal = 0, acomptes = 0;
    missions.forEach((m) => {
      montantTotal += m.montant_total || 0;
      acomptes += m.montant_paye_client || 0;
    });
    return { total, montantTotal, acomptes, reste: montantTotal - acomptes };
  }, [missions]);

  const parStatut = useMemo(() => {
    let attente = 0, attenteFM = 0, virement = 0, depot = 0, encaisse = 0, annule = 0;
    missions.forEach((m) => {
      const t = m.montant_total || 0;
      if (m.statut_paiement === "facturation_annulee") { annule += t; return; }
      if (m.statut_paiement === "non_paye") { attente += t; return; }
      if (m.statut_paiement === "agence_payee_client") { attenteFM += t; return; }
      if (m.statut_paiement === "paye") {
        const mode = (m.mode_paiement_reel || "").toLowerCase();
        if (mode.includes("vir")) virement += t;
        else if (mode.includes("dépôt") || mode.includes("depot") || mode.includes("commerc")) depot += t;
        else encaisse += t;
      }
    });
    return { attente, attenteFM, virement, depot, encaisse, annule };
  }, [missions]);

  const remettre = useMemo(() => {
    const map: Record<string, number> = {};
    missions.forEach((m) => {
      if (m.encaisse_par && m.encaisse_par !== "agence" && !m.part_agence_reversee) {
        const key = m.encaisse_par;
        map[key] = (map[key] || 0) + partAgence(m);
      }
    });
    return map;
  }, [missions]);

  const tresorerie = useMemo(() => {
    let entrees = 0, sorties = 0;
    ops.forEach((o: any) => {
      if (o.type_operation === "entree") entrees += Number(o.montant) || 0;
      else if (o.type_operation === "sortie") sorties += Number(o.montant) || 0;
    });
    return { entrees, sorties, solde: entrees - sorties };
  }, [ops]);

  const sortiesParCat = useMemo(() => {
    const map: Record<string, number> = {};
    CATEGORIES.forEach((c) => (map[c.label] = 0));
    ops.forEach((o: any) => {
      if (o.type_operation !== "sortie") return;
      const lib = (o.libelle || "").toLowerCase();
      const cat = CATEGORIES.find((c) => c.match(lib));
      if (cat) map[cat.label] += Number(o.montant) || 0;
    });
    return map;
  }, [ops]);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="bg-[#0f1b3d] text-white px-5 py-3">
        <h2 className="font-bold text-base tracking-wide uppercase">Tableau de bord — Encaissements & Trésorerie</h2>
        <p className="text-xs text-white/60 mt-0.5">Mis à jour automatiquement — récapitulatif global</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-3">
        <Section title="Suivi des demandes" color="bg-blue-600">
          <Row label="Nombre total de demandes actives" value={String(suivi.total)} />
          <Row label="Montant total des demandes (DH)" value={fmt(suivi.montantTotal)} color="text-emerald-700" />
          <Row label="Total acomptes reçus (DH)" value={fmt(suivi.acomptes)} color="text-emerald-700" />
          <Row label="Total soldes restants à encaisser (DH)" value={fmt(suivi.reste)} color="text-amber-700" />
        </Section>

        <Section title="Par statut d'encaissement" color="bg-blue-600">
          <div className="bg-amber-50"><Row label="En attente de paiement" value={fmt(parStatut.attente)} color="text-amber-700" /></div>
          <div className="bg-emerald-50"><Row label="Payé — En attente FM" value={fmt(parStatut.attenteFM)} color="text-emerald-700" /></div>
          <div className="bg-emerald-50"><Row label="Payé — Virement reçu" value={fmt(parStatut.virement)} color="text-emerald-700" /></div>
          <div className="bg-fuchsia-50"><Row label="Payé — En attente dépôt commercial" value={fmt(parStatut.depot)} color="text-fuchsia-700" /></div>
          <div className="bg-fuchsia-50"><Row label="Payé et encaissé ✓" value={fmt(parStatut.encaisse)} color="text-fuchsia-700" /></div>
          <div className="bg-rose-50"><Row label="Annulé" value={fmt(parStatut.annule)} color="text-rose-700" /></div>
        </Section>

        <Section title="À remettre / déposer cette semaine" color="bg-orange-700">
          {["Expéditrice FM — à remettre à l'agence", "Kawtar — à déposer chez le responsable", "Mouasa — à déposer chez le responsable", "Mehdi — à déposer chez le responsable"].map((label) => {
            const key = label.split(" —")[0].toLowerCase();
            const val = Object.entries(remettre).find(([k]) => k.toLowerCase().includes(key))?.[1] || 0;
            return <Row key={label} label={label} value={fmt(val)} color="text-orange-700" />;
          })}
          <div className="bg-amber-50 text-center text-sm text-amber-800 py-2 px-3 italic">
            {Object.values(remettre).reduce((a, b) => a + b, 0) === 0 ? "✦ Aucun montant en attente de remise" : "Montants en attente de remise"}
          </div>
        </Section>

        <Section title="Trésorerie globale" color="bg-teal-700">
          <div className="bg-emerald-50"><Row label="Total entrées (tous encaissements)" value={fmt(tresorerie.entrees)} color="text-emerald-700" /></div>
          <div className="bg-rose-50"><Row label="Total sorties (toutes dépenses)" value={fmt(tresorerie.sorties)} color="text-rose-700" /></div>
        </Section>

        <div className="lg:col-span-2">
          <Section title="Détail des sorties par catégorie" color="bg-slate-700">
            {Object.entries(sortiesParCat).map(([label, val]) => (
              <Row key={label} label={label} value={fmt(val)} color={val > 0 ? "text-rose-700" : "text-foreground/60"} />
            ))}
          </Section>
        </div>
      </div>

      <div className="bg-[#0f1b3d] text-white flex justify-between items-center px-5 py-3">
        <span className="font-bold text-sm uppercase tracking-wide">Solde net (Entrées − Sorties)</span>
        <span className={`font-bold text-xl tabular-nums ${tresorerie.solde >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{fmt(tresorerie.solde)}</span>
      </div>
    </div>
  );
}
