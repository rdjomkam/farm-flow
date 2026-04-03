import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { PontesListClient } from "@/components/alevins/pontes-list-client";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getPontes } from "@/lib/queries/pontes";
import { getReproducteurs } from "@/lib/queries/reproducteurs";
import { SexeReproducteur, Permission } from "@/types";

export default async function PontesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.ALEVINS_VOIR);
  if (!permissions) return <AccessDenied />;

  const t = await getTranslations("alevins.page");

  const [pontesResult, reproducteursResult] = await Promise.all([
    getPontes(session.activeSiteId),
    getReproducteurs(session.activeSiteId),
  ]);

  const femelles = reproducteursResult.data
    .filter((r) => r.sexe === SexeReproducteur.FEMELLE)
    .map((r) => ({ id: r.id, code: r.code }));

  const males = reproducteursResult.data
    .filter((r) => r.sexe === SexeReproducteur.MALE)
    .map((r) => ({ id: r.id, code: r.code }));

  return (
    <>
      <Header title={t("pontes")} />
      <div className="p-4">
        <PontesListClient
          pontes={JSON.parse(JSON.stringify(pontesResult.data))}
          femelles={femelles}
          males={males}
          permissions={permissions}
        />
      </div>
    </>
  );
}
