"use client";

/**
 * BackofficeSiteStatusDialog — dialog de changement de statut d'un site (backoffice).
 *
 * Identique a AdminSiteStatusDialog mais utilise /api/backoffice/sites/[id]/status.
 * R5 : DialogTrigger asChild.
 * R6 : CSS variables du theme.
 *
 * Story C.6 — ADR-022 Backoffice
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SiteStatus } from "@/types";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

type SiteLifecycleAction = "SUSPEND" | "BLOCK" | "RESTORE" | "ARCHIVE";

interface ActionConfig {
  label: string;
  description: string;
  requiresReason: boolean;
  requiresConfirm: boolean;
  confirmLabel?: string;
  buttonVariant: "primary" | "danger" | "outline" | "ghost";
  buttonLabel: string;
}

/** ACTION_CONFIGS is built inside the component to use useTranslations. */

function getAllowedActions(status: SiteStatus): SiteLifecycleAction[] {
  switch (status) {
    case SiteStatus.ACTIVE:
      return ["SUSPEND", "BLOCK", "ARCHIVE"];
    case SiteStatus.SUSPENDED:
      return ["RESTORE", "BLOCK", "ARCHIVE"];
    case SiteStatus.BLOCKED:
      return ["RESTORE", "ARCHIVE"];
    case SiteStatus.ARCHIVED:
      return [];
  }
}

interface BackofficeSiteStatusDialogProps {
  siteId: string;
  siteName: string;
  currentStatus: SiteStatus;
  action?: SiteLifecycleAction;
  trigger: React.ReactNode;
  onSuccess?: () => void;
}

export function BackofficeSiteStatusDialog({
  siteId,
  siteName,
  currentStatus,
  action: fixedAction,
  trigger,
  onSuccess,
}: BackofficeSiteStatusDialogProps) {
  const t = useTranslations("backoffice.siteStatus");
  const [open, setOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<SiteLifecycleAction | "">(
    fixedAction ?? ""
  );
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const ACTION_CONFIGS: Record<SiteLifecycleAction, ActionConfig> = {
    SUSPEND: {
      label: t("actions.SUSPEND.buttonLabel"),
      description: t("actions.SUSPEND.description"),
      requiresReason: true,
      requiresConfirm: false,
      buttonVariant: "primary",
      buttonLabel: t("actions.SUSPEND.buttonLabel"),
    },
    BLOCK: {
      label: t("actions.BLOCK.buttonLabel"),
      description: t("actions.BLOCK.description"),
      requiresReason: true,
      requiresConfirm: false,
      buttonVariant: "danger",
      buttonLabel: t("actions.BLOCK.buttonLabel"),
    },
    RESTORE: {
      label: t("actions.RESTORE.buttonLabel"),
      description: t("actions.RESTORE.description"),
      requiresReason: false,
      requiresConfirm: false,
      buttonVariant: "primary",
      buttonLabel: t("actions.RESTORE.buttonLabel"),
    },
    ARCHIVE: {
      label: t("actions.ARCHIVE.buttonLabel"),
      description: t("actions.ARCHIVE.description"),
      requiresReason: false,
      requiresConfirm: true,
      confirmLabel: t("actions.ARCHIVE.confirmLabel"),
      buttonVariant: "danger",
      buttonLabel: t("actions.ARCHIVE.buttonLabel"),
    },
  };

  const allowedActions = getAllowedActions(currentStatus);
  const activeAction = fixedAction ?? (selectedAction as SiteLifecycleAction | "");
  const config = activeAction ? ACTION_CONFIGS[activeAction] : null;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setSelectedAction(fixedAction ?? "");
      setReason("");
      setConfirmed(false);
    }
  }

  async function handleSubmit() {
    if (!activeAction || !config) return;
    if (config.requiresReason && !reason.trim()) return;
    if (config.requiresConfirm && !confirmed) return;

    setLoading(true);
    try {
      const body: Record<string, unknown> = { action: activeAction };
      if (config.requiresReason && reason.trim()) body.reason = reason.trim();
      if (config.requiresConfirm) body.confirmArchive = true;

      const res = await fetch(`/api/backoffice/sites/${siteId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? data.message ?? t("toastErrorDefault"));
      }

      toast({ title: t("toastSuccess"), description: t("toastSuccessDesc", { name: siteName }) });
      setOpen(false);
      onSuccess?.();
    } catch (err) {
      toast({
        title: t("toastError"),
        description: err instanceof Error ? err.message : t("toastErrorDefault"),
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  const canSubmit =
    !!activeAction &&
    !!config &&
    (!config.requiresReason || reason.trim().length > 0) &&
    (!config.requiresConfirm || confirmed) &&
    !loading;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* R5 — DialogTrigger asChild */}
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("siteLabel")} <strong>{siteName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selection de l'action (quand non fixee) */}
          {!fixedAction && allowedActions.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t("actionLabel")}</label>
              <div className="flex flex-wrap gap-2">
                {allowedActions.map((act) => (
                  <button
                    key={act}
                    onClick={() => {
                      setSelectedAction(act);
                      setReason("");
                      setConfirmed(false);
                    }}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                      selectedAction === act
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {ACTION_CONFIGS[act].buttonLabel}
                  </button>
                ))}
              </div>
            </div>
          )}

          {config && (
            <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              {config.description}
            </div>
          )}

          {config?.requiresReason && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="bo-reason">
                {t("raisonLabel")} <span className="text-danger">*</span>
              </label>
              <textarea
                id="bo-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("raisonPlaceholder")}
                rows={3}
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
          )}

          {config?.requiresConfirm && (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-3">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-danger"
              />
              <span className="text-sm text-foreground">{config.confirmLabel}</span>
            </label>
          )}

          {allowedActions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("aucuneAction")}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            {t("annuler")}
          </Button>
          {config && (
            <Button
              variant={config.buttonVariant}
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {loading ? t("traitement") : config.buttonLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
