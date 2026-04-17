/**
 * devis-generator.ts
 * Générateur de documents : récap PNG (prix fixe) et devis PDF (sur mesure) via jsPDF/html2canvas.
 */
import jsPDF from "jspdf";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface DevisData {
  numDemande: number;
  nom: string;
  telephone?: string;
  adresse?: string;
  quartier?: string;
  ville: string;
  typePrestation: string;
  typeService: string;
  typeBien?: string;
  superficie?: number;
  dureeHeures?: number;
  nombreIntervenants?: number;
  frequence: string;
  montantTotal?: number;
  avecProduit?: boolean;
  datePrestation?: string;
  heurePrestation?: string;
  notesClient?: string;
  nomEntreprise?: string;
  contactEntreprise?: string;
  email?: string;
}

const AGENCE_INFO = {
  name: "Agence Ménage",
  address: "Casablanca, Maroc",
  phone: "+212 5XX-XXXXXX",
  email: "contact@agencemenage.ma",
  website: "www.agencemenage.ma",
  ice: "00XXXXXXXXXX",
};

export function generateDevisPDF(data: DevisData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  // Header
  doc.setFillColor(0, 128, 128);
  doc.rect(0, 0, pageWidth, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(AGENCE_INFO.name, margin, 18);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(AGENCE_INFO.address, margin, 26);
  doc.text(`Tél: ${AGENCE_INFO.phone} | ${AGENCE_INFO.email}`, margin, 32);

  // Devis title
  y = 55;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("DEVIS", pageWidth / 2, y, { align: "center" });
  
  y += 10;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`N° ${data.numDemande} — Date: ${format(new Date(), "dd MMMM yyyy", { locale: fr })}`, pageWidth / 2, y, { align: "center" });

  // Client info box
  y += 15;
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, y, contentWidth, 40, 3, 3, "F");
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Informations client", margin + 8, y + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  
  const clientName = data.nomEntreprise || data.nom;
  doc.text(`Nom: ${clientName}`, margin + 8, y + 18);
  doc.text(`Téléphone: ${data.telephone || "—"}`, margin + 8, y + 25);
  const fullAddress = [data.adresse, data.quartier, data.ville].filter(Boolean).join(", ");
  doc.text(`Adresse: ${fullAddress}`, margin + 8, y + 32);
  if (data.email) {
    doc.text(`Email: ${data.email}`, margin + contentWidth / 2, y + 18);
  }
  if (data.contactEntreprise) {
    doc.text(`Contact: ${data.contactEntreprise}`, margin + contentWidth / 2, y + 25);
  }

  // Service details table
  y += 50;
  doc.setFillColor(0, 128, 128);
  doc.setTextColor(255, 255, 255);
  doc.rect(margin, y, contentWidth, 10, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Désignation", margin + 5, y + 7);
  doc.text("Détails", margin + contentWidth / 2, y + 7);
  
  y += 10;
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");

  const rows: [string, string][] = [
    ["Type de service", data.typePrestation],
    ["Segment", data.typeService === "SPE" ? "Entreprise" : "Particulier"],
  ];

  if (data.typeBien) rows.push(["Type de bien", data.typeBien]);
  if (data.superficie) rows.push(["Superficie", `${data.superficie} m²`]);
  if (data.dureeHeures) rows.push(["Durée", `${data.dureeHeures} heures`]);
  if (data.nombreIntervenants) rows.push(["Nombre d'intervenants", String(data.nombreIntervenants)]);
  rows.push(["Fréquence", data.frequence === "ponctuel" ? "Ponctuel" : "Abonnement"]);
  if (data.datePrestation) rows.push(["Date d'intervention", data.datePrestation]);
  if (data.heurePrestation) rows.push(["Heure", data.heurePrestation]);
  if (data.avecProduit) rows.push(["Produit ménager", "Oui"]);

  rows.forEach(([label, value], i) => {
    if (i % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y, contentWidth, 8, "F");
    }
    doc.text(label, margin + 5, y + 6);
    doc.text(value, margin + contentWidth / 2, y + 6);
    y += 8;
  });

  // Notes
  if (data.notesClient) {
    y += 5;
    doc.setFillColor(255, 253, 235);
    doc.roundedRect(margin, y, contentWidth, 20, 2, 2, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.text(`Notes: ${data.notesClient}`, margin + 5, y + 8, { maxWidth: contentWidth - 10 });
    y += 25;
  }

  // Total
  y += 5;
  doc.setFillColor(0, 128, 128);
  doc.roundedRect(margin + contentWidth / 2, y, contentWidth / 2, 14, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  const total = data.montantTotal ? `${data.montantTotal} MAD` : "Sur devis";
  doc.text(`Total: ${total}`, margin + contentWidth / 2 + 10, y + 10);

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 25;
  doc.setDrawColor(0, 128, 128);
  doc.line(margin, footerY, pageWidth - margin, footerY);
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`${AGENCE_INFO.name} — ICE: ${AGENCE_INFO.ice}`, margin, footerY + 8);
  doc.text(AGENCE_INFO.website, pageWidth - margin, footerY + 8, { align: "right" });
  doc.text("Ce devis est valable 30 jours à compter de sa date d'émission.", margin, footerY + 14);

  return doc;
}

export function generateRecapPNG(data: DevisData): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const scale = 2;
  const width = 800;
  const height = 1000;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Header
  ctx.fillStyle = "#008080";
  ctx.fillRect(0, 0, width, 70);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px Arial";
  ctx.fillText("Agence Ménage", 30, 30);
  ctx.font = "14px Arial";
  ctx.fillText("Récapitulatif de réservation", 30, 52);

  // Client info
  let y = 100;
  ctx.fillStyle = "#f5f5f5";
  ctx.fillRect(20, y - 10, width - 40, 80);
  ctx.fillStyle = "#333333";
  ctx.font = "bold 16px Arial";
  ctx.fillText("Client", 40, y + 10);
  ctx.font = "14px Arial";
  ctx.fillText(`Nom: ${data.nomEntreprise || data.nom}`, 40, y + 32);
  ctx.fillText(`Téléphone: ${data.telephone || "—"}`, 40, y + 52);
  const addr = [data.adresse, data.quartier, data.ville].filter(Boolean).join(", ");
  ctx.fillText(`Adresse: ${addr}`, 400, y + 32);

  // Details
  y = 210;
  ctx.fillStyle = "#008080";
  ctx.fillRect(20, y, width - 40, 30);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 14px Arial";
  ctx.fillText("Détails de la prestation", 40, y + 20);

  y += 40;
  ctx.fillStyle = "#333333";
  ctx.font = "14px Arial";

  const details: [string, string][] = [
    ["Service", data.typePrestation],
    ["Segment", data.typeService === "SPE" ? "Entreprise" : "Particulier"],
  ];
  if (data.typeBien) details.push(["Type de bien", data.typeBien]);
  if (data.superficie) details.push(["Superficie", `${data.superficie} m²`]);
  if (data.dureeHeures) details.push(["Durée", `${data.dureeHeures}h`]);
  if (data.nombreIntervenants) details.push(["Intervenants", String(data.nombreIntervenants)]);
  details.push(["Fréquence", data.frequence === "ponctuel" ? "Ponctuel" : "Abonnement"]);
  if (data.datePrestation) details.push(["Date", data.datePrestation]);
  if (data.heurePrestation) details.push(["Heure", data.heurePrestation]);
  if (data.avecProduit) details.push(["Produit ménager", "Oui"]);

  details.forEach(([label, value], i) => {
    if (i % 2 === 0) {
      ctx.fillStyle = "#fafafa";
      ctx.fillRect(20, y - 5, width - 40, 25);
    }
    ctx.fillStyle = "#333";
    ctx.font = "bold 13px Arial";
    ctx.fillText(label, 40, y + 12);
    ctx.font = "13px Arial";
    ctx.fillText(value, 400, y + 12);
    y += 25;
  });

  // Total
  y += 20;
  ctx.fillStyle = "#008080";
  ctx.fillRect(width / 2, y, width / 2 - 20, 40);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px Arial";
  const total = data.montantTotal ? `${data.montantTotal} MAD` : "Sur devis";
  ctx.fillText(`Total: ${total}`, width / 2 + 20, y + 27);

  // Footer
  ctx.fillStyle = "#e0e0e0";
  ctx.fillRect(0, height - 40, width, 40);
  ctx.fillStyle = "#888";
  ctx.font = "11px Arial";
  ctx.fillText(`Agence Ménage — ${format(new Date(), "dd/MM/yyyy")} — www.agencemenage.ma`, 30, height - 16);

  return canvas;
}

export function devisDataFromDemande(d: any): DevisData {
  return {
    numDemande: d.num_demande,
    nom: d.nom,
    telephone: d.telephone_direct || d.telephone_whatsapp,
    adresse: d.adresse,
    quartier: d.quartier,
    ville: d.ville,
    typePrestation: d.type_prestation,
    typeService: d.type_service,
    typeBien: d.type_bien,
    superficie: d.superficie_m2,
    dureeHeures: d.duree_heures,
    nombreIntervenants: d.nombre_intervenants,
    frequence: d.frequence,
    montantTotal: d.montant_total,
    avecProduit: d.avec_produit,
    datePrestation: d.date_prestation,
    heurePrestation: d.heure_prestation,
    notesClient: d.notes_client,
    nomEntreprise: d.nom_entreprise,
    contactEntreprise: d.contact_entreprise,
    email: d.email,
  };
}

// Services that are "devis" type (require quote)
export const SERVICES_DEVIS = [
  "Ménage post-sinistre",
  "Ménage fin de chantier",
  "Nettoyage post-déménagement",
  "Auxiliaire de vie",
  "Ménage Bureaux",
  "Placement & gestion",
];

export function isDevisType(typePrestation: string): boolean {
  return SERVICES_DEVIS.includes(typePrestation);
}
