import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Send, Eye } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { generateDevisPDF, generateRecapPNG, devisDataFromDemande, isDevisType } from "@/lib/devis-generator";
import { toast } from "@/hooks/use-toast";

type Demande = Tables<"demandes">;

interface Props {
  demande: Demande | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDocumentGenerated?: (docType: string, docName: string) => void;
}

export function DevisPreviewModal({ demande, open, onOpenChange, onDocumentGenerated }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [docType, setDocType] = useState<"pdf" | "png">("pdf");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!demande || !open) return;
    const isDevis = isDevisType(demande.type_prestation);
    setDocType(isDevis ? "pdf" : "png");

    if (isDevis) {
      const pdf = generateDevisPDF(devisDataFromDemande(demande));
      const blob = pdf.output("blob");
      setPreviewUrl(URL.createObjectURL(blob));
    } else {
      const canvas = generateRecapPNG(devisDataFromDemande(demande));
      canvasRef.current = canvas;
      setPreviewUrl(canvas.toDataURL("image/png"));
    }

    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [demande, open]);

  if (!demande) return null;

  const isDevis = isDevisType(demande.type_prestation);
  const title = isDevis ? "Devis" : "Récapitulatif réservation";
  const fileName = isDevis
    ? `Devis_${demande.type_prestation.replace(/\s/g, "_")}_${demande.nom.replace(/\s/g, "_")}.pdf`
    : `Recap_${demande.num_demande}_${demande.nom.replace(/\s/g, "_")}.png`;

  const handleDownload = () => {
    if (docType === "pdf") {
      const pdf = generateDevisPDF(devisDataFromDemande(demande));
      pdf.save(fileName);
    } else if (canvasRef.current) {
      const link = document.createElement("a");
      link.download = fileName;
      link.href = canvasRef.current.toDataURL("image/png");
      link.click();
    }
    onDocumentGenerated?.(docType === "pdf" ? "Devis PDF" : "Récap PNG", fileName);
    toast({ title: "Document téléchargé", description: fileName });
  };

  const handleSendClient = () => {
    const whatsapp = demande.telephone_whatsapp || demande.telephone_direct;
    if (whatsapp) {
      toast({
        title: "Document envoyé",
        description: `Le ${title.toLowerCase()} sera envoyé au client via WhatsApp (${whatsapp})`,
      });
    } else {
      toast({
        title: "Pas de numéro WhatsApp",
        description: "Aucun numéro WhatsApp disponible pour ce client.",
        variant: "destructive",
      });
    }
    onDocumentGenerated?.(docType === "pdf" ? "Devis PDF" : "Récap PNG", fileName);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Aperçu — {title}
          </DialogTitle>
        </DialogHeader>

        {/* Preview */}
        <div className="border rounded-lg overflow-hidden bg-muted/30 min-h-[400px] flex items-center justify-center">
          {docType === "pdf" && previewUrl ? (
            <iframe src={previewUrl} className="w-full h-[500px]" title="Aperçu devis" />
          ) : previewUrl ? (
            <img src={previewUrl} alt="Récapitulatif" className="max-w-full max-h-[500px] object-contain" />
          ) : (
            <p className="text-muted-foreground">Génération en cours...</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
          <Button variant="secondary" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />Télécharger
          </Button>
          <Button onClick={handleSendClient}>
            <Send className="h-4 w-4 mr-2" />Envoyer au client
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
