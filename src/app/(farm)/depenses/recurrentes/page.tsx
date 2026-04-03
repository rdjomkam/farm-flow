import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getDepensesRecurrentes } from "@/lib/queries/depenses-recurrentes";
import { Permission } from "@/types";
import { RecurrentesListClient } from "@/components/depenses/recurrentes-list-client";

export default async function DepensesRecurrentesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.DEPENSES_VOIR);
  if (!permissions) return <AccessDenied />;

  const templates = await getDepensesRecurrentes(session.activeSiteId);
  const t = await getTranslations("depenses.page");

  const canManage = permissions.includes(Permission.DEPENSES_CREER);

  return (
    <>
      <Header title={t("recurringExpenses")} />
      <RecurrentesListClient
        templates={JSON.parse(JSON.stringify(templates))}
        canManage={canManage}
      />
    </>
  );
}
