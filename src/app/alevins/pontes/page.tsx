import { redirect } from "next/navigation";
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
  if (!session.activeSiteId) redirect("/sites");

  const permissions = await checkPagePermission(session, Permission.ALEVINS_VOIR);
  if (!permissions) return <AccessDenied />;

  const [pontes, reproducteurs] = await Promise.all([
    getPontes(session.activeSiteId),
    getReproducteurs(session.activeSiteId),
  ]);

  const femelles = reproducteurs
    .filter((r) => r.sexe === SexeReproducteur.FEMELLE)
    .map((r) => ({ id: r.id, code: r.code }));

  const males = reproducteurs
    .filter((r) => r.sexe === SexeReproducteur.MALE)
    .map((r) => ({ id: r.id, code: r.code }));

  return (
    <>
      <Header title="Pontes" />
      <div className="p-4">
        <PontesListClient
          pontes={JSON.parse(JSON.stringify(pontes))}
          femelles={femelles}
          males={males}
          permissions={permissions}
        />
      </div>
    </>
  );
}
