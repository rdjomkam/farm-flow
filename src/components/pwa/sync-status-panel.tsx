"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Trash2, AlertCircle, Clock, Loader2 } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
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
  pending: "text-amber-500",
  syncing: "text-primary",
  failed: "text-red-500",
};

const STATUS_LABELS = {
  pending: "En attente",
  syncing: "En cours",
  failed: "Echoue",
};

export function SyncStatusPanel({ open, onOpenChange, siteId, onSyncNow }: SyncStatusPanelProps) {
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
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] rounded-t-xl bg-white p-4 shadow-xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl">
          <Dialog.Title className="text-lg font-semibold">
            File de synchronisation
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-gray-500">
            {items.length === 0
              ? "Aucun element en attente"
              : `${items.length} element${items.length > 1 ? "s" : ""} en attente`}
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
              Synchroniser
            </button>
            {items.length > 0 && (
              <button
                onClick={() => setConfirmClear(true)}
                className="flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Vider
              </button>
            )}
          </div>

          {/* Confirm clear */}
          {confirmClear && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-700">
                Supprimer tous les elements en attente ? Cette action est irreversible.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={handleClear}
                  disabled={clearing}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
                >
                  {clearing ? "Suppression..." : "Confirmer"}
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="rounded-md border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Annuler
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
                    <p className="text-xs text-gray-500">
                      {STATUS_LABELS[item.status]} · {formatDate(item.createdAt)}
                      {item.retryCount > 0 && ` · ${item.retryCount} tentative${item.retryCount > 1 ? "s" : ""}`}
                    </p>
                    {item.lastError && (
                      <p className="mt-1 text-xs text-red-500 truncate">
                        {item.lastError}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <Dialog.Close asChild>
            <button className="mt-4 w-full rounded-md border py-2 text-sm text-gray-600 hover:bg-gray-50">
              Fermer
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
