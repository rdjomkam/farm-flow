import { NextRequest, NextResponse } from "next/server";
import { reporterChargeMensuelle } from "@/lib/queries/previsions-charges";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";
import { reporterChargeMensuelleSchema } from "@/lib/validation/previsions.schema";
import { parseBody } from "@/app/api/previsions/_shared";

/**
 * POST /api/previsions/postes/[id]/charges/reporter — reporte un meme
 * montant sur une plage de mois consecutifs pour un poste (Sprint PR2-ter,
 * story PR2ter.1). PREVISIONS_GERER (meme permission que la route unitaire
 * `PUT .../charges` : la saisie/le report d'une charge est un acte de
 * gestion).
 *
 * `POST`, pas `PUT` : ce n'est pas un upsert idempotent adresse par une URL
 * de ressource unique, c'est une operation de commande ("reporter"),
 * cohérent avec `POST .../vagues/generer` deja en place pour une operation
 * en lot comparable.
 *
 * R4 : une seule `prisma.$transaction` cote query (`reporterChargeMensuelle`) —
 * jamais une boucle d'appels a `upsertChargeMensuelle` depuis cette route,
 * ce qui recreerait le risque d'ecriture partielle que cette route existe
 * pour eviter.
 * R8 : `siteId` toujours lu depuis `auth.activeSiteId`, jamais depuis le
 * payload client.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_GERER);
    const { id } = await params;
    const body = await request.json();

    const parsed = parseBody(reporterChargeMensuelleSchema, body);
    if (parsed.error) return parsed.error;

    const lignes = await reporterChargeMensuelle(
      id,
      auth.activeSiteId,
      parsed.data.montantFCFA,
      parsed.data.moisDebutAbsolu,
      parsed.data.moisFinAbsolu
    );
    return NextResponse.json({ data: lignes });
  } catch (error) {
    return handleApiError(
      "POST /api/previsions/postes/[id]/charges/reporter",
      error,
      "Erreur serveur lors du report de la charge mensuelle."
    );
  }
}
