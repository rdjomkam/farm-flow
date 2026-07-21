/**
 * Utilitaires pour partager un bon de livraison signe (PDF) via le
 * selecteur natif du navigateur/telephone (navigator.share) ou, a defaut,
 * un simple telechargement local du PDF.
 */
import { formatNumber, formatDate } from "@/lib/format";

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
 * 2. Si le navigateur expose `navigator.share`, tente le partage natif avec
 *    le fichier PDF (sheet natif du telephone/navigateur — l'utilisateur
 *    choisit lui-meme le canal : WhatsApp, email, etc.). On tente meme si
 *    `navigator.canShare` est indisponible (certains navigateurs) ; si
 *    `canShare` existe et repond explicitement non, on saute directement au
 *    fallback.
 * 3. Sinon (pas de partage natif, ou echec du partage natif hors
 *    annulation), fallback : simple telechargement local du PDF.
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
  const canShareFiles = nav?.canShare ? nav.canShare({ files: [file] }) : true;

  if (nav?.share && canShareFiles) {
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
      // Echec du partage natif (autre que l'annulation) : on bascule
      // silencieusement sur le fallback telechargement ci-dessous.
    }
  }

  // Fallback : simple telechargement local du PDF
  try {
    downloadBlob(blob, filename);
    return { ok: true };
  } catch {
    return { ok: false, error: "Erreur lors du téléchargement du bon de livraison." };
  }
}
