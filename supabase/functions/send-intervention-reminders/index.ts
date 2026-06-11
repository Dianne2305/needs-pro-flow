/**
 * send-intervention-reminders
 * Cron job: scans every demande's `planning` JSON, finds upcoming PlanningJour
 * occurrences ~24h away and inserts an in-app notification (table `notifications`).
 * Idempotent via `rappel_envoye: true` flag stored on the PlanningJour entry.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const JOUR_INDEX: Record<string, number> = {
  lundi: 1, mardi: 2, mercredi: 3, jeudi: 4,
  vendredi: 5, samedi: 6, dimanche: 0,
};

type PlanningJour = {
  jour: string;
  heure_debut?: string;
  heure_fin?: string;
  statut?: "a_venir" | "terminee";
  rappel_envoye?: boolean;
};
type PlanningSemaine = {
  semaine_debut?: string;
  semaine_fin?: string;
  jours: PlanningJour[];
  statut?: "en_cours" | "termine";
};
type Planning = {
  semaines?: PlanningSemaine[];
  jours?: PlanningJour[];
  semaine_debut?: string;
  semaine_fin?: string;
};

function computeDateForJour(semaineDebut: string, jourName: string): Date | null {
  if (!semaineDebut || !JOUR_INDEX.hasOwnProperty(jourName)) return null;
  const base = new Date(semaineDebut + "T00:00:00");
  if (isNaN(base.getTime())) return null;
  const targetDow = JOUR_INDEX[jourName];
  const baseDow = base.getDay();
  let diff = targetDow - baseDow;
  if (diff < 0) diff += 7;
  base.setDate(base.getDate() + diff);
  return base;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: demandes, error } = await supabase
    .from("demandes")
    .select("id, nom, planning, statut, frequence")
    .not("planning", "is", null)
    .not("statut", "in", '("annulee","cloturee","paye","prestation_terminee","facturation_annulee")');

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const now = Date.now();
  const windowStart = now + 23 * 3600 * 1000;
  const windowEnd = now + 25 * 3600 * 1000;
  let notifsCreated = 0;

  for (const d of demandes || []) {
    const planning = (d.planning as Planning) || {};
    let changed = false;
    const semaines: PlanningSemaine[] = planning.semaines && planning.semaines.length > 0
      ? planning.semaines
      : (planning.jours
        ? [{ semaine_debut: planning.semaine_debut, semaine_fin: planning.semaine_fin, jours: planning.jours }]
        : []);

    for (const sem of semaines) {
      if (sem.statut === "termine") continue;
      if (!sem.semaine_debut) continue;
      for (const j of sem.jours || []) {
        if (j.statut === "terminee") continue;
        if (j.rappel_envoye) continue;
        const date = computeDateForJour(sem.semaine_debut, j.jour);
        if (!date) continue;
        if (j.heure_debut) {
          const [hh, mm] = j.heure_debut.split(":").map(Number);
          date.setHours(hh || 0, mm || 0, 0, 0);
        }
        const t = date.getTime();
        if (t >= windowStart && t <= windowEnd) {
          const dateStr = date.toLocaleDateString("fr-FR");
          const heureStr = j.heure_debut || "";
          await supabase.from("notifications").insert({
            demande_id: d.id,
            type: "operationnel",
            message: `Rappel : intervention prévue demain ${dateStr}${heureStr ? ` à ${heureStr}` : ""} chez ${d.nom}`,
            date_rappel: new Date(t).toISOString(),
          });
          j.rappel_envoye = true;
          changed = true;
          notifsCreated++;
        }
      }
    }

    if (changed) {
      const next: Planning = { ...planning, semaines };
      await supabase.from("demandes").update({ planning: next as any }).eq("id", d.id);
    }
  }

  return new Response(JSON.stringify({ ok: true, notifsCreated }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
