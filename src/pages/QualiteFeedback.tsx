/**
 * QualiteFeedback.tsx
 * Page Qualité & Feedback : KPI cards, charts (répartition notes + satisfaction), table filtrable.
 */
import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import {
  ClipboardCheck, ThumbsUp, ThumbsDown, Star, Eye, Share2, BarChart3, Trash2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EditFeedbackModal } from "@/components/feedback/EditFeedbackModal";
import {
  PieChart as RechartsPie, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";

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
  note_profil: number | null;
  commentaire: string | null;
  statut: string;
  lien_envoye_at: string | null;
  submitted_at: string | null;
  created_at: string;
};

const StarRating = ({ value, max = 5 }: { value: number; max?: number }) => (
  <span className="inline-flex items-center gap-0.5">
    {Array.from({ length: max }).map((_, i) => (
      <Star key={i} className={`h-3.5 w-3.5 ${i < value ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
    ))}
  </span>
);

export default function QualiteFeedback() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [noteAgenceFilter, setNoteAgenceFilter] = useState("toutes");
  const [noteProfilFilter, setNoteProfilFilter] = useState("toutes");
  const [villeFilter, setVilleFilter] = useState("toutes");
  const [detailFeedback, setDetailFeedback] = useState<Feedback | null>(null);
  const [editFeedback, setEditFeedback] = useState<Feedback | null>(null);

  // Fetch feedbacks
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

  // Fetch demandes for segment info
  const { data: demandes = [] } = useQuery({
    queryKey: ["demandes-segments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandes")
        .select("id, type_prestation, quartier, nom");
      if (error) throw error;
      return data;
    },
  });

  // Map demande_id -> segment/quartier
  const demandeMap = useMemo(() => {
    const map: Record<string, { segment: string; quartier: string | null; nom: string }> = {};
    demandes.forEach((d) => {
      map[d.id] = {
        segment: d.type_prestation === "entreprise" ? "Entreprise" : "Particulier",
        quartier: d.quartier,
        nom: d.nom,
      };
    });
    return map;
  }, [demandes]);

  // Count prestations effectuées
  const { data: prestationCount = 0 } = useQuery({
    queryKey: ["prestations-effectuees-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("demandes")
        .select("id", { count: "exact", head: true })
        .eq("statut", "prestation_terminee");
      if (error) throw error;
      return count || 0;
    },
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("feedbacks-auto")
      .on("postgres_changes", { event: "*", schema: "public", table: "feedbacks" }, () =>
        queryClient.invalidateQueries({ queryKey: ["feedbacks"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Auto-send WhatsApp on new feedbacks
  const autoSentRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!feedbacks.length) return;
    if (!initializedRef.current) {
      feedbacks.forEach((f) => autoSentRef.current.add(f.id));
      initializedRef.current = true;
      return;
    }
    feedbacks.forEach((f) => {
      if (autoSentRef.current.has(f.id)) return;
      autoSentRef.current.add(f.id);
      if (f.statut !== "en_attente" || !f.telephone_client) return;
      const link = `https://feedback-love-note.lovable.app/feedback/${f.token}`;
      const msg = `Bonjour,\nMerci d'avoir fait appel à notre service de ménage.\nVotre avis est très important pour nous.\nMerci de répondre à ce court questionnaire :\n${link}`;
      const phone = f.telephone_client.replace(/\s/g, "");
      const waPhone = phone.startsWith("+") ? phone.slice(1) : "212" + phone;
      window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`, "_blank");
      supabase.from("feedbacks").update({ statut: "lien_envoye", lien_envoye_at: new Date().toISOString() }).eq("id", f.id).then(() => {
        queryClient.invalidateQueries({ queryKey: ["feedbacks"] });
      });
      toast({ title: "Lien WhatsApp envoyé automatiquement", description: f.nom_client });
    });
  }, [feedbacks, queryClient]);

  // Generate feedbacks mutation
  const createFeedbackMutation = useMutation({
    mutationFn: async () => {
      const { data: demandesTerminees, error: dErr } = await supabase
        .from("demandes")
        .select("id, nom, telephone_direct, ville, type_service, candidat_nom, date_prestation")
        .eq("statut", "prestation_terminee");
      if (dErr) throw dErr;
      const { data: facturations, error: fErr } = await supabase
        .from("facturation")
        .select("demande_id, nom_client, ville, type_service, profil_nom, date_intervention, demandes:demande_id(telephone_direct)")
        .eq("statut_paiement", "paye");
      if (fErr) throw fErr;
      const { data: existingFeedbacks } = await supabase.from("feedbacks").select("demande_id");
      const existingIds = new Set((existingFeedbacks || []).map((f: any) => f.demande_id));
      const fromDemandes = (demandesTerminees || []).filter((d) => !existingIds.has(d.id)).map((d) => ({
        demande_id: d.id, nom_client: d.nom, telephone_client: d.telephone_direct,
        ville: d.ville, type_service: d.type_service, profil_nom: d.candidat_nom, date_prestation: d.date_prestation,
      }));
      const seen = new Set([...existingIds, ...fromDemandes.map((f) => f.demande_id)]);
      const fromFacturation = (facturations || []).filter((f: any) => f.demande_id && !seen.has(f.demande_id)).map((f: any) => {
        seen.add(f.demande_id);
        return {
          demande_id: f.demande_id, nom_client: f.nom_client,
          telephone_client: f.demandes?.telephone_direct ?? null,
          ville: f.ville, type_service: f.type_service, profil_nom: f.profil_nom, date_prestation: f.date_intervention,
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
      toast({ title: count > 0 ? `${count} feedback(s) créé(s)` : "Aucune nouvelle prestation à traiter" });
    },
  });

  // Share feedback
  const handleShare = (f: Feedback) => {
    const text = `Avis client - ${f.nom_client}: ${f.satisfaction || "Non renseigné"}. Note agence: ${f.note_agence || "—"}/5`;
    if (navigator.share) {
      navigator.share({ title: "Feedback client", text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      toast({ title: "Texte copié dans le presse-papiers" });
    }
  };

  // Delete feedback
  const deleteFeedbackMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("feedbacks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedbacks"] });
      toast({ title: "Feedback supprimé" });
    },
    onError: () => toast({ title: "Erreur lors de la suppression", variant: "destructive" }),
  });


  const submittedFeedbacks = feedbacks.filter((f) => f.submitted_at);
  const positifs = feedbacks.filter((f) => f.statut === "positif").length;
  const negatifs = feedbacks.filter((f) => f.statut === "negatif").length;

  // Chart 1: Répartition des notes agence et profil
  const noteAgenceDistrib = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    submittedFeedbacks.forEach((f) => { if (f.note_agence && counts[f.note_agence] !== undefined) counts[f.note_agence]++; });
    return Object.entries(counts).map(([note, count]) => ({ note: `${note}★`, agence: count }));
  }, [submittedFeedbacks]);

  const noteProfilDistrib = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    submittedFeedbacks.forEach((f) => { if (f.note_profil && counts[f.note_profil] !== undefined) counts[f.note_profil]++; });
    return Object.entries(counts).map(([note, count]) => ({ note: `${note}★`, profil: count }));
  }, [submittedFeedbacks]);

  const barChartData = useMemo(() => {
    return ["1★", "2★", "3★", "4★", "5★"].map((note, i) => ({
      note,
      agence: noteAgenceDistrib[i]?.agence || 0,
      profil: noteProfilDistrib[i]?.profil || 0,
    }));
  }, [noteAgenceDistrib, noteProfilDistrib]);

  // Chart 2: Satisfaction client
  const satisfactionData = useMemo(() => {
    const counts: Record<string, number> = {};
    submittedFeedbacks.forEach((f) => {
      if (f.satisfaction) counts[f.satisfaction] = (counts[f.satisfaction] || 0) + 1;
    });
    const colors: Record<string, string> = {
      "Très satisfait": "#22c55e",
      "Satisfait": "#3b82f6",
      "Moyen": "#eab308",
      "Pas satisfait": "#ef4444",
    };
    return Object.entries(counts).map(([name, value]) => ({ name, value, color: colors[name] || "#94a3b8" }));
  }, [submittedFeedbacks]);

  // Filters
  const villes = useMemo(() => [...new Set(feedbacks.map((f) => f.ville).filter(Boolean))], [feedbacks]);

  const filtered = useMemo(() => feedbacks.filter((f) => {
    if (noteAgenceFilter !== "toutes" && f.note_agence !== Number(noteAgenceFilter)) return false;
    if (noteProfilFilter !== "toutes" && f.note_profil !== Number(noteProfilFilter)) return false;
    if (villeFilter !== "toutes" && f.ville !== villeFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return f.nom_client?.toLowerCase().includes(s) || f.profil_nom?.toLowerCase().includes(s) || f.telephone_client?.includes(s);
    }
    return true;
  }), [feedbacks, noteAgenceFilter, noteProfilFilter, villeFilter, search]);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Qualité & Feedback</h1>
        <Button onClick={() => createFeedbackMutation.mutate()} variant="outline" size="sm" className="w-full sm:w-auto">
          <ClipboardCheck className="mr-2 h-4 w-4" /> Générer les feedbacks
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
        <Card className="bg-gradient-to-br from-[#e8920a] to-[#fcc35c] border-0">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/20"><BarChart3 className="h-5 w-5 text-white" /></div>
              <div>
                <p className="text-xs text-white/80">Prestations effectuées</p>
                <p className="text-2xl font-bold text-white">{prestationCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-[#3da8b3] to-[#7dd4dc] border-0">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/20"><ThumbsUp className="h-5 w-5 text-white" /></div>
              <div>
                <p className="text-xs font-semibold text-white/90">Feedback</p>
                <div className="flex items-center gap-4 mt-1">
                  <div className="flex items-center gap-1.5">
                    <ThumbsUp className="h-4 w-4 text-white" />
                    <span className="text-xl font-bold text-white">{positifs}</span>
                    <span className="text-xs text-white/70">positifs</span>
                  </div>
                  <div className="w-px h-6 bg-white/30" />
                  <div className="flex items-center gap-1.5">
                    <ThumbsDown className="h-4 w-4 text-white" />
                    <span className="text-xl font-bold text-white">{negatifs}</span>
                    <span className="text-xs text-white/70">négatifs</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {submittedFeedbacks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Répartition des notes (Agence & Profil)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={barChartData}>
                  <XAxis dataKey="note" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="agence" fill="#3b82f6" name="Note Agence" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profil" fill="#22c55e" name="Note Profil" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Niveau de satisfaction client</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <RechartsPie>
                  <Pie data={satisfactionData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {satisfactionData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </RechartsPie>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            <Input placeholder="Rechercher client ou profil..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:max-w-xs" />
            <Select value={noteAgenceFilter} onValueChange={setNoteAgenceFilter}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Note agence" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="toutes">Toutes notes agence</SelectItem>
                {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n} étoile{n > 1 ? "s" : ""}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={noteProfilFilter} onValueChange={setNoteProfilFilter}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Note profil" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="toutes">Toutes notes profil</SelectItem>
                {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n} étoile{n > 1 ? "s" : ""}</SelectItem>)}
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
          const info = demandeMap[f.demande_id];
          return (
            <Card key={f.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm cursor-pointer text-primary hover:underline"
                    onClick={() => navigate(`/compte-client?search=${encodeURIComponent(f.nom_client)}`)}>{f.nom_client}</span>
                  <Badge className={info?.segment === "Entreprise" ? "bg-lime-100 text-lime-800" : "bg-teal-100 text-teal-800"}>
                    {info?.segment || "—"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                  <span>📅 {f.date_prestation || "—"}</span>
                  <span>📍 {f.ville}{info?.quartier ? `, ${info.quartier}` : ""}</span>
                  <span>🧹 {f.type_service || "—"}</span>
                  <span className="cursor-pointer text-primary hover:underline"
                    onClick={() => f.profil_nom && navigate(`/compte-profil?search=${encodeURIComponent(f.profil_nom)}`)}>
                    👤 {f.profil_nom || "—"}
                  </span>
                </div>
                {f.note_agence && <div className="text-xs">Agence: <StarRating value={f.note_agence} /></div>}
                {f.note_profil && <div className="text-xs">Profil: <StarRating value={f.note_profil} /></div>}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="ghost" onClick={() => handleShare(f)} title="Partager"><Share2 className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setDetailFeedback(f)} title="Voir"><Eye className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteFeedbackMutation.mutate(f.id)} title="Supprimer" className="text-red-500 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></Button>
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
                <TableHead>Date prestation</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Ville / Quartier</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead>Profil</TableHead>
                <TableHead>Satisfaction</TableHead>
                <TableHead>Note agence</TableHead>
                <TableHead>Note profil</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8">Chargement...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8">Aucun feedback</TableCell></TableRow>
              ) : filtered.map((f) => {
                const info = demandeMap[f.demande_id];
                return (
                  <TableRow key={f.id}>
                    <TableCell className="text-xs">{f.date_prestation || "—"}</TableCell>
                    <TableCell>
                      <span className="font-medium cursor-pointer text-primary hover:underline text-xs"
                        onClick={() => navigate(`/compte-client?search=${encodeURIComponent(f.nom_client)}`)}>
                        {f.nom_client}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">{f.ville || "—"}{info?.quartier ? `, ${info.quartier}` : ""}</TableCell>
                    <TableCell className="text-xs">{f.type_service || "—"}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${info?.segment === "Entreprise" ? "bg-lime-100 text-lime-800" : "bg-teal-100 text-teal-800"}`}>
                        {info?.segment || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {f.profil_nom ? (
                        <span className="cursor-pointer text-primary hover:underline text-xs"
                          onClick={() => navigate(`/compte-profil?search=${encodeURIComponent(f.profil_nom!)}`)}>
                          {f.profil_nom}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px]">
                      {f.satisfaction ? (
                        <div>
                          <Badge className={`text-xs ${
                            f.satisfaction === "Très satisfait" || f.satisfaction === "Satisfait"
                              ? "bg-green-100 text-green-800"
                              : f.satisfaction === "Pas satisfait"
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}>{f.satisfaction}</Badge>
                          {f.commentaire && <p className="text-xs text-muted-foreground mt-1 truncate" title={f.commentaire}>{f.commentaire}</p>}
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell>{f.note_agence ? <StarRating value={f.note_agence} /> : "—"}</TableCell>
                    <TableCell>{f.note_profil ? <StarRating value={f.note_profil} /> : "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleShare(f)} title="Partager">
                          <Share2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDetailFeedback(f)} title="Voir le feedback">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteFeedbackMutation.mutate(f.id)} title="Supprimer" className="text-red-500 hover:text-red-700">
                          <Trash2 className="h-3.5 w-3.5" />
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
                    <StarRating value={detailFeedback.note_agence || 0} />
                  </div>
                  <div>
                    <span className="text-muted-foreground">Note profil :</span>{" "}
                    <StarRating value={detailFeedback.note_profil || 0} />
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
                <p className="text-sm text-muted-foreground">Le client n'a pas encore rempli le formulaire.</p>
              </div>
            )
          )}
        </DialogContent>
      </Dialog>
      <EditFeedbackModal feedback={editFeedback} onClose={() => setEditFeedback(null)} />
    </div>
  );
}
