/**
 * DocumentHistory.tsx
 * Historique des documents (devis/récap) générés pour une demande.
 */
import { Button } from "@/components/ui/button";
import { Eye, Download, FileText, Image } from "lucide-react";

interface Document {
  type: string;
  name: string;
  date: string;
}

interface Props {
  documents: Document[];
  onView: (doc: Document) => void;
  onDownload: (doc: Document) => void;
}

export function DocumentHistory({ documents, onView, onDownload }: Props) {
  if (documents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Aucun document généré pour cette demande.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((doc, i) => (
        <div key={i} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2 text-sm">
          <div className="flex items-center gap-2">
            {doc.type.includes("PDF") ? (
              <FileText className="h-4 w-4 text-destructive" />
            ) : (
              <Image className="h-4 w-4 text-primary" />
            )}
            <div>
              <p className="font-medium">{doc.name}</p>
              <p className="text-xs text-muted-foreground">{doc.type} — {doc.date}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onView(doc)}>
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDownload(doc)}>
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
