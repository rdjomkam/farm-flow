"use client";

/**
 * FeatureFlagToggle — Toggle interactif pour un feature flag.
 *
 * Affiche :
 * - Label + description du flag
 * - Toggle switch (Radix Switch-like, implémenté manuellement sans dépendance)
 * - Infos sur la dernière modification (date + qui)
 * - Dialog de confirmation avant activation du flag MAINTENANCE_MODE
 *   avec champs optionnels : message + date de fin prevue (R5: DialogTrigger asChild)
 *
 * Sur toggle -> PATCH /api/backoffice/feature-flags/[key]
 * La réponse inclut le cookie platform_maintenance (Set-Cookie header).
 *
 * ADR-maintenance-mode
 * R5 : DialogTrigger asChild
 * R6 : CSS variables du theme
 */

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export interface FeatureFlagToggleProps {
  flagKey: string;
  enabled: boolean;
  label: string;
  description: string;
  value: Record<string, unknown> | null;
  updatedAt: string | null;
  updatedByName: string | null;
}

function formatDate(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function FeatureFlagToggle({
  flagKey,
  enabled,
  label,
  description,
  value,
  updatedAt,
  updatedByName,
}: FeatureFlagToggleProps) {
  const t = useTranslations("backoffice.featureFlags");
  const locale = useLocale();
  const { toast } = useToast();
  const router = useRouter();

  const [optimisticEnabled, setOptimisticEnabled] = useState(enabled);
  const [isLoading, setIsLoading] = useState(false);

  // Dialog state — confirmation pour l'activation
  const [dialogOpen, setDialogOpen] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [estimatedEnd, setEstimatedEnd] = useState("");

  const isMaintenanceFlag = flagKey === "MAINTENANCE_MODE";
  const currentValue = value as { message?: string; estimatedEnd?: string } | null;

  // ---------------------------------------------------------------------------
  // Toggle handler
  // ---------------------------------------------------------------------------

  async function performToggle(newEnabled: boolean, extraBody?: Record<string, unknown>) {
    setOptimisticEnabled(newEnabled);

    const body: Record<string, unknown> = { enabled: newEnabled, ...extraBody };

    const response = await fetch(`/api/backoffice/feature-flags/${encodeURIComponent(flagKey)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });

    if (!response.ok) {
      // Rollback optimistic update
      setOptimisticEnabled(!newEnabled);
      let errorMessage = t("toggleError");
      try {
        const data = (await response.json()) as { message?: string };
        if (data.message) errorMessage = data.message;
      } catch {
        // ignore
      }
      toast({ title: t("toggleErrorTitle"), description: errorMessage, variant: "error" });
      return false;
    }

    const successMessage = newEnabled ? t("enabledSuccess") : t("disabledSuccess");
    toast({ title: t("toggleSuccessTitle"), description: successMessage });

    // Refresh page data (statut mis a jour en server component)
    router.refresh();
    return true;
  }

  async function handleToggleClick() {
    if (isMaintenanceFlag && !optimisticEnabled) {
      // Activation du mode maintenance — confirmation requise
      setDialogOpen(true);
    } else {
      // Desactivation ou flag non-critique — pas de confirmation
      setIsLoading(true);
      try {
        await performToggle(!optimisticEnabled);
      } finally {
        setIsLoading(false);
      }
    }
  }

  async function handleConfirmActivation() {
    setDialogOpen(false);
    setIsLoading(true);
    try {
      await performToggle(true, {
        ...(maintenanceMessage.trim() && { message: maintenanceMessage.trim() }),
        ...(estimatedEnd && { estimatedEnd: estimatedEnd }),
      });
    } finally {
      setIsLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground text-sm sm:text-base">
                {label}
              </span>
              <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground">
                {flagKey}
              </code>
              {optimisticEnabled && (
                <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                  {t("activeLabel")}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>

            {/* Valeur courante (message + estimatedEnd) */}
            {optimisticEnabled && currentValue && (
              <div className="mt-3 space-y-1 rounded-lg bg-destructive/5 border border-destructive/20 p-3">
                {currentValue.message && (
                  <p className="text-sm text-destructive">
                    <span className="font-medium">{t("messageLabel")} : </span>
                    {currentValue.message}
                  </p>
                )}
                {currentValue.estimatedEnd && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">{t("estimatedEndLabel")} : </span>
                    {formatDate(currentValue.estimatedEnd, locale)}
                  </p>
                )}
              </div>
            )}

            {/* Infos de modification */}
            {updatedAt && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t("lastUpdated")} : {formatDate(updatedAt, locale)}
                {updatedByName && (
                  <> &mdash; <span className="font-medium">{updatedByName}</span></>
                )}
              </p>
            )}
          </div>

          {/* Toggle switch */}
          <button
            type="button"
            role="switch"
            aria-checked={optimisticEnabled}
            aria-label={`${label} — ${optimisticEnabled ? t("disableLabel") : t("enableLabel")}`}
            disabled={isLoading}
            onClick={handleToggleClick}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              optimisticEnabled ? "bg-destructive" : "bg-input"
            )}
          >
            <span
              className={cn(
                "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200",
                optimisticEnabled ? "translate-x-5" : "translate-x-0.5"
              )}
            />
          </button>
        </div>
      </div>

      {/* Dialog de confirmation — activation MAINTENANCE_MODE */}
      {/* Controlled Dialog — opened programmatically via handleToggleClick (no trigger needed) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">
              {t("confirmDialog.title")}
            </DialogTitle>
            <DialogDescription>
              {t("confirmDialog.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Message de maintenance */}
            <div>
              <label
                htmlFor="maintenance-message"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                {t("confirmDialog.messageLabel")}
                <span className="ml-1 text-xs text-muted-foreground">
                  ({t("confirmDialog.optional")})
                </span>
              </label>
              <textarea
                id="maintenance-message"
                value={maintenanceMessage}
                onChange={(e) => setMaintenanceMessage(e.target.value)}
                placeholder={t("confirmDialog.messagePlaceholder")}
                rows={3}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 resize-none"
              />
            </div>

            {/* Date de fin prevue */}
            <div>
              <label
                htmlFor="maintenance-end"
                className="mb-1.5 block text-sm font-medium text-foreground"
              >
                {t("confirmDialog.estimatedEndLabel")}
                <span className="ml-1 text-xs text-muted-foreground">
                  ({t("confirmDialog.optional")})
                </span>
              </label>
              <input
                id="maintenance-end"
                type="datetime-local"
                value={estimatedEnd}
                onChange={(e) => setEstimatedEnd(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="w-full sm:w-auto"
            >
              {t("confirmDialog.cancel")}
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmActivation}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              {isLoading ? t("confirmDialog.processing") : t("confirmDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
