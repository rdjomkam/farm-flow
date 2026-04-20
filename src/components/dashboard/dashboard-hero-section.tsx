import { Waves } from "lucide-react";
import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { VagueSummaryCard } from "@/components/dashboard/vague-summary-card";
import type { DashboardData } from "@/types";

interface DashboardHeroSectionProps {
  data: DashboardData;
  sessionName: string;
}

export async function DashboardHeroSection({ data, sessionName }: DashboardHeroSectionProps) {
  const t = await getTranslations("dashboard");
  const locale = await getLocale();

  return (
    <>
      {/* Hero greeting */}
      <section
        className="relative overflow-hidden rounded-2xl p-4 sm:p-6"
        style={{ background: "var(--primary-gradient)" }}
      >
        <div className="relative z-10 text-white">
          <p className="text-sm font-medium text-white/70">
            {new Date().toLocaleDateString(locale, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <h1 className="text-xl font-bold mt-1">{t("hero.greeting", { sessionName })}</h1>
          <p className="text-sm text-white/80 mt-1">
            {data.vaguesActives > 1
              ? t("hero.wavesCountPlural", { count: data.vaguesActives })
              : t("hero.wavesCount", { count: data.vaguesActives })}
            {data.biomasseTotale ? ` \u00b7 ${t("hero.biomasse", { value: data.biomasseTotale })}` : ""}
          </p>
        </div>
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 hidden sm:block" />
        <div className="absolute -right-4 bottom-0 h-20 w-20 rounded-full bg-white/5 hidden sm:block" />
      </section>

      <StatsCards data={data} />

      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          {t("hero.sectionTitle")}
        </h2>
        {data.vagues.length === 0 ? (
          <EmptyState
            icon={<Waves className="h-7 w-7" />}
            title={t("hero.emptyTitle")}
            description={t("hero.emptyDescription")}
            action={
              <Link href="/vagues">
                <Button size="sm">{t("hero.createWave")}</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {data.vagues.map((vague, index) => (
              <VagueSummaryCard key={vague.id} vague={vague} index={index} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
