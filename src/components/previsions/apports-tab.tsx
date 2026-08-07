"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PiggyBank, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { Permission, TypeApportCapital } from "@/types";
import { ApportFormDialog } from "@/components/previsions/apport-form-dialog";
import { formatMontantPrevision } from "@/lib/previsions/format-previsions";
import { usePrevisionsApi } from "@/hooks/use-previsions-api";
import type { ApportCapitalDTO } from "@/components/previsions/api-types";

interface ApportsTabProps {
  scenarioId: string;
  initialApports: ApportCapitalDTO[];
  permissions: Permission[];
  onDataChanged?: () => void;
}

export function ApportsTab({ scenarioId, initialApports, permissions, onDataChanged }: ApportsTabProps) {
  const t = useTranslations("previsions");
  const { put, del } = usePrevisionsApi();
  const [apports, setApports] = useState(initialApports);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const peutGerer = permissions.includes(Permission.PREVISIONS_GERER);

  const totalActif = apports
    .filter((a) => a.actif !== false)
    .reduce((sum, a) => sum + Number(a.montantFCFA), 0);

  async function handleDelete(id: string) {
    if (!confirm(t("apportsTab.deleteConfirm"))) return;
    setDeleting(id);
    try {
      const result = await del(`/api/previsions/apports/${id}`);
      if (result.ok) {
        setApports((prev) => prev.filter((a) => a.id !== id));
        onDataChanged?.();
      }
    } finally {
      setDeleting(null);
    }
  }

  async function handleToggleActif(id: string, actif: boolean) {
    setToggling(id);
    try {
      const result = await put<ApportCapitalDTO>(`/api/previsions/apports/${id}`, { actif });
      if (result.ok && result.data) {
        setApports((prev) => prev.map((a) => (a.id === id ? { ...a, actif: result.data!.actif } : a)));
        onDataChanged?.();
      }
    } finally {
      setToggling(null);
    }
  }

  function handleUpdated(updated: ApportCapitalDTO) {
    setApports((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    onDataChanged?.();
  }

  return (
    <div className="flex flex-col gap-4">
      {peutGerer && (
        <div className="flex justify-end">
          <ApportFormDialog
            scenarioId={scenarioId}
            onCreated={(a) => {
              setApports((prev) => [...prev, a]);
              onDataChanged?.();
            }}
          />
        </div>
      )}

      {apports.length === 0 ? (
        <EmptyState
          icon={<PiggyBank className="h-8 w-8" />}
          title={t("apportsTab.emptyTitle")}
          description={t("apportsTab.emptyDescription")}
        />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {apports.map((a) => {
              const isInactif = a.actif === false;
              return (
                <div
                  key={a.id}
                  className={`rounded-xl border border-border bg-card p-4 ${isInactif ? "opacity-50" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`font-semibold truncate ${isInactif ? "line-through" : ""}`}>
                          {a.libelle}
                        </p>
                        {isInactif && (
                          <Badge variant="secondary" className="shrink-0 text-xs">
                            {t("apportsTab.inactifBadge")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(a.date).toLocaleDateString("fr-FR")}
                      </p>
                      <Badge
                        variant={a.type === TypeApportCapital.CREDIT ? "warning" : "success"}
                        className="mt-1"
                      >
                        {a.type === TypeApportCapital.CREDIT
                          ? t("apportsTab.types.CREDIT")
                          : t("apportsTab.types.CAPITAL")}
                      </Badge>
                      {isInactif && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("apportsTab.inactifHint")}
                        </p>
                      )}
                    </div>
                    <p className={`font-semibold whitespace-nowrap ${isInactif ? "line-through" : ""}`}>
                      {formatMontantPrevision(a.montantFCFA)}
                    </p>
                  </div>
                  {peutGerer && (
                    <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={a.actif !== false}
                          onCheckedChange={(checked) => handleToggleActif(a.id, checked)}
                          disabled={toggling === a.id}
                          aria-label={isInactif ? t("apportsTab.reactiver") : t("apportsTab.desactiver")}
                        />
                        <span className="text-xs text-muted-foreground">
                          {isInactif ? t("apportsTab.reactiver") : t("apportsTab.desactiver")}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <ApportFormDialog
                          scenarioId={scenarioId}
                          editApport={a}
                          onCreated={handleUpdated}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(a.id)}
                          disabled={deleting === a.id}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-muted p-3">
            <span className="text-sm font-medium text-muted-foreground">{t("apportsTab.total")}</span>
            <span className="font-semibold">{formatMontantPrevision(totalActif)}</span>
          </div>
        </>
      )}
    </div>
  );
}
