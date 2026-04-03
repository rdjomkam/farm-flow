import { redirect } from "next/navigation";
import Link from "next/link";
import { Zap, ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/access-denied";
import { Permission } from "@/types";
import { RegleFormClient } from "@/components/regles-activites/regle-form-client";

export default async function NouvelleRegleActivitePage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(
    session,
    Permission.GERER_REGLES_ACTIVITES
  );
  if (!permissions) return <AccessDenied />;

  const t = await getTranslations("settings.page");

  return (
    <>
      <Header title={t("newActivityRule")}>
        <Zap className="h-5 w-5 text-muted-foreground" />
      </Header>
      <div className="p-4">
        <Link
          href="/settings/regles-activites"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("activityRules")}
        </Link>
        <RegleFormClient />
      </div>
    </>
  );
}
