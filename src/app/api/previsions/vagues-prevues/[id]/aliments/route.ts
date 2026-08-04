import { NextRequest, NextResponse } from "next/server";
import { replaceAlimentsParVaguePrevue } from "@/lib/queries/previsions-vagues";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";
import { replaceAlimentsParVaguePrevueSchema } from "@/lib/validation/previsions.schema";
import { parseBody, PREVISIONS_STATUS_MAP } from "@/app/api/previsions/_shared";

/**
 * PUT /api/previsions/vagues-prevues/[id]/aliments — remplace en bloc les
 * AlimentParVaguePrevue (besoin aliment par granulometrie x mois de cycle)
 * d'une VaguePrevue. PREVISIONS_GERER (saisie/persistance du besoin par
 * vague, cf. ADR-053 section 6 : "surcharges sacsSaisis").
 *
 * Distincte de `GET /scenarios/[id]/calculer` (route de calcul, PURE LECTURE,
 * ne persiste rien) : cette route est le SEUL point d'ecriture de
 * `AlimentParVaguePrevue` — une UI peut appeler la route de calcul pour
 * obtenir `sacsCalcules`/`quantiteKgCalculee`/`coutCalculeFCFA` recalcules,
 * puis, si l'utilisateur choisit de les enregistrer (ou de les ajuster
 * manuellement via `sacsSaisis`), les soumettre ICI pour persistance.
 *
 * `sacsCalcules`/`sacsSaisis` DOIVENT etre des entiers (colonne Prisma
 * `Int` stricte, cf. JSDoc `AlimentParVaguePrevueInputDTO`,
 * `previsions-vagues.ts`, sur l'homonymie avec les types en memoire du
 * moteur) — deja force par le schema zod (`positiveInt`), la garde
 * `assertEntierColonneInt` de la query reste une seconde ligne de defense.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_GERER);
    const { id } = await params;
    const body = await request.json();

    const parsed = parseBody(replaceAlimentsParVaguePrevueSchema, body);
    if (parsed.error) return parsed.error;

    const lignes = await replaceAlimentsParVaguePrevue(id, auth.activeSiteId, parsed.data.lignes);
    return NextResponse.json({ data: lignes });
  } catch (error) {
    return handleApiError(
      "PUT /api/previsions/vagues-prevues/[id]/aliments",
      error,
      "Erreur serveur lors de la mise a jour des aliments de la vague prevue.",
      { statusMap: PREVISIONS_STATUS_MAP }
    );
  }
}
