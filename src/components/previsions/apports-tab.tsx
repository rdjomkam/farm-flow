"use client";

/**
 * src/components/previsions/apports-tab.tsx
 *
 * Onglet Apports en capital — ApportCapital : creation et liste uniquement
 * (aucune route API d'edition/suppression, cf. `apport-form-dialog.tsx`).
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { PiggyBank } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Permission, TypeApportCapital } from "@/types";
import { ApportFormDialog } from "@/components/previsions/apport-form-dialog";
import { formatMontantPrevision } from "@/lib/previsions/format-previsions";
import type { ApportCapitalDTO } from "@/components/previsions/api-types";

interface ApportsTabProps {
  scenarioId: string;
  initialApports: ApportCapitalDTO[];
  permissions: Permission[];
  /** Cf. `parametres-tab.tsx` — declenche le refresh de la projection. */
  onDataChanged?: () => void;
}

export function ApportsTab({ scenarioId, initialApports, permissions, onDataChanged }: ApportsTabProps) {
  const t = useTranslations("previsions");
  const [apports, setApports] = useState(initialApports);
  const peutGerer = permissions.includes(Permission.PREVISIONS_GERER);

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
        <div className="flex flex-col gap-3">
          {apports.map((a) => (
            <div key={a.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{a.libelle}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(a.date).toLocaleDateString("fr-FR")}
                  </p>
                  <Badge variant={a.type === TypeApportCapital.CREDIT ? "warning" : "success"} className="mt-1">
                    {a.type === TypeApportCapital.CREDIT
                      ? t("apportsTab.types.CREDIT")
                      : t("apportsTab.types.CAPITAL")}
                  </Badge>
                </div>
                <p className="font-semibold whitespace-nowrap">{formatMontantPrevision(a.montantFCFA)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
