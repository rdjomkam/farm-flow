"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Building2, Users, Container, Waves, Plus, Check, Lock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { BlockedResourceOverlay } from "@/components/ui/blocked-resource-overlay";
import { cn } from "@/lib/utils";
import { useUserService, useAuthService } from "@/services";
import { queryKeys } from "@/lib/query-keys";

interface SiteData {
  id: string;
  name: string;
  address: string | null;
  isActive: boolean;
  isBlocked: boolean;
  memberCount: number;
  bacCount: number;
  vagueCount: number;
  createdAt: Date;
}

interface Props {
  sites: SiteData[];
  activeSiteId: string | null;
  canCreate: boolean;
  /** L'utilisateur courant est propriétaire d'au moins un site — affecte les messages d'erreur quota */
  isOwner?: boolean;
}

// ---------------------------------------------------------------------------
// Types internes pour l'état du dialog de création
// ---------------------------------------------------------------------------

type DialogState =
  | { kind: "IDLE" }
  | { kind: "FORM" }
  | { kind: "QUOTA_EXCEEDED"; isOwner: boolean }
  | { kind: "SUBSCRIPTION_REQUIRED" };

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function SitesListClient({ sites, activeSiteId, canCreate, isOwner = false }: Props) {
  const t = useTranslations("sites");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const queryClient = useQueryClient();
  const userService = useUserService();
  const authService = useAuthService();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState>({ kind: "FORM" });
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [switching, setSwitching] = useState<string | null>(null);

  function handleOpenChange(open: boolean) {
    setDialogOpen(open);
    if (open) {
      // Reset to form state each time dialog opens
      setDialogState({ kind: "FORM" });
      setName("");
      setAddress("");
    }
  }

  async function handleCreate() {
    if (!name.trim()) return;

    const result = await userService.createSite(
      {
        name: name.trim(),
        ...(address.trim() && { address: address.trim() }),
      },
      // silentError: géré manuellement pour 402/403
      { silentError: true }
    );

    if (result.ok && result.data) {
      setDialogOpen(false);
      setName("");
      setAddress("");

      // Auto-select the new site (silent — success toast already shown by createSite)
      await authService.switchSite({ siteId: (result.data as { id: string }).id });
      // Full reload to re-render root layout with fresh permissions/modules
      window.location.href = "/";
      return;
    }

    // Gérer les erreurs 402 (abonnement requis) et 403 (quota atteint)
    if (result.status === 402) {
      setDialogState({ kind: "SUBSCRIPTION_REQUIRED" });
      return;
    }

    if (result.status === 403) {
      setDialogState({ kind: "QUOTA_EXCEEDED", isOwner });
      return;
    }

    // Autres erreurs : fermer le dialog (toast automatique déjà affiché)
    setDialogOpen(false);
  }

  async function handleSelect(siteId: string) {
    if (siteId === activeSiteId) return;

    setSwitching(siteId);
    const { ok } = await authService.switchSite({ siteId });
    if (ok) {
      // Full reload to re-render root layout with fresh permissions/modules
      window.location.href = "/";
    }
    setSwitching(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t("list.count", { count: sites.length })}
        </p>
        {canCreate && (
          <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                {t("list.nouveau")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("list.createTitle")}</DialogTitle>
              </DialogHeader>

              {/* Etat : formulaire de création */}
              {dialogState.kind === "FORM" && (
                <>
                  <div className="flex flex-col gap-4 py-2">
                    <Input
                      label={t("list.nomLabel")}
                      placeholder={t("list.nomPlaceholder")}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoFocus
                    />
                    <Input
                      label={t("list.adresseLabel")}
                      placeholder={t("list.adressePlaceholder")}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">{t("list.annuler")}</Button>
                    </DialogClose>
                    <Button onClick={handleCreate} disabled={!name.trim()}>
                      {t("list.creer")}
                    </Button>
                  </DialogFooter>
                </>
              )}

              {/* Etat : abonnement requis (402) */}
              {dialogState.kind === "SUBSCRIPTION_REQUIRED" && (
                <>
                  <DialogDescription>
                    {tErrors("quota.subscriptionRequired")}
                  </DialogDescription>
                  <div className="flex flex-col gap-2 pt-2">
                    <Link href="/tarifs" className="w-full">
                      <Button className="w-full min-h-[44px]">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        {tErrors("quota.viewPlans")}
                      </Button>
                    </Link>
                    <DialogClose asChild>
                      <Button variant="outline" className="w-full min-h-[44px]">
                        {t("list.annuler")}
                      </Button>
                    </DialogClose>
                  </div>
                </>
              )}

              {/* Etat : quota dépassé (403) */}
              {dialogState.kind === "QUOTA_EXCEEDED" && (
                <>
                  <DialogDescription>
                    {dialogState.isOwner
                      ? tErrors("quota.upgradeOwner", { resource: t("list.resourceName") })
                      : tErrors("quota.contactOwner", { resource: t("list.resourceName") })}
                  </DialogDescription>
                  <div className="flex flex-col gap-2 pt-2">
                    {dialogState.isOwner ? (
                      <Link href="/mon-abonnement/changer-plan" className="w-full">
                        <Button className="w-full min-h-[44px]">
                          {t("list.upgradeButton")}
                        </Button>
                      </Link>
                    ) : null}
                    <DialogClose asChild>
                      <Button variant="outline" className="w-full min-h-[44px]">
                        {t("list.annuler")}
                      </Button>
                    </DialogClose>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>

      {sites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-2">{t("list.empty")}</p>
          <p className="text-sm text-muted-foreground">
            {canCreate ? t("list.emptyOwner") : t("list.emptyMember")}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {sites.map((site) => {
            if (site.isBlocked) {
              return (
                <BlockedResourceOverlay key={site.id} resourceName={site.name}>
                  <SiteCard
                    site={site}
                    isActive={site.id === activeSiteId}
                    switching={switching}
                    onSelect={handleSelect}
                  />
                </BlockedResourceOverlay>
              );
            }

            return (
              <SiteCard
                key={site.id}
                site={site}
                isActive={site.id === activeSiteId}
                switching={switching}
                onSelect={handleSelect}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sous-composant : SiteCard
// ---------------------------------------------------------------------------

interface SiteCardProps {
  site: SiteData;
  isActive: boolean;
  switching: string | null;
  onSelect: (siteId: string) => void;
}

function SiteCard({ site, isActive, switching, onSelect }: SiteCardProps) {
  const t = useTranslations("sites");
  return (
    <Card
      className={cn(
        "transition-colors",
        isActive && "ring-2 ring-primary",
        site.isBlocked && "opacity-60"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary shrink-0" />
              <h3 className="font-semibold truncate">{site.name}</h3>
              {isActive && (
                <span className="flex items-center gap-1 text-xs text-primary font-medium shrink-0">
                  <Check className="h-3 w-3" />
                  {t("list.actif")}
                </span>
              )}
              {site.isBlocked && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium shrink-0">
                  <Lock className="h-3 w-3" />
                  {t("list.blocked")}
                </span>
              )}
            </div>
            {site.address && (
              <p className="text-sm text-muted-foreground mt-1 truncate">
                {site.address}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
          <span className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            {site.memberCount}
          </span>
          <span className="flex items-center gap-1">
            <Container className="h-4 w-4" />
            {site.bacCount}
          </span>
          <span className="flex items-center gap-1">
            <Waves className="h-4 w-4" />
            {site.vagueCount}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={isActive ? "outline" : "primary"}
            onClick={() => onSelect(site.id)}
            disabled={switching === site.id || isActive || site.isBlocked}
            className="flex-1"
          >
            {isActive ? t("list.badgeActif") : t("list.selectionner")}
          </Button>
          <Link href={`/settings/sites/${site.id}`}>
            <Button size="sm" variant="outline">
              {t("list.gerer")}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
