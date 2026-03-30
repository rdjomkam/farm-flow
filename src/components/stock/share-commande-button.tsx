"use client";

import { useState } from "react";
import { Share2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCommandeMessage, buildWhatsAppUrl } from "@/lib/share-commande";
import type { ShareCommandeData } from "@/lib/share-commande";

interface Props {
  commande: ShareCommandeData;
}

export function ShareCommandeButton({ commande }: Props) {
  const [copied, setCopied] = useState(false);
  const message = formatCommandeMessage(commande);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: message });
        return;
      } catch {
        // Utilisateur a annule ou l'API a echoue, on bascule vers WhatsApp
      }
    }
    window.open(buildWhatsAppUrl(message), "_blank", "noopener,noreferrer");
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleShare}
        className="flex-1 sm:flex-none"
      >
        <Share2 className="mr-2 h-4 w-4" />
        Partager
      </Button>
      <Button variant="ghost" size="sm" onClick={handleCopy}>
        {copied ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
