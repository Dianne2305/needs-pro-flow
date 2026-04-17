/**
 * QualiteFeedback.tsx
 * Page Qualité & Feedback : dashboard graphiques + table des feedbacks reçus (icône œil pour voir détails).
 */
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { ClipboardCheck, ThumbsUp, ThumbsDown, Clock, Send, Star, BarChart3, PieChart, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PieChart as RechartsPie, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

const STATUT_FEEDBACK = {
  en_attente: { label: "En attente de retour", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  lien_envoye: { label: "Lien envoyé", color: "bg-blue-100 text-blue-800", icon: Send },
  positif: { label: "Feedback positif", color: "bg-green-100 text-green-800", icon: ThumbsUp },
  negatif: { label: "Feedback négatif", color: "bg-red-100 text-red-800", icon: ThumbsDown },
} as const;

type Feedback = {
  id: string;
  demande_id: string;
  profil_id: string | null;
  token: string;
  nom_client: string;
  telephone_client: string | null;
  ville: string | null;
  type_service: string | null;
  profil_nom: string | null;
  date_prestation: string | null;
  satisfaction: string | null;
  qualite_menage: string | null;
  professionnel: string | null;
  recommande_profil: boolean | null;
  recommande_agence: boolean | null;
  note_agence: number | null;
  commentaire: string | null;
  statut: string;
  lien_envoye_at: string | null;
  submitted_at: string | null;
  created_at: string;
};

export default function QualiteFeedback() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState("tous");
  const [villeFilter, setVilleFilter] = useState("toutes");
  const [detailFeedback, setDetailFeedback] = useState<Feedback | null>(null);

  const { data: feedbacks = [], isLoading } = useQuery({
    queryKey: ["feedbacks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedbacks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Feedback[];
    },
  });

  // Auto-envoi WhatsApp dès qu'un nouveau feedback "en_attente" apparaît (créé par trigger Payé)
  const autoSentRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!feedbacks.length) return;
    // Au 1er chargement, on marque tous les feedbacks existants comme "déjà vus"
    // pour ne traiter QUE les nouveaux qui arrivent par la suite.
    if (!initializedRef.current) {
      feedbacks.forEach((f) => autoSentRef.current.add(f.id));
      initializedRef.current = true;
      return;
    }

    feedbacks.forEach((f) => {
      if (autoSentRef.current.has(f.id)) return;
      autoSentRef.current.add(f.id);
      if (f.statut !== "en_attente" || !f.telephone_client) return;

      const link = `${window.location.origin}/feedback/${f.token}`;
      const msg = `Bonjour,\nMerci d'avoir fait appel à notre service de ménage.\nVotre avis est très important pour nous.\nMerci de répondre à ce court questionnaire :\n${link}`;
      const phone = f.telephone_client.replace(/\s/g, "");
      const waPhone = phone.startsWith("+") ? phone.slice(1) : "212" + phone;
      window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`, "_blank");

      supabase
        .from("feedbacks")
        .update({ statut: "lien_envoye", lien_envoye_at: new Date().toISOString() })
        .eq("id", f.id)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["feedbacks"] });
        });
      toast({ title: "Lien WhatsApp envoyé automatiquement", description: f.nom_client });
    });
  }, [feedbacks, queryClient]);

  // Realtime: rafraîchit la liste dès qu'un feedback est créé/modifié
  useEffect(() => {
    const channel = supabase
      .channel("feedbacks-auto")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feedbacks" },
        () => queryClient.invalidateQueries({ queryKey: ["feedbacks"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Create feedback from completed missions OR paid invoicing
  const createFeedbackMutation = useMutation({
    mutationFn: async () => {
      // 1) Demandes "prestation_terminee"
      const { data: demandes, error: dErr } = await supabase
        .from("demandes")
        .select("id, nom, telephone_direct, ville, type_service, candidat_nom, date_prestation")
        .eq("statut", "prestation_terminee");
      if (dErr) throw dErr;

      // 2) Facturation avec statut_paiement "paye" (Listing Clients - statut Payé)
      const { data: facturations, error: fErr } = await supabase
        .from("facturation")
        .select("demande_id, nom_client, ville, type_service, profil_nom, date_intervention, demandes:demande_id(telephone_direct)")
        .eq("statut_paiement", "paye");
      if (fErr) throw fErr;

      const { data: existingFeedbacks } = await supabase
        .from("feedbacks")
        .select("demande_id");
      const existingIds = new Set((existingFeedbacks || []).map((f: any) => f.demande_id));

      const fromDemandes = (demandes || [])
        .filter((d) => !existingIds.has(d.id))
        .map((d) => ({
          demande_id: d.id,
          nom_client: d.nom,
          telephone_client: d.telephone_direct,
          ville: d.ville,
          type_service: d.type_service,
          profil_nom: d.candidat_nom,
          date_prestation: d.date_prestation,
        }));

      const seen = new Set([...existingIds, ...fromDemandes.map((f) => f.demande_id)]);
      const fromFacturation = (facturations || [])
        .filter((f: any) => f.demande_id && !seen.has(f.demande_id))
        .map((f: any) => {
          seen.add(f.demande_id);
          return {
            demande_id: f.demande_id,
            nom_client: f.nom_client,
            telephone_client: f.demandes?.telephone_direct ?? null,
            ville: f.ville,
            type_service: f.type_service,
            profil_nom: f.profil_nom,
            date_prestation: f.date_intervention,
          };
        });

      const newFeedbacks = [...fromDemandes, ...fromFacturation];
      if (newFeedbacks.length === 0) return 0;
      const { error } = await supabase.from("feedbacks").insert(newFeedbacks);
      if (error) throw error;
      return newFeedbacks.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["feedbacks"] });
      if (count > 0) toast({ title: `${count} feedback(s) créé(s)` });
      else toast({ title: "Aucune nouvelle prestation à traiter" });
    },
  });

  const sendLinkMutation = useMutation({
    mutationFn: async (feedback: Feedback) => {
      const { error } = await supabase
        .from("feedbacks")
        .update({ statut: "lien_envoye", lien_envoye_at: new Date().toISOString() })
        .eq("id", feedback.id);
      if (error) throw error;
      return feedback;
    },
    onSuccess: (feedback) => {
      queryClient.invalidateQueries({ queryKey: ["feedbacks"] });
      const link = `${window.location.origin}/feedback/${feedback.token}`;
      const msg = `Bonjour,\nMerci d'avoir fait appel à notre service de ménage.\nVotre avis est très important pour nous.\nMerci de répondre à ce court questionnaire :\n${link}`;
      if (feedback.telephone_client) {
        const phone = feedback.telephone_client.replace(/\s/g, "");
        window.open(`https://wa.me/${phone.startsWith("+") ? phone.slice(1) : "212" + phone}?text=${encodeURIComponent(msg)}`, "_blank");
      }
      navigator.clipboard.writeText(link);
      toast({ title: "Lien copié et WhatsApp ouvert", description: link });
    },
  });

  // Stats
  const total = feedbacks.length;
  const positifs = feedbacks.filter((f) => f.statut === "positif").length;
  const negatifs = feedbacks.filter((f) => f.statut === "negatif").length;
  const enAttente = feedbacks.filter((f) => f.statut === "en_attente" || f.statut === "lien_envoye").length;

  const pieData = [
    { name: "Positif", value: positifs, color: "#22c55e" },
    { name: "Négatif", value: negatifs, color: "#ef4444" },
    { name: "En attente", value: enAttente, color: "#eab308" },
  ].filter((d) => d.value > 0);

  // Bar chart: feedback par profil
  const profilStats = feedbacks.reduce((acc, f) => {
    if (!f.profil_nom) return acc;
    if (!acc[f.profil_nom]) acc[f.profil_nom] = { nom: f.profil_nom, total: 0, positifs: 0 };
    acc[f.profil_nom].total++;
    if (f.statut === "positif") acc[f.profil_nom].positifs++;
    return acc;
  }, {} as Record<string, { nom: string; total: number; positifs: number }>);
  const barData = Object.values(profilStats).slice(0, 10);

  // Alerts: profils with 3+ negative feedbacks
  const profilAlerts = feedbacks.reduce((acc, f) => {
    if (f.statut === "negatif" && f.profil_nom) {
      acc[f.profil_nom] = (acc[f.profil_nom] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  const alertProfils = Object.entries(profilAlerts).filter(([, count]) => count >= 3);

  // Filter
  const villes = [...new Set(feedbacks.map((f) => f.ville).filter(Boolean))];
  const filtered = feedbacks.filter((f) => {
    if (statutFilter !== "tous" && f.statut !== statutFilter) return false;
    if (villeFilter !== "toutes" && f.ville !== villeFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        f.nom_client?.toLowerCase().includes(s) ||
        f.telephone_client?.includes(s) ||
        f.profil_nom?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Qualité & Feedback</h1>
        <Button onClick={() => createFeedbackMutation.mutate()} variant="outline" size="sm" className="w-full sm:w-auto">
          <ClipboardCheck className="mr-2 h-4 w-4" /> Générer les feedbacks
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card className="bg-gradient-to-br from-[#e8920a] to-[#fcc35c] border-0">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/20"><BarChart3 className="h-5 w-5 text-white" /></div>
              <div>
                <p className="text-xs text-white/80">Prestations effectuées</p>
                <p className="text-2xl font-bold text-white">{total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-[#3da8b3] to-[#7dd4dc] border-0">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/20"><ThumbsUp className="h-5 w-5 text-white" /></div>
              <div>
                <p className="text-xs text-white/80">Feedback positif</p>
                <p className="text-2xl font-bold text-white">{positifs}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-[#037a82] to-[#1ab5bf] border-0">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/20"><ThumbsDown className="h-5 w-5 text-white" /></div>
              <div>
                <p className="text-xs text-white/80">Feedback négatif</p>
                <p className="text-2xl font-bold text-white">{negatifs}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-[#b8a20e] to-[#e8d84a] border-0">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/20"><Clock className="h-5 w-5 text-white" /></div>
              <div>
                <p className="text-xs text-white/80">En attente</p>
                <p className="text-2xl font-bold text-white">{enAttente}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {total > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Répartition des retours</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <RechartsPie>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Legend />
                </RechartsPie>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Prestations par profil</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={barData}>
                  <XAxis dataKey="nom" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" fill="#94a3b8" name="Total" />
                  <Bar dataKey="positifs" fill="#22c55e" name="Positifs" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Alerts */}
      {alertProfils.length > 0 && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="pt-4">
            <p className="font-semibold text-red-700 mb-2">⚠️ Profils à surveiller (3+ feedbacks négatifs)</p>
            <div className="flex flex-wrap gap-2">
              {alertProfils.map(([nom, count]) => (
                <Badge key={nom} variant="destructive">{nom} — {count} négatifs</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:max-w-xs" />
            <Select value={statutFilter} onValueChange={setStatutFilter}>
              <SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tous">Tous les statuts</SelectItem>
                <SelectItem value="en_attente">En attente</SelectItem>
                <SelectItem value="lien_envoye">Lien envoyé</SelectItem>
                <SelectItem value="positif">Positif</SelectItem>
                <SelectItem value="negatif">Négatif</SelectItem>
              </SelectContent>
            </Select>
            <Select value={villeFilter} onValueChange={setVilleFilter}>
              <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="toutes">Toutes les villes</SelectItem>
                {villes.map((v) => <SelectItem key={v} value={v!}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Mobile cards */}
      <div className="block md:hidden space-y-3">
        {isLoading ? (
          <p className="text-center py-8 text-muted-foreground">Chargement...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">Aucun feedback</p>
        ) : filtered.map((f) => {
          const st = STATUT_FEEDBACK[f.statut as keyof typeof STATUT_FEEDBACK] || STATUT_FEEDBACK.en_attente;
          return (
            <Card key={f.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{f.nom_client}</span>
                  <Badge className={st.color + " text-xs"}>{st.label}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                  <span>📞 {f.telephone_client || "—"}</span>
                  <span>📍 {f.ville || "—"}</span>
                  <span>🧹 {f.type_service || "—"}</span>
                  <span>👤 {f.profil_nom || "—"}</span>
                  <span>📅 {f.date_prestation || "—"}</span>
                  {f.satisfaction && <Badge className="text-xs w-fit bg-green-100 text-green-800">{f.satisfaction}</Badge>}
                </div>
                {f.note_agence && (
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-3 w-3 ${i < f.note_agence! ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                    ))}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  {(f.statut === "en_attente" || f.statut === "lien_envoye") && (
                    <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => sendLinkMutation.mutate(f)}>
                      <Send className="h-3 w-3 mr-1" /> Envoyer
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setDetailFeedback(f)} title="Voir le feedback">
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Desktop Table */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Ville</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Profil</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Satisfaction</TableHead>
                <TableHead>Note agence</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8">Chargement...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8">Aucun feedback</TableCell></TableRow>
              ) : filtered.map((f) => {
                const st = STATUT_FEEDBACK[f.statut as keyof typeof STATUT_FEEDBACK] || STATUT_FEEDBACK.en_attente;
                return (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.nom_client}</TableCell>
                    <TableCell>{f.telephone_client || "—"}</TableCell>
                    <TableCell>{f.ville || "—"}</TableCell>
                    <TableCell>{f.type_service || "—"}</TableCell>
                    <TableCell>{f.profil_nom || "—"}</TableCell>
                    <TableCell>{f.date_prestation || "—"}</TableCell>
                    <TableCell>
                      {f.satisfaction ? (
                        <Badge className={f.satisfaction === "Très satisfait" || f.satisfaction === "Satisfait" ? "bg-green-100 text-green-800" : f.satisfaction === "Pas satisfait" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}>
                          {f.satisfaction}
                        </Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {f.note_agence ? (
                        <span className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-3.5 w-3.5 ${i < f.note_agence! ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                          ))}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell><Badge className={st.color}>{st.label}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {(f.statut === "en_attente" || f.statut === "lien_envoye") && (
                          <Button size="sm" variant="outline" onClick={() => sendLinkMutation.mutate(f)}>
                            <Send className="h-3.5 w-3.5 mr-1" /> Envoyer
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setDetailFeedback(f)} title="Voir le feedback">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail modal */}
      <Dialog open={!!detailFeedback} onOpenChange={() => setDetailFeedback(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Détail feedback — {detailFeedback?.nom_client}</DialogTitle>
          </DialogHeader>
          {detailFeedback && (
            detailFeedback.submitted_at ? (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Satisfaction :</span> <strong>{detailFeedback.satisfaction || "—"}</strong></div>
                  <div><span className="text-muted-foreground">Qualité ménage :</span> <strong>{detailFeedback.qualite_menage || "—"}</strong></div>
                  <div><span className="text-muted-foreground">Professionnel :</span> <strong>{detailFeedback.professionnel || "—"}</strong></div>
                  <div><span className="text-muted-foreground">Recommande profil :</span> <strong>{detailFeedback.recommande_profil ? "Oui" : "Non"}</strong></div>
                  <div><span className="text-muted-foreground">Recommande agence :</span> <strong>{detailFeedback.recommande_agence ? "Oui" : "Non"}</strong></div>
                  <div>
                    <span className="text-muted-foreground">Note agence :</span>{" "}
                    <span className="inline-flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3.5 w-3.5 ${i < (detailFeedback.note_agence || 0) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                      ))}
                    </span>
                  </div>
                </div>
                {detailFeedback.commentaire && (
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-muted-foreground text-xs mb-1">Commentaire</p>
                    <p>{detailFeedback.commentaire}</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Soumis le {new Date(detailFeedback.submitted_at).toLocaleDateString("fr-FR")}</p>
              </div>
            ) : (
              <div className="py-8 text-center space-y-2">
                <Clock className="h-10 w-10 mx-auto text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Le client n'a pas encore rempli le formulaire.</p>
                <p className="text-xs text-muted-foreground">Statut : {STATUT_FEEDBACK[detailFeedback.statut as keyof typeof STATUT_FEEDBACK]?.label || detailFeedback.statut}</p>
              </div>
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
