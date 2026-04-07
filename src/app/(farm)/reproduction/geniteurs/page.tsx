import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { AccessDenied } from "@/components/ui/access-denied";
import { GeniteursListClient } from "@/components/reproduction/geniteurs-list-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { listLotGeniteurs, listReproducteurs } from "@/lib/queries/geniteurs";
import { getBacs } from "@/lib/queries/bacs";
import { Permission } from "@/types";

export default async function GeniteursPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.ALEVINS_VOIR);
  if (!permissions) return <AccessDenied />;

  const t = await getTranslations("reproduction.geniteurs");

  const [lotsResult, reproducteursResult, bacsResult] = await Promise.all([
    listLotGeniteurs(session.activeSiteId, { limit: 200, offset: 0 }),
    listReproducteurs(session.activeSiteId, { limit: 200, offset: 0 }),
    getBacs(session.activeSiteId),
  ]);

  const bacsSimple = bacsResult.data.map((b) => ({ id: b.id, nom: b.nom }));

  return (
    <>
      <Header title={t("title")} />
      <div className="p-4">
        <GeniteursListClient
          lotGeniteurs={JSON.parse(JSON.stringify(lotsResult.data))}
          reproducteursIndividuels={JSON.parse(JSON.stringify(reproducteursResult.data))}
          permissions={permissions}
          bacs={bacsSimple}
        />
      </div>
    </>
  );
}
