"use client";

/**
 * src/components/ui/blocked-resource-overlay.tsx
 *
 * Overlay pour les ressources bloquées par le plan d'abonnement.
 *
 * Story 48.4 — Sprint 48
 * R5 : DialogTrigger asChild
 * R6 : CSS variables du thème (pas de couleurs hardcodées)
 * Mobile first : 360px d'abord
 *
 * Usage :
 *   <BlockedResourceOverlay resourceName="ce bac">
 *     <div className="...">contenu grisé</div>
 *   </BlockedResourceOverlay>
 */

import { Lock } from "lucide-react";
import Link from "next/link";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BlockedResourceOverlayProps {
  /** Nom de la ressource bloquée affiché dans le dialog */
  resourceName?: string;
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function BlockedResourceOverlay({
  resourceName,
  children,
}: BlockedResourceOverlayProps) {
  const t = useTranslations("blockedResource");

  return (
    <Dialog>
      <DialogTrigger asChild>
        {/* Wrapper relatif pour superposer le badge cadenas */}
        <div className="relative cursor-pointer select-none group" role="button" tabIndex={0}>
          {/* Contenu grisé */}
          <div className="opacity-50 pointer-events-none">{children}</div>

          {/* Badge cadenas centré */}
          <div
            className={[
              "absolute inset-0 flex items-center justify-center",
              "bg-background/40 rounded-lg",
              "transition-opacity group-hover:bg-background/60",
            ].join(" ")}
            aria-hidden="true"
          >
            <div className="flex flex-col items-center gap-1">
              <div className="rounded-full bg-muted p-2">
                <Lock className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">
                {t("badgeLabel")}
              </span>
            </div>
          </div>
        </div>
      </DialogTrigger>

      <DialogContent className="max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground shrink-0" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>
            {resourceName
              ? t("descriptionWithName", { name: resourceName })
              : t("description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 pt-2">
          <p className="text-sm text-muted-foreground">
            {t("upgradeMessage")}
          </p>

          <div className="flex flex-col gap-2">
            <Link href="/mon-abonnement/changer-plan" className="w-full">
              <Button className="w-full min-h-[44px]">
                {t("upgradeButton")}
              </Button>
            </Link>
            <DialogClose asChild>
              <Button variant="outline" className="w-full min-h-[44px]">
                {t("closeButton")}
              </Button>
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
