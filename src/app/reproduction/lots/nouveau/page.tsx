import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { LotFormClient } from "@/components/reproduction/lot-form-client";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { listPontes } from "@/lib/queries/pontes";
import { getBacsLibres } from "@/lib/queries/bacs";
import { Permission } from "@/types";

export default async function NouveauLotPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.LOTS_ALEVINS_GERER);
  if (!permissions) return <AccessDenied />;

  const t = await getTranslations("reproduction.lots.form");

  const [pontesResult, bacsLibres] = await Promise.all([
    listPontes(session.activeSiteId, { limit: 100 }),
    getBacsLibres(session.activeSiteId),
  ]);

  const pontes = (pontesResult.data as Array<{ id: string; code: string }>).map((p) => ({
    id: p.id,
    code: p.code,
  }));

  const bacs = (bacsLibres as Array<{ id: string; nom: string }>).map((b) => ({
    id: b.id,
    nom: b.nom,
  }));

  return (
    <>
      <Header title={t("title")} />
      <div className="p-4 pb-24">
        <LotFormClient pontes={pontes} bacs={bacs} />
      </div>
    </>
  );
}
