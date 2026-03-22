import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { BacsListClient } from "@/components/bacs/bacs-list-client";
import { AccessDenied } from "@/components/ui/access-denied";
import { QuotasUsageBar } from "@/components/subscription/quotas-usage-bar";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getBacs } from "@/lib/queries/bacs";
import { Permission } from "@/types";

export default async function BacsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const [permissions, bacs] = await Promise.all([
    checkPagePermission(session, Permission.BACS_GERER),
    getBacs(session.activeSiteId),
  ]);
  if (!permissions) return <AccessDenied />;

  return (
    <>
      <Header title="Bacs" />
      <div className="px-4 pt-4">
        <QuotasUsageBar siteId={session.activeSiteId} />
      </div>
      <BacsListClient bacs={bacs} permissions={permissions} />
    </>
  );
}
