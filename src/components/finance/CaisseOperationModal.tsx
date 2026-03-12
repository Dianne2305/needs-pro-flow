import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Upload, X, FileText, Search, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { OperationCaisse } from "./CaissePage";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operation: OperationCaisse | null;
  defaultType: "entree" | "sortie";
}

export default function CaisseOperationModal({ open, onOpenChange, operation, defaultType }: Props) {
  const queryClient = useQueryClient();
  const isEdit = !!operation;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [typeOp, setTypeOp] = useState<"entree" | "sortie">(defaultType);
  const [dateOp, setDateOp] = useState(new Date().toISOString().slice(0, 10));
  const [montant, setMontant] = useState("");
  const [modePaiement, setModePaiement] = useState("especes");
  const [libelle, setLibelle] = useState("");
  const [clientNom, setClientNom] = useState("");
  const [utilisateur, setUtilisateur] = useState("");
  const [notes, setNotes] = useState("");
  const [justificatifUrl, setJustificatifUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showClientDemandes, setShowClientDemandes] = useState(false);

  // Auto-fill utilisateur from logged-in user
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", user.id)
          .single();
        setUtilisateur(profile?.display_name || user.email || "");
      }
    };
    if (open && !operation) {
      fetchUser();
    }
  }, [open, operation]);

  // Fetch demandes linked to the client
  const { data: clientDemandes = [] } = useQuery({
    queryKey: ["demandes_client", clientNom],
    queryFn: async () => {
      if (!clientNom.trim()) return [];
      const { data, error } = await supabase
        .from("demandes")
        .select("id, num_demande, nom, type_service, ville, statut, montant_total, date_prestation, created_at")
        .ilike("nom", `%${clientNom.trim()}%`)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientNom.trim() && showClientDemandes,
  });

  useEffect(() => {
    if (operation) {
      setTypeOp(operation.type_operation);
      setDateOp(operation.date_operation);
      setMontant(String(operation.montant));
      setModePaiement(operation.mode_paiement);
      setLibelle(operation.libelle);
      setClientNom(operation.client_nom || "");
      setUtilisateur(operation.utilisateur || "");
      setNotes(operation.notes || "");
      setJustificatifUrl(operation.justificatif_url || "");
      setSelectedFile(null);
      setShowClientDemandes(false);
    } else {
      setTypeOp(defaultType);
      setDateOp(new Date().toISOString().slice(0, 10));
      setMontant("");
      setModePaiement("especes");
      setLibelle("");
      setClientNom("");
      setUtilisateur("");
      setNotes("");
      setJustificatifUrl("");
      setSelectedFile(null);
      setShowClientDemandes(false);
    }
  }, [operation, defaultType, open]);

  const uploadFile = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop();
    const fileName = `caisse/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("justificatifs").upload(fileName, file);
    if (error) throw error;
    const { data } = supabase.storage.from("justificatifs").getPublicUrl(fileName);
    return data.publicUrl;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!libelle || !montant) throw new Error("Champs obligatoires manquants");

      let finalJustificatifUrl = justificatifUrl;
      if (selectedFile) {
        setUploading(true);
        finalJustificatifUrl = await uploadFile(selectedFile);
        setUploading(false);
      }

      const payload = {
        type_operation: typeOp,
        date_operation: dateOp,
        montant: Number(montant),
        mode_paiement: modePaiement,
        libelle,
        client_nom: clientNom || null,
        projet_service: null,
        utilisateur: utilisateur || null,
        notes: notes || null,
        justificatif_url: finalJustificatifUrl || null,
      };

      if (isEdit) {
        const { error } = await supabase.from("operations_caisse").update(payload).eq("id", operation!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("operations_caisse").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operations_caisse"] });
      toast.success(isEdit ? "Opération modifiée" : "Opération ajoutée");
      onOpenChange(false);
    },
    onError: (err: any) => {
      setUploading(false);
      toast.error(err.message);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setJustificatifUrl("");
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setJustificatifUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const STATUT_COLORS: Record<string, string> = {
    en_attente: "bg-amber-100 text-amber-800",
    confirmee: "bg-emerald-100 text-emerald-800",
    terminee: "bg-sky-100 text-sky-800",
    annulee: "bg-red-100 text-red-800",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier l'opération" : "Ajouter un mouvement"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Type d'opération</Label>
              <Select value={typeOp} onValueChange={(v) => setTypeOp(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entree">Entrée</SelectItem>
                  <SelectItem value="sortie">Sortie</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={dateOp} onChange={(e) => setDateOp(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Montant (MAD) *</Label>
              <Input type="number" min="0" step="0.01" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Mode de paiement</Label>
              <Select value={modePaiement} onValueChange={setModePaiement}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="especes">Espèces</SelectItem>
                  <SelectItem value="virement">Virement</SelectItem>
                  <SelectItem value="cheque">Chèque</SelectItem>
                  <SelectItem value="paiement_agence">Paiement agence</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Libellé / Motif *</Label>
            <Textarea
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              rows={3}
              placeholder="Décrivez le motif de l'opération..."
            />
          </div>

          {/* Client associé with demandes lookup */}
          <div>
            <Label>Client associé (optionnel)</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={clientNom}
                onChange={(e) => {
                  setClientNom(e.target.value);
                  setShowClientDemandes(false);
                }}
                placeholder="Nom du client"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={!clientNom.trim()}
                onClick={() => setShowClientDemandes(!showClientDemandes)}
                title="Voir les demandes liées"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>

            {showClientDemandes && (
              <div className="mt-2 rounded-md border bg-muted/30 max-h-48 overflow-y-auto">
                {clientDemandes.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3 text-center">Aucune demande trouvée pour ce client</p>
                ) : (
                  <div className="divide-y">
                    {clientDemandes.map((d: any) => (
                      <div key={d.id} className="px-3 py-2 text-sm flex items-center justify-between gap-2 hover:bg-muted/50">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-primary">#{d.num_demande}</span>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUT_COLORS[d.statut] || ""}`}>
                              {d.statut}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {d.type_service} — {d.ville}
                            {d.montant_total ? ` — ${Number(d.montant_total).toLocaleString("fr-MA")} DH` : ""}
                          </p>
                          {d.date_prestation && (
                            <p className="text-xs text-muted-foreground">
                              Prestation: {format(new Date(d.date_prestation), "dd/MM/yyyy")}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <Label>Utilisateur</Label>
            <Input value={utilisateur} onChange={(e) => setUtilisateur(e.target.value)} placeholder="Qui enregistre l'opération ?" />
          </div>

          {/* File upload */}
          <div>
            <Label>Document justificatif (optionnel)</Label>
            {selectedFile ? (
              <div className="mt-1 flex items-center gap-2 rounded-md border p-2 bg-muted/30">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={removeFile}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : justificatifUrl ? (
              <div className="mt-1 flex items-center gap-2 rounded-md border p-2 bg-muted/30">
                <FileText className="h-4 w-4 text-primary" />
                <a href={justificatifUrl} target="_blank" rel="noopener noreferrer" className="text-sm flex-1 truncate text-primary underline">
                  Voir le document
                </a>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={removeFile}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div
                className="mt-1 flex items-center justify-center gap-2 rounded-md border border-dashed p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Cliquer pour télécharger (facture, reçu...)</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleFileChange}
            />
          </div>

          <div>
            <Label>Notes (optionnel)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Remarques..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || uploading}>
            {uploading ? "Upload..." : mutation.isPending ? "Enregistrement..." : isEdit ? "Modifier" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
