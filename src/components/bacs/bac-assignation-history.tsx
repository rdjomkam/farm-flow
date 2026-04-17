import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { calculerDureeAssignation } from "@/lib/calculs";
import type { AssignationBacWithVague } from "@/types";

interface BacAssignationHistoryProps {
  assignations: AssignationBacWithVague[];
}

/**
 * BacAssignationHistory — Server Component.
 *
 * Affiche l'historique des assignations d'un bac à des vagues.
 * ADR-043 — Phase 2 Feature 1.
 */
export async function BacAssignationHistory({ assignations }: BacAssignationHistoryProps) {
  const t = await getTranslations("bacs.assignationHistory");
  const locale = await getLocale();

  if (assignations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        {t("empty")}
      </p>
    );
  }

  const now = new Date();

  return (
    <div className="flex flex-col gap-3">
      {assignations.map((a) => {
        const active = a.dateFin === null;
        const duree = calculerDureeAssignation(a.dateAssignation, a.dateFin, now);

        const dateDebut = a.dateAssignation.toLocaleDateString(locale, {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
        const dateFin = a.dateFin
          ? a.dateFin.toLocaleDateString(locale, {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : null;

        return (
          <Card
            key={a.id}
            className={active ? "border-border" : "border-border border-dashed opacity-70"}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {/* Lien vers la vague */}
                  <Link
                    href={`/vagues/${a.vagueId}`}
                    className="font-medium text-primary hover:underline truncate block"
                  >
                    {a.vague?.code ?? a.vagueId}
                  </Link>

                  {/* Plage de dates + durée */}
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {dateDebut}
                    {dateFin ? ` → ${dateFin}` : ` → ${t("enCours")}`}
                    <span className="ml-2 text-xs">({t("dureeJours", { count: duree })})</span>
                  </p>

                  {/* Effectifs initial → actuel */}
                  {(a.nombrePoissonsInitial != null || a.nombrePoissons != null) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {a.nombrePoissonsInitial != null ? (
                        <>
                          {t("poissonsDepart", { count: a.nombrePoissonsInitial })}
                          {a.nombrePoissons != null && a.nombrePoissons !== a.nombrePoissonsInitial && (
                            <> {t("arrow")} <span className="font-medium">{a.nombrePoissons}</span> {t("aLaFin")}</>
                          )}
                        </>
                      ) : (
                        <>
                          {a.nombrePoissons != null && (
                            <>{t("poissons", { count: a.nombrePoissons })}</>
                          )}
                        </>
                      )}
                    </p>
                  )}
                </div>

                {/* Badge statut assignation */}
                <div className="shrink-0">
                  {active ? (
                    <Badge variant="success">{t("active")}</Badge>
                  ) : (
                    <Badge variant="default">{t("terminee")}</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
