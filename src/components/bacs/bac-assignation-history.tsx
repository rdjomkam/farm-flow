import Link from "next/link";
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
export function BacAssignationHistory({ assignations }: BacAssignationHistoryProps) {
  if (assignations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Aucune assignation enregistrée pour ce bac.
      </p>
    );
  }

  const now = new Date();

  return (
    <div className="flex flex-col gap-3">
      {assignations.map((a) => {
        const active = a.dateFin === null;
        const duree = calculerDureeAssignation(a.dateAssignation, a.dateFin, now);

        const dateDebut = a.dateAssignation.toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
        const dateFin = a.dateFin
          ? a.dateFin.toLocaleDateString("fr-FR", {
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
                    {dateFin ? ` → ${dateFin}` : " → en cours"}
                    <span className="ml-2 text-xs">({duree} j)</span>
                  </p>

                  {/* Effectifs initial → actuel */}
                  {(a.nombrePoissonsInitial != null || a.nombrePoissons != null) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {a.nombrePoissonsInitial != null ? (
                        <>
                          <span className="font-medium">{a.nombrePoissonsInitial}</span> poissons au départ
                          {a.nombrePoissons != null && a.nombrePoissons !== a.nombrePoissonsInitial && (
                            <> → <span className="font-medium">{a.nombrePoissons}</span> à la fin</>
                          )}
                        </>
                      ) : (
                        <>
                          {a.nombrePoissons != null && (
                            <><span className="font-medium">{a.nombrePoissons}</span> poissons</>
                          )}
                        </>
                      )}
                    </p>
                  )}
                </div>

                {/* Badge statut assignation */}
                <div className="shrink-0">
                  {active ? (
                    <Badge variant="success">Active</Badge>
                  ) : (
                    <Badge variant="default">Terminée</Badge>
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
