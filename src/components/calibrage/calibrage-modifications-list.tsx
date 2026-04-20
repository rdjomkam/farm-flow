"use client";

import { useTranslations, useLocale } from "next-intl";
import { Pencil } from "lucide-react";
import type { CalibrageModificationWithUser } from "@/types";

interface CalibrageModificationsListProps {
  modifications: CalibrageModificationWithUser[];
}

export function CalibrageModificationsList({
  modifications,
}: CalibrageModificationsListProps) {
  const t = useTranslations("calibrage");
  const tDates = useTranslations("format.dates");
  const locale = useLocale();

  function formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatRelativeDate(date: Date | string): string {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 1) return tDates("justNow");
    if (diffMinutes < 60) return tDates("minutesAgo", { count: diffMinutes });
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return tDates("hoursAgo", { count: diffHours });
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return tDates("yesterday");
    if (diffDays < 7) return tDates("daysAgo", { count: diffDays });
    return formatDate(date);
  }

  function formatGroupesValue(jsonStr: string | null): string {
    if (!jsonStr) return "—";
    try {
      const parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed)) return jsonStr;
      return parsed
        .map((g: { categorie?: string; nombrePoissons?: number; poidsMoyen?: number }) =>
          t("modifications.groupeSummary", {
            categorie: g.categorie ?? "?",
            poissons: String(g.nombrePoissons ?? "?"),
            poids: String(g.poidsMoyen ?? "?"),
          })
        )
        .join(" | ");
    } catch {
      return jsonStr;
    }
  }

  function renderValue(champModifie: string, value: string | null): string {
    if (value === null) return "—";
    if (champModifie === "groupes") return formatGroupesValue(value);
    return value;
  }

  if (modifications.length === 0) return null;

  const groupes = modifications.reduce<{
    raison: string;
    user: { id: string; name: string };
    createdAt: Date | string;
    champs: CalibrageModificationWithUser[];
  }[]>(
    (acc, mod) => {
      const last = acc[acc.length - 1];
      if (
        last &&
        last.raison === mod.raison &&
        last.user.id === mod.user.id &&
        Math.abs(
          new Date(last.createdAt).getTime() - new Date(mod.createdAt).getTime()
        ) < 5000
      ) {
        last.champs.push(mod);
      } else {
        acc.push({
          raison: mod.raison,
          user: mod.user,
          createdAt: mod.createdAt,
          champs: [mod],
        });
      }
      return acc;
    },
    []
  );

  return (
    <section className="p-2">
      <div className="flex items-center gap-2 mb-3">
        <Pencil className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{t("modifications.title")}</h3>
      </div>
      <div className="flex flex-col gap-3">
        {groupes.map((groupe, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-border bg-background p-3 text-sm"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-medium text-foreground">{groupe.user.name}</span>
              <span
                className="text-xs text-muted-foreground"
                title={formatDate(groupe.createdAt)}
              >
                {formatRelativeDate(groupe.createdAt)}
              </span>
            </div>

            <p className="text-xs text-muted-foreground italic mb-2">
              {t("modifications.reason")} : &ldquo;{groupe.raison}&rdquo;
            </p>

            <div className="flex flex-col gap-2">
              {groupe.champs.map((champ) => (
                <div key={champ.id} className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium text-foreground">
                    {t(`modifications.fields.${champ.champModifie}` as Parameters<typeof t>[0]) ?? champ.champModifie}
                  </span>
                  {champ.champModifie === "groupes" ? (
                    <div className="flex flex-col gap-1">
                      <div className="rounded bg-danger/10 px-2 py-1 text-xs text-danger/80">
                        <span className="font-medium">{t("modifications.before")}</span>{" "}
                        {renderValue(champ.champModifie, champ.ancienneValeur)}
                      </div>
                      <div className="rounded bg-success/10 px-2 py-1 text-xs text-success">
                        <span className="font-medium">{t("modifications.after")}</span>{" "}
                        {renderValue(champ.champModifie, champ.nouvelleValeur)}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-danger/80 line-through">
                        {champ.ancienneValeur ?? "—"}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-success font-medium">
                        {champ.nouvelleValeur ?? "—"}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
