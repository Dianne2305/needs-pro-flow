import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Edit, Upload } from "lucide-react";
import { Facturation, partAgence, partProfil, STATUT_MISSION_OPTIONS, STATUT_PAIEMENT_OPTIONS, MODE_PAIEMENT_OPTIONS } from "@/lib/finance-types";
import { format } from "date-fns";

export default function HistoriqueMissions() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState("all");
  const [editMission, setEditMission] = useState<Facturation | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: missions = [] } = useQuery({
    queryKey: ["facturation", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("facturation").select("*").order("num_mission", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Facturation[];
    },
  });

  const { data: demandes = [] } = useQuery({
    queryKey: ["demandes", "for_facturation"],
    queryFn: async () => {
      const { data } = await supabase.from("demandes").select("id, num_demande, nom, ville, type_prestation, montant_total, date_prestation, mode_paiement, candidat_nom, telephone_direct")
        .in("statut", ["prestation_effectuee", "paye", "facturation_annulee", "confirme"]);
      return data || [];
    },
  });

  const { data: profils = [] } = useQuery({
    queryKey: ["profils", "list_finance"],
    queryFn: async () => {
      const { data } = await supabase.from("profils").select("id, nom, prenom");
      return data || [];
    },
  });

  const filtered = missions.filter((m) => {
    if (filterStatut !== "all" && m.statut_mission !== filterStatut) return false;
    if (search) {
      const s = search.toLowerCase();
      return (m.nom_client?.toLowerCase().includes(s) || m.profil_nom?.toLowerCase().includes(s) || String(m.num_mission).includes(s));
    }
    return true;
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Facturation> & { id: string }) => {
      const { id, ...rest } = updates;
      const { error } = await supabase.from("facturation").update(rest as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["facturation"] });
      toast({ title: "Mission mise à jour" });
      setEditMission(null);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("facturation").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["facturation"] });
      toast({ title: "Mission créée" });
      setShowCreate(false);
    },
  });

  const getStatutBadge = (statut: string) => {
    const opt = STATUT_MISSION_OPTIONS.find((o) => o.value === statut);
    return <Badge className={opt?.color || ""}>{opt?.label || statut}</Badge>;
  };

  const getPaiementBadge = (statut: string) => {
    const opt = STATUT_PAIEMENT_OPTIONS.find((o) => o.value === statut);
    return <Badge className={opt?.color || ""}>{opt?.label || statut}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-3 items-center flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher client, profil, n° mission..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatut} onValueChange={setFilterStatut}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              {STATUT_MISSION_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-1" /> Nouvelle mission</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N°</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Ville</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Part agence</TableHead>
              <TableHead>Part profil</TableHead>
              <TableHead>Statut mission</TableHead>
              <TableHead>Paiement</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Aucune mission</TableCell></TableRow>
            ) : filtered.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono text-xs">M-{m.num_mission}</TableCell>
                <TableCell className="text-sm">{m.date_intervention ? format(new Date(m.date_intervention), "dd/MM/yyyy") : "—"}</TableCell>
                <TableCell className="font-medium">{m.nom_client}</TableCell>
                <TableCell>{m.ville}</TableCell>
                <TableCell className="text-sm">{m.type_service || "—"}</TableCell>
                <TableCell className="font-semibold">{m.montant_total?.toLocaleString("fr-MA")} DH</TableCell>
                <TableCell className="text-emerald-700">{partAgence(m).toLocaleString("fr-MA")} DH</TableCell>
                <TableCell className="text-sky-700">{partProfil(m).toLocaleString("fr-MA")} DH</TableCell>
                <TableCell>{getStatutBadge(m.statut_mission)}</TableCell>
                <TableCell>{getPaiementBadge(m.statut_paiement)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => setEditMission(m)}><Edit className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit Modal */}
      {editMission && (
        <MissionEditModal
          mission={editMission}
          onClose={() => setEditMission(null)}
          onSave={(updates) => updateMutation.mutate({ id: editMission.id, ...updates })}
        />
      )}

      {/* Create Modal */}
      {showCreate && (
        <MissionCreateModal
          demandes={demandes}
          profils={profils}
          onClose={() => setShowCreate(false)}
          onCreate={(data) => createMutation.mutate(data)}
        />
      )}
    </div>
  );
}

function MissionEditModal({ mission, onClose, onSave }: { mission: Facturation; onClose: () => void; onSave: (u: any) => void }) {
  const [form, setForm] = useState({
    statut_mission: mission.statut_mission,
    statut_paiement: mission.statut_paiement,
    montant_paye_client: mission.montant_paye_client || 0,
    mode_paiement_reel: mission.mode_paiement_reel || "",
    date_paiement_client: mission.date_paiement_client || "",
    encaisse_par: mission.encaisse_par || "agence",
    montant_encaisse_profil: mission.montant_encaisse_profil || 0,
    part_agence_reversee: mission.part_agence_reversee,
    date_remise_agence: mission.date_remise_agence || "",
    part_profil_versee: mission.part_profil_versee,
    date_versement_profil: mission.date_versement_profil || "",
    commission_pourcentage: mission.commission_pourcentage,
  });

  const pa = mission.montant_total * form.commission_pourcentage / 100;
  const pp = mission.montant_total * (100 - form.commission_pourcentage) / 100;
  const resteClient = mission.montant_total - form.montant_paye_client;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = `${mission.id}/${file.name}`;
    const { error } = await supabase.storage.from("justificatifs").upload(path, file, { upsert: true });
    if (!error) {
      const { data: urlData } = supabase.storage.from("justificatifs").getPublicUrl(path);
      onSave({ justificatif_url: urlData.publicUrl });
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mission M-{mission.num_mission} — {mission.nom_client}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* Infos */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted-foreground">Montant total :</span> <strong>{mission.montant_total} DH</strong></div>
            <div><span className="text-muted-foreground">Commission :</span> <strong>{form.commission_pourcentage}%</strong></div>
            <div><span className="text-muted-foreground">Part agence :</span> <strong className="text-emerald-700">{pa.toLocaleString("fr-MA")} DH</strong></div>
            <div><span className="text-muted-foreground">Part profil :</span> <strong className="text-sky-700">{pp.toLocaleString("fr-MA")} DH</strong></div>
          </div>

          {/* Statut mission */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Statut mission</Label>
              <Select value={form.statut_mission} onValueChange={(v) => setForm({ ...form, statut_mission: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUT_MISSION_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Commission %</Label>
              <Input type="number" value={form.commission_pourcentage} onChange={(e) => setForm({ ...form, commission_pourcentage: Number(e.target.value) })} />
            </div>
          </div>

          {/* Paiement client */}
          <div className="border-t pt-4">
            <h4 className="font-semibold mb-3">💳 Paiement client</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Montant payé</Label>
                <Input type="number" value={form.montant_paye_client} onChange={(e) => setForm({ ...form, montant_paye_client: Number(e.target.value) })} />
                {resteClient > 0 && <p className="text-xs text-amber-600">Reste : {resteClient.toLocaleString("fr-MA")} DH</p>}
              </div>
              <div className="space-y-1">
                <Label>Mode de paiement réel</Label>
                <Select value={form.mode_paiement_reel} onValueChange={(v) => setForm({ ...form, mode_paiement_reel: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {MODE_PAIEMENT_OPTIONS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Date de paiement</Label>
                <Input type="date" value={form.date_paiement_client} onChange={(e) => setForm({ ...form, date_paiement_client: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Statut paiement</Label>
                <Select value={form.statut_paiement} onValueChange={(v) => setForm({ ...form, statut_paiement: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUT_PAIEMENT_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-2">
                <Label>Justificatif</Label>
                <div className="flex gap-2 items-center">
                  <Input type="file" onChange={handleFileUpload} />
                  {mission.justificatif_url && (
                    <a href={mission.justificatif_url} target="_blank" rel="noopener" className="text-xs text-primary underline">Voir</a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Répartition */}
          <div className="border-t pt-4">
            <h4 className="font-semibold mb-3">🔁 Répartition interne</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Encaissé par</Label>
                <Select value={form.encaisse_par} onValueChange={(v) => setForm({ ...form, encaisse_par: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agence">Agence</SelectItem>
                    <SelectItem value="profil">Profil</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.encaisse_par === "profil" ? (
                <>
                  <div className="space-y-1">
                    <Label>Montant encaissé par le profil</Label>
                    <Input type="number" value={form.montant_encaisse_profil} onChange={(e) => setForm({ ...form, montant_encaisse_profil: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Part agence reversée ?</Label>
                    <Select value={form.part_agence_reversee ? "oui" : "non"} onValueChange={(v) => setForm({ ...form, part_agence_reversee: v === "oui" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="oui">Oui</SelectItem>
                        <SelectItem value="non">Non</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Date remise à l'agence</Label>
                    <Input type="date" value={form.date_remise_agence} onChange={(e) => setForm({ ...form, date_remise_agence: e.target.value })} />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <Label>Part profil versée ?</Label>
                    <Select value={form.part_profil_versee ? "oui" : "non"} onValueChange={(v) => setForm({ ...form, part_profil_versee: v === "oui" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="oui">Oui</SelectItem>
                        <SelectItem value="non">Non</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Date versement au profil</Label>
                    <Input type="date" value={form.date_versement_profil} onChange={(e) => setForm({ ...form, date_versement_profil: e.target.value })} />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Annuler</Button>
            <Button onClick={() => onSave(form)}>Enregistrer</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MissionCreateModal({ demandes, profils, onClose, onCreate }: { demandes: any[]; profils: any[]; onClose: () => void; onCreate: (d: any) => void }) {
  const [demandeId, setDemandeId] = useState("");
  const [profilId, setProfilId] = useState("");
  const [commission, setCommission] = useState(50);
  const [modePaiement, setModePaiement] = useState("");
  const [statutMission, setStatutMission] = useState("confirmee");

  const selectedDemande = demandes.find((d) => d.id === demandeId);
  const selectedProfil = profils.find((p) => p.id === profilId);

  const handleCreate = () => {
    if (!selectedDemande) return;
    onCreate({
      demande_id: demandeId,
      profil_id: profilId || null,
      profil_nom: selectedProfil ? `${selectedProfil.prenom} ${selectedProfil.nom}` : null,
      nom_client: selectedDemande.nom,
      ville: selectedDemande.ville || "Casablanca",
      type_service: selectedDemande.type_prestation,
      date_intervention: selectedDemande.date_prestation,
      montant_total: selectedDemande.montant_total || 0,
      commission_pourcentage: commission,
      mode_paiement_prevu: modePaiement,
      statut_mission: statutMission,
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nouvelle mission</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Demande source</Label>
            <Select value={demandeId} onValueChange={setDemandeId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner une demande" /></SelectTrigger>
              <SelectContent>
                {demandes.map((d) => (
                  <SelectItem key={d.id} value={d.id}>#{d.num_demande} — {d.nom} — {d.type_prestation}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedDemande && (
            <div className="text-sm bg-muted p-3 rounded space-y-1">
              <p><strong>Client :</strong> {selectedDemande.nom}</p>
              <p><strong>Montant :</strong> {selectedDemande.montant_total || 0} DH</p>
              <p><strong>Date :</strong> {selectedDemande.date_prestation || "—"}</p>
            </div>
          )}
          <div className="space-y-1">
            <Label>Profil assigné</Label>
            <Select value={profilId} onValueChange={setProfilId}>
              <SelectTrigger><SelectValue placeholder="Optionnel" /></SelectTrigger>
              <SelectContent>
                {profils.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.prenom} {p.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Commission %</Label>
              <Input type="number" value={commission} onChange={(e) => setCommission(Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Mode paiement prévu</Label>
              <Select value={modePaiement} onValueChange={setModePaiement}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {MODE_PAIEMENT_OPTIONS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Statut mission</Label>
            <Select value={statutMission} onValueChange={setStatutMission}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUT_MISSION_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Annuler</Button>
            <Button onClick={handleCreate} disabled={!demandeId}>Créer</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
