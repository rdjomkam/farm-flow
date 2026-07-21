/**
 * Utilitaires pour partager un bon de livraison signe (PDF) via le
 * selecteur natif (WhatsApp, etc.) ou, a defaut, un fallback
 * telechargement + wa.me.
 */
import { formatNumber, formatDate } from "@/lib/format";
import { buildWhatsAppUrl } from "@/lib/share-commande";

export interface ShareBonLivraisonData {
  numero: string;
  date: string | Date;
  client: { nom: string };
  nombreLignes: number;
  montantTotal: number;
  resteAPayer: number;
}

export interface ShareBonLivraisonResult {
  ok: boolean;
  /** true si l'utilisateur a annule le partage natif — pas une erreur a afficher */
  cancelled?: boolean;
  error?: string;
}

/**
 * Formate les donnees d'un bon de livraison en message texte lisible.
 */
export function formatBonLivraisonMessage(data: ShareBonLivraisonData): string {
  const date = formatDate(data.date);

  return [
    `*Bon de livraison ${data.numero}*`,
    `Date : ${date}`,
    `Client : ${data.client.nom}`,
    `Lignes livrées : ${data.nombreLignes}`,
    "",
    `*Total : ${formatNumber(data.montantTotal)} FCFA*`,
    `Reste à payer : ${formatNumber(data.resteAPayer)} FCFA`,
    "",
    "_(Généré depuis FarmFlow)_",
  ].join("\n");
}

/**
 * Declenche le telechargement d'un blob dans le navigateur via un lien
 * temporaire (fallback quand le partage natif de fichiers est indisponible).
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Partage le PDF signe d'un bon de livraison.
 *
 * 1. Recupere le PDF via la route d'export (le BL doit etre SIGNE).
 * 2. Si le navigateur supporte le partage de fichiers (mobile), ouvre le
 *    selecteur natif — l'utilisateur peut choisir WhatsApp et le client
 *    recoit le vrai fichier PDF.
 * 3. Sinon, fallback : telecharge le PDF localement ET ouvre wa.me avec un
 *    message texte recap, pour que l'utilisateur puisse joindre le fichier
 *    telecharge manuellement.
 */
export async function shareBonLivraisonPDF(
  bonLivraisonId: string,
  numero: string,
  data: ShareBonLivraisonData
): Promise<ShareBonLivraisonResult> {
  let blob: Blob;
  try {
    const response = await fetch(`/api/export/bon-livraison/${bonLivraisonId}`);
    if (!response.ok) {
      return { ok: false, error: "Erreur lors de la récupération du PDF." };
    }
    blob = await response.blob();
  } catch {
    return { ok: false, error: "Erreur réseau lors de la récupération du PDF." };
  }

  const filename = `${numero}.pdf`;
  const file = new File([blob], filename, { type: "application/pdf" });
  const message = formatBonLivraisonMessage(data);

  const nav = typeof navigator !== "undefined" ? navigator : undefined;

  if (nav?.canShare?.({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
        title: `Bon de livraison ${numero}`,
        text: message,
      });
      return { ok: true };
    } catch (err) {
      const name = err instanceof DOMException || err instanceof Error ? err.name : undefined;
      if (name === "AbortError") {
        // Utilisateur a annule le partage — pas une erreur
        return { ok: true, cancelled: true };
      }
      return { ok: false, error: "Erreur lors du partage du bon de livraison." };
    }
  }

  // Fallback : telechargement local + ouverture de wa.me avec le message
  downloadBlob(blob, filename);
  window.open(buildWhatsAppUrl(message), "_blank", "noopener,noreferrer");
  return { ok: true };
}
