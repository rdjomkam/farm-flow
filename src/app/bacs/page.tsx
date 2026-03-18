import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { BacsListClient } from "@/components/bacs/bacs-list-client";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getBacs } from "@/lib/queries/bacs";
import { Permission } from "@/types";

export default async function BacsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.BACS_GERER);
  if (!permissions) return <AccessDenied />;

  const bacs = await getBacs(session.activeSiteId);

  return (
    <>
      <Header title="Bacs" />
      <BacsListClient bacs={bacs} permissions={permissions} />
    </>
  );
}
