import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getDepenses } from "@/lib/queries/depenses";
import { getDepensesRecurrentes } from "@/lib/queries/depenses-recurrentes";
import { Permission } from "@/types";
import { DepensesListClient } from "@/components/depenses/depenses-list-client";

export default async function DepensesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  try {
    const permissions = await checkPagePermission(
      session,
      Permission.DEPENSES_VOIR
    );
    if (!permissions) return <AccessDenied />;

    const [depenses, templatesActifs] = await Promise.all([
      getDepenses(session.activeSiteId),
      getDepensesRecurrentes(session.activeSiteId, true),
    ]);

    const canManage = permissions.includes(Permission.DEPENSES_CREER);
    const canPay = permissions.includes(Permission.DEPENSES_PAYER);

    return (
      <>
        <Header title="Depenses" />
        <DepensesListClient
          depenses={JSON.parse(JSON.stringify(depenses))}
          canManage={canManage}
          canPay={canPay}
          templatesActifsCount={templatesActifs.length}
        />
      </>
    );
  } catch (error: unknown) {
    const digest = error instanceof Error && "digest" in error ? (error as Record<string, unknown>).digest : undefined;
    if (typeof digest === "string" && /^[A-Z_]/.test(digest)) throw error;
    console.error("[DepensesPage]", error);
    throw error;
  }
}
