"use client";

/**
 * src/components/previsions/journal-tab.tsx
 *
 * Onglet Journal — JournalDepensePrevue : creation, edition, suppression.
 * Cartes empilees mobile-first.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { NotebookPen, Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Permission, CategorieJournalPrevu } from "@/types";
import { usePrevisionsApi } from "@/hooks/use-previsions-api";
import { JournalFormDialog } from "@/components/previsions/journal-form-dialog";
import { formatMontantPrevision, classeMontant } from "@/lib/previsions/format-previsions";
import type { JournalDepensePrevueDTO, VaguePrevueListItemDTO } from "@/components/previsions/api-types";

interface JournalTabProps {
  scenarioId: string;
  initialJournal: JournalDepensePrevueDTO[];
  vaguesPrevues: VaguePrevueListItemDTO[];
  permissions: Permission[];
  /** Cf. `parametres-tab.tsx` — declenche le refresh de la projection. */
  onDataChanged?: () => void;
}

export function JournalTab({
  scenarioId,
  initialJournal,
  vaguesPrevues,
  permissions,
  onDataChanged,
}: JournalTabProps) {
  const t = useTranslations("previsions");
  const { del } = usePrevisionsApi();
  const [journal, setJournal] = useState(initialJournal);
  const peutGerer = permissions.includes(Permission.PREVISIONS_GERER);

  async function handleDelete(id: string) {
    const result = await del(`/api/previsions/journal/${id}`);
    if (result.ok) {
      setJournal((prev) => prev.filter((j) => j.id !== id));
      onDataChanged?.();
    }
  }

  const codeParVague = new Map(vaguesPrevues.map((v) => [v.id, v.code]));

  return (
    <div className="flex flex-col gap-4">
      {peutGerer && (
        <div className="flex justify-end">
          <JournalFormDialog
            scenarioId={scenarioId}
            vaguesPrevues={vaguesPrevues}
            onSaved={(l) => {
              setJournal((prev) => [...prev, l]);
              onDataChanged?.();
            }}
            trigger={
              <Button className="w-full md:w-auto">
                <Plus className="h-4 w-4" />
                {t("journalTab.newButton")}
              </Button>
            }
          />
        </div>
      )}

      {journal.length === 0 ? (
        <EmptyState
          icon={<NotebookPen className="h-8 w-8" />}
          title={t("journalTab.emptyTitle")}
          description={t("journalTab.emptyDescription")}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {journal.map((j) => (
            <div key={j.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{j.libelle}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(j.date).toLocaleDateString("fr-FR")}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant={j.categorie === CategorieJournalPrevu.INVESTISSEMENT ? "warning" : "info"}>
                      {j.categorie === CategorieJournalPrevu.INVESTISSEMENT
                        ? t("journalTab.categories.INVESTISSEMENT")
                        : t("journalTab.categories.OPERATIONNEL")}
                    </Badge>
                    {j.vaguePrevueId ? (
                      <span className="text-xs text-muted-foreground">
                        {t("journalTab.assignedTo", { code: codeParVague.get(j.vaguePrevueId) ?? j.vaguePrevueId })}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{t("journalTab.general")}</span>
                    )}
                  </div>
                </div>
                <p className={`font-semibold whitespace-nowrap ${classeMontant(j.montantFCFA) ?? ""}`}>
                  {formatMontantPrevision(j.montantFCFA)}
                </p>
              </div>

              {peutGerer && (
                <div className="mt-3 flex gap-2">
                  <JournalFormDialog
                    scenarioId={scenarioId}
                    vaguesPrevues={vaguesPrevues}
                    existant={j}
                    onSaved={(updated) => {
                      setJournal((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
                      onDataChanged?.();
                    }}
                    trigger={
                      <Button variant="outline" size="sm">
                        <Pencil className="h-4 w-4" />
                        {t("journalTab.editButton")}
                      </Button>
                    }
                  />
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(j.id)}>
                    <Trash2 className="h-4 w-4" />
                    {t("journalTab.deleteButton")}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
