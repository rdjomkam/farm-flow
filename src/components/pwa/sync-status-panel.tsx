"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Trash2, AlertCircle, Clock, Loader2 } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { useTranslations } from "next-intl";
import type { QueueMeta } from "@/lib/offline/db";

interface SyncStatusPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  onSyncNow: () => Promise<void>;
}

const STATUS_ICONS = {
  pending: Clock,
  syncing: Loader2,
  failed: AlertCircle,
};

const STATUS_COLORS = {
  pending: "text-warning",
  syncing: "text-primary",
  failed: "text-danger",
};

export function SyncStatusPanel({ open, onOpenChange, siteId, onSyncNow }: SyncStatusPanelProps) {
  const t = useTranslations("pwa");
  const [items, setItems] = useState<QueueMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!open || !siteId) return;
    const load = async () => {
      const { getQueueItems } = await import("@/lib/offline/queue");
      const queueItems = await getQueueItems(siteId);
      setItems(queueItems);
    };
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [open, siteId]);

  const handleSync = async () => {
    setLoading(true);
    try {
      await onSyncNow();
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      const { clearQueue } = await import("@/lib/offline/queue");
      await clearQueue(siteId);
      setItems([]);
      setConfirmClear(false);
    } finally {
      setClearing(false);
    }
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] rounded-t-xl bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:pb-4">
          <Dialog.Title className="text-lg font-semibold">
            {t("syncStatus.title")}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            {items.length === 0
              ? t("syncStatus.aucunElement")
              : t("syncStatus.elementsEnAttente", { count: items.length })}
          </Dialog.Description>

          {/* Actions */}
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleSync}
              disabled={loading || items.length === 0}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {t("syncStatus.synchroniser")}
            </button>
            {items.length > 0 && (
              <button
                onClick={() => setConfirmClear(true)}
                className="flex items-center gap-1.5 rounded-md border border-danger/30 px-3 py-1.5 text-sm text-danger hover:bg-danger/10"
              >
                <Trash2 className="h-4 w-4" />
                {t("syncStatus.vider")}
              </button>
            )}
          </div>

          {/* Confirm clear */}
          {confirmClear && (
            <div className="mt-3 rounded-lg border border-danger/30 bg-danger/10 p-3">
              <p className="text-sm text-danger">
                {t("syncStatus.confirmerVider")}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={handleClear}
                  disabled={clearing}
                  className="rounded-md bg-danger px-3 py-1.5 text-sm text-white hover:bg-danger/90"
                >
                  {clearing ? t("syncStatus.suppression") : t("syncStatus.confirmer")}
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="rounded-md border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
                >
                  {t("syncStatus.annuler")}
                </button>
              </div>
            </div>
          )}

          {/* Queue items list */}
          <div className="mt-4 max-h-[50vh] space-y-2 overflow-y-auto">
            {items.map((item, i) => {
              const Icon = STATUS_ICONS[item.status];
              return (
                <div
                  key={`${item.idempotencyKey}-${i}`}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 mt-0.5 ${STATUS_COLORS[item.status]} ${
                      item.status === "syncing" ? "animate-spin" : ""
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {item.entityLabel}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t(`syncStatus.statuts.${item.status}`)} · {formatDate(item.createdAt)}
                      {item.retryCount > 0 && ` · ${t("syncStatus.tentatives", { count: item.retryCount })}`}
                    </p>
                    {item.lastError && (
                      <p className="mt-1 text-xs text-danger truncate">
                        {item.lastError}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <Dialog.Close asChild>
            <button className="mt-4 w-full rounded-md border py-2 text-sm text-foreground hover:bg-muted">
              {t("syncStatus.fermer")}
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
