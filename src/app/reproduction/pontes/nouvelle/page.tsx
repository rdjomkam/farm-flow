import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { PonteFormClient } from "@/components/reproduction/ponte-form-client";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { listLotGeniteurs } from "@/lib/queries/geniteurs";
import { getReproducteurs } from "@/lib/queries/reproducteurs";
import { SexeReproducteur, StatutReproducteur, Permission } from "@/types";

export default async function NouvellePontePage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.ALEVINS_MODIFIER);
  if (!permissions) return <AccessDenied />;

  const t = await getTranslations("reproduction.pontes.form");

  const [lotsFemellesResult, lotsMalesResult, reproducteursResult] = await Promise.all([
    listLotGeniteurs(session.activeSiteId, {
      sexe: SexeReproducteur.FEMELLE,
      statut: StatutReproducteur.ACTIF,
      limit: 100,
    }),
    listLotGeniteurs(session.activeSiteId, {
      sexe: SexeReproducteur.MALE,
      statut: StatutReproducteur.ACTIF,
      limit: 100,
    }),
    getReproducteurs(session.activeSiteId, {
      statut: StatutReproducteur.ACTIF,
    }),
  ]);

  const femelles = reproducteursResult.data
    .filter((r) => r.sexe === SexeReproducteur.FEMELLE)
    .map((r) => ({ id: r.id, code: r.code }));

  const males = reproducteursResult.data
    .filter((r) => r.sexe === SexeReproducteur.MALE)
    .map((r) => ({ id: r.id, code: r.code }));

  const lotsFemelles = lotsFemellesResult.data.map((l) => ({
    id: l.id,
    code: l.code,
    nom: l.nom,
  }));

  const lotsMales = lotsMalesResult.data.map((l) => ({
    id: l.id,
    code: l.code,
    nom: l.nom,
  }));

  return (
    <>
      <Header title={t("title")} />
      <div className="p-4 pb-24">
        <PonteFormClient
          lotsFemelles={lotsFemelles}
          lotsMales={lotsMales}
          femelles={femelles}
          males={males}
        />
      </div>
    </>
  );
}
