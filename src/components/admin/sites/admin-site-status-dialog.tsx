"use client";

/**
 * admin-site-status-dialog.tsx
 *
 * Dialog Radix pour changer le statut d'un site (suspension/blocage/restauration/archivage).
 * R5 : DialogTrigger asChild sur tous les boutons déclencheurs.
 * R6 : CSS variables du thème — pas de couleurs hardcodées.
 *
 * Transitions autorisées (ADR-021 section 2.8) :
 *   ACTIVE  → SUSPEND | BLOCK | ARCHIVE
 *   SUSPENDED → BLOCK | RESTORE | ARCHIVE
 *   BLOCKED → RESTORE | ARCHIVE
 */

import { useState } from "react";
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

const ACTION_CONFIGS: Record<SiteLifecycleAction, ActionConfig> = {
  SUSPEND: {
    label: "Suspendre le site",
    description:
      "Le site sera suspendu. Les utilisateurs verront un écran de suspension à la connexion. Les données restent accessibles en lecture pour les admins.",
    requiresReason: true,
    requiresConfirm: false,
    buttonVariant: "primary",
    buttonLabel: "Suspendre",
  },
  BLOCK: {
    label: "Bloquer le site",
    description:
      "Le site sera bloqué. Toutes les sessions actives seront invalidées immédiatement. Les utilisateurs ne pourront plus se connecter.",
    requiresReason: true,
    requiresConfirm: false,
    buttonVariant: "danger",
    buttonLabel: "Bloquer",
  },
  RESTORE: {
    label: "Restaurer le site",
    description:
      "Le site sera restauré à l'état actif. Les utilisateurs pourront se reconnecter normalement.",
    requiresReason: false,
    requiresConfirm: false,
    buttonVariant: "primary",
    buttonLabel: "Restaurer",
  },
  ARCHIVE: {
    label: "Archiver le site",
    description:
      "Le site sera archivé de façon irréversible via l'interface. Cette action ne peut pas être annulée sans intervention directe en base de données.",
    requiresReason: false,
    requiresConfirm: true,
    confirmLabel: "Je confirme l'archivage définitif de ce site",
    buttonVariant: "danger",
    buttonLabel: "Archiver définitivement",
  },
};

/** Retourne les actions disponibles selon le statut courant du site. */
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

interface AdminSiteStatusDialogProps {
  siteId: string;
  siteName: string;
  currentStatus: SiteStatus;
  /** Action spécifique à proposer dans ce dialog (si omis, propose toutes les actions autorisées). */
  action?: SiteLifecycleAction;
  /** Élément déclencheur — sera enveloppé dans DialogTrigger asChild (R5). */
  trigger: React.ReactNode;
  onSuccess?: () => void;
}

export function AdminSiteStatusDialog({
  siteId,
  siteName,
  currentStatus,
  action: fixedAction,
  trigger,
  onSuccess,
}: AdminSiteStatusDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<SiteLifecycleAction | "">(
    fixedAction ?? ""
  );
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

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

      const res = await fetch(`/api/admin/sites/${siteId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erreur lors de la mise à jour du statut.");
      }

      toast({ title: "Statut mis à jour", description: `Le site "${siteName}" a été modifié.` });
      setOpen(false);
      onSuccess?.();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Une erreur est survenue.",
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
          <DialogTitle>Changer le statut du site</DialogTitle>
          <DialogDescription>
            Site : <strong>{siteName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Sélection de l'action (quand non fixée) */}
          {!fixedAction && allowedActions.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Action</label>
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

          {/* Description de l'action */}
          {config && (
            <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              {config.description}
            </div>
          )}

          {/* Champ raison */}
          {config?.requiresReason && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="reason">
                Raison <span className="text-danger">*</span>
              </label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Expliquez la raison de cette action..."
                rows={3}
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
          )}

          {/* Confirmation archivage */}
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

          {/* Message si aucune action disponible */}
          {allowedActions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aucune action disponible pour un site archivé.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Annuler
          </Button>
          {config && (
            <Button
              variant={config.buttonVariant}
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {loading ? "Traitement..." : config.buttonLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
