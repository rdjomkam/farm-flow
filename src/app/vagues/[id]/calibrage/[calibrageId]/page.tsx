import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Scissors, Fish, AlertTriangle, Calendar, User } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getCalibrageById } from "@/lib/queries/calibrages";
import { prisma } from "@/lib/db";
import { Permission, CategorieCalibrage, StatutVague } from "@/types";
import { ModifierCalibrageDialog } from "@/components/calibrage/modifier-calibrage-dialog";
import { CalibrageModificationsList } from "@/components/calibrage/calibrage-modifications-list";
import type { CalibrageWithRelations, CalibrageModificationWithUser } from "@/types";


const categorieBadgeVariants: Record<
  CategorieCalibrage,
  "default" | "info" | "en_cours" | "terminee" | "warning" | "annulee"
> = {
  [CategorieCalibrage.PETIT]: "default",
  [CategorieCalibrage.MOYEN]: "info",
  [CategorieCalibrage.GROS]: "en_cours",
  [CategorieCalibrage.TRES_GROS]: "terminee",
};

export default async function CalibrageDetailPage({
  params,
}: {
  params: Promise<{ id: string; calibrageId: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(
    session,
    Permission.CALIBRAGES_VOIR
  );
  if (!permissions) return <AccessDenied />;

  const { id, calibrageId } = await params;
  const [calibrage, bacsDb] = await Promise.all([
    getCalibrageById(calibrageId, session.activeSiteId),
    prisma.bac.findMany({
      where: { vagueId: id, siteId: session.activeSiteId },
      select: { id: true, nom: true },
      orderBy: { nom: "asc" },
    }),
  ]);

  if (!calibrage) notFound();

  // Verify the calibrage belongs to the vague in the URL
  if (calibrage.vagueId !== id) notFound();

  const t = await getTranslations("calibrage");

  const totalPoissons = calibrage.groupes.reduce(
    (sum, g) => sum + g.nombrePoissons,
    0
  );

  // Vague statut (needed for "Modifier" button visibility)
  const vague = await prisma.vague.findFirst({
    where: { id, siteId: session.activeSiteId },
    select: { statut: true },
  });
  const isEnCours = vague?.statut === StatutVague.EN_COURS;

  // Modifications (from getCalibrageById include)
  const modifications = (
    (calibrage as unknown as { modifications?: CalibrageModificationWithUser[] }).modifications ?? []
  );

  return (
    <>
      <Header title={t("page.detail")} />
      <div className="p-4 flex flex-col gap-4">
        {/* Navigation : retour + bouton Modifier */}
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/vagues/${id}`}>
              <ArrowLeft className="h-4 w-4" />
              {calibrage.vague.code}
            </Link>
          </Button>
          {isEnCours && (
            <ModifierCalibrageDialog
              calibrage={calibrage as CalibrageWithRelations}
              bacs={bacsDb}
              permissions={permissions}
            />
          )}
        </div>

        {/* En-tete */}
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Scissors className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">{t("detail.title")}</h2>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>
                {new Date(calibrage.date).toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4 shrink-0" />
              <span>{t("detail.byUser", { name: calibrage.user.name })}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Fish className="h-4 w-4 shrink-0" />
              <span>{totalPoissons} poissons redistribues</span>
            </div>
            {calibrage.nombreMorts > 0 && (
              <div className="flex items-center gap-2 text-danger">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  {calibrage.nombreMorts} mort
                  {calibrage.nombreMorts > 1 ? "s" : ""} constates
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Groupes de redistribution */}
        <section>
          <h3 className="text-sm font-semibold mb-3">{t("detail.redistributionGroups")}</h3>
          <div className="flex flex-col gap-2">
            {calibrage.groupes.map((groupe) => (
              <div
                key={groupe.id}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <Badge
                    variant={
                      categorieBadgeVariants[
                        groupe.categorie as CategorieCalibrage
                      ] ?? "default"
                    }
                  >
                    {t(`categories.${groupe.categorie}`) ??
                      groupe.categorie}
                  </Badge>
                  <span className="text-sm font-semibold">
                    {groupe.nombrePoissons} poissons
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{t("detail.destination", { name: groupe.destinationBac.nom })}</span>
                  <span>{t("detail.avgWeight", { weight: groupe.poidsMoyen })}</span>
                  {groupe.tailleMoyenne !== null && (
                    <span>{t("detail.avgSize", { size: groupe.tailleMoyenne })}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Notes */}
        {calibrage.notes && (
          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold mb-2">{t("detail.notes")}</h3>
            <p className="text-sm text-muted-foreground">{calibrage.notes}</p>
          </section>
        )}

        {/* Bilan conservation */}
        <section className="rounded-xl bg-success/5 p-4">
          <h3 className="text-sm font-semibold text-success mb-2">
            Bilan de conservation
          </h3>
          <p className="text-sm text-success">
            {totalPoissons} redistribues + {calibrage.nombreMorts} morts ={" "}
            {totalPoissons + calibrage.nombreMorts} poissons
          </p>
        </section>

        {/* Badge "Modifie" */}
        {(calibrage as unknown as { modifie?: boolean }).modifie && (
          <div className="flex items-center gap-2 rounded-lg bg-warning/5 px-3 py-2 text-sm text-warning">
            <span className="font-medium">{t("detail.modifiedAfterCreation")}</span>
          </div>
        )}

        {/* Historique des modifications */}
        <CalibrageModificationsList modifications={modifications} />
      </div>
    </>
  );
}
