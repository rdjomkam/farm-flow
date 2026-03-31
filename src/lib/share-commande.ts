/**
 * Utilitaires pour partager une commande fournisseur via WhatsApp ou le systeme natif.
 */
import { formatNumber, formatDate } from "@/lib/format";

export interface ShareCommandeData {
  numero: string;
  dateCommande: string | Date;
  fournisseur: { nom: string; telephone?: string | null };
  lignes: {
    produit: { nom: string; unite?: string; uniteAchat?: string | null };
    quantite: number;
    prixUnitaire: number;
  }[];
  montantTotal: number;
}

/**
 * Formate les donnees d'une commande en message texte lisible.
 */
export function formatCommandeMessage(commande: ShareCommandeData): string {
  const date = formatDate(commande.dateCommande);
  const lignesText = commande.lignes
    .map((l) => {
      const unite = l.produit.uniteAchat || l.produit.unite || "";
      const sousTotal = l.quantite * l.prixUnitaire;
      return `- ${l.produit.nom} : ${l.quantite} ${unite} x ${formatNumber(l.prixUnitaire)} FCFA = ${formatNumber(sousTotal)} FCFA`;
    })
    .join("\n");

  return [
    `*Commande ${commande.numero}*`,
    `Date : ${date}`,
    `Fournisseur : ${commande.fournisseur.nom}`,
    "",
    "*Articles :*",
    lignesText,
    "",
    `*Total : ${formatNumber(commande.montantTotal)} FCFA*`,
    "",
    "_(Généré depuis FarmFlow)_",
  ].join("\n");
}

/**
 * Construit l'URL WhatsApp pour partager un message.
 */
export function buildWhatsAppUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
