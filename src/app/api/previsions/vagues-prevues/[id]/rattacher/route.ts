import { NextRequest, NextResponse } from "next/server";
import { rattacherVaguePrevue } from "@/lib/queries/previsions-vagues";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { handleApiError } from "@/lib/api-utils";
import { rattacherVaguePrevueSchema } from "@/lib/validation/previsions.schema";
import { parseBody } from "@/app/api/previsions/_shared";

/**
 * POST /api/previsions/vagues-prevues/[id]/rattacher — rattache une vague
 * reelle (`Vague.vaguePrevueId`) a une VaguePrevue.
 *
 * Permission : PREVISIONS_GERER SEULE (decision explicite du sprint, pas
 * combinee a une permission "vagues reelles" comme le suggerait la
 * pre-analyse PR2.2 section 2 — le PM tranche ici : PREVISIONS_GERER
 * suffit). A NOTER EXPLICITEMENT (comme demande) : cette route ECRIT sur
 * `Vague.vaguePrevueId`, un champ du domaine REEL (`vagues.ts`), pas
 * seulement sur une table `*Prevue` du module Previsions — un utilisateur
 * disposant de PREVISIONS_GERER peut donc, via cette seule route, modifier
 * une Vague reelle existante sans disposer d'aucune permission VAGUES_*. Ce
 * couplage est assume par la decision du sprint, pas un oubli.
 *
 * ADR-053 decision 2 — flux de scission obligatoire : `Vague.vaguePrevueId`
 * est `@unique`. Rattacher une DEUXIEME vague reelle a la meme VaguePrevue
 * echoue en P2002 generique cote Prisma. Le traitement generique de
 * `handleApiError` (409 indistinct, message "Cette valeur existe deja
 * (vaguePrevueId).") ne suffit PAS : l'UI de PR2.3 doit pouvoir distinguer
 * CE cas precis (P2002 sur `vaguePrevueId` specifiquement) de tout autre
 * conflit P2002 du module, pour proposer le flux de scission (V7 -> V7a +
 * V7b). Reprend le precedent `QUOTA_DEPASSE` (`code` machine dans le corps
 * JSON, `src/app/api/vagues/route.ts`) et `ConservationError` (corps enrichi) :
 * ce catch DEDIE intercepte specifiquement ce P2002 AVANT qu'il n'atteigne
 * le traitement generique de `handleApiError`, et renvoie
 * `{ status: 409, message, code: "VAGUE_PREVUE_DEJA_RATTACHEE", vaguePrevueId }`.
 * Tout autre P2002 de cette route (cas non attendu ici, mais defense en
 * profondeur) retombe sur le traitement generique via `handleApiError`.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: vaguePrevueId } = await params;
  try {
    const auth = await requirePermission(request, Permission.PREVISIONS_GERER);
    const body = await request.json();

    const parsed = parseBody(rattacherVaguePrevueSchema, body);
    if (parsed.error) return parsed.error;

    const vague = await rattacherVaguePrevue(parsed.data.vagueId, vaguePrevueId, auth.activeSiteId);
    return NextResponse.json(vague);
  } catch (error) {
    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: unknown }).code === "P2002"
    ) {
      const target = (error as { meta?: { target?: string[] } }).meta?.target;
      const fields = target?.length ? target.join(", ") : "";
      if (/vaguePrevueId/i.test(fields)) {
        return NextResponse.json(
          {
            status: 409,
            message:
              "Cette VaguePrevue a deja une vague reelle rattachee. Proposez une scission (V7 -> V7a + V7b) pour rattacher un second lot.",
            code: "VAGUE_PREVUE_DEJA_RATTACHEE",
            vaguePrevueId,
          },
          { status: 409 }
        );
      }
    }
    return handleApiError(
      "POST /api/previsions/vagues-prevues/[id]/rattacher",
      error,
      "Erreur serveur lors du rattachement de la vague."
    );
  }
}
