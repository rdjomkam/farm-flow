/**
 * FeatureFlagsList — liste tous les feature flags avec leur toggle.
 *
 * Server Component — lit les flags depuis la DB directement.
 * Delègue le rendu interactif a FeatureFlagToggle (client component).
 *
 * ADR-maintenance-mode
 */

import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/db";
import { FeatureFlagToggle } from "./feature-flag-toggle";

export async function FeatureFlagsList() {
  const t = await getTranslations("backoffice.featureFlags");

  const flags = await prisma.featureFlag.findMany({
    include: {
      updatedByUser: { select: { id: true, name: true } },
    },
    orderBy: { key: "asc" },
  });

  if (flags.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("noFlags")}</p>
    );
  }

  return (
    <div className="space-y-4">
      {flags.map((flag) => {
        const value = (flag.value as Record<string, unknown> | null) ?? null;
        return (
          <FeatureFlagToggle
            key={flag.key}
            flagKey={flag.key}
            enabled={flag.enabled}
            label={t(`flags.${flag.key}.label` as `flags.MAINTENANCE_MODE.label`)}
            description={t(`flags.${flag.key}.description` as `flags.MAINTENANCE_MODE.description`)}
            value={value}
            updatedAt={flag.updatedAt.toISOString()}
            updatedByName={flag.updatedByUser?.name ?? null}
          />
        );
      })}
    </div>
  );
}
