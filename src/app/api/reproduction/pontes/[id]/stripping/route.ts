import { NextRequest, NextResponse } from "next/server";
import { updateStripping } from "@/lib/queries/pontes";
import { apiError, handleApiError } from "@/lib/api-utils";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import type { StrippingStepDTO } from "@/types";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/reproduction/pontes/[id]/stripping
 * Etape 2 : enregistrement des resultats du stripping.
 *
 * Body : StrippingStepDTO
 * Permission : PONTES_GERER
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.PONTES_GERER);
    const { id } = await params;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return apiError(400, "Corps de la requete invalide.");
    }

    // Validation : heureStripping est obligatoire
    if (!body.heureStripping || typeof body.heureStripping !== "string") {
      return apiError(400, "Erreurs de validation.", {
        errors: [
          {
            field: "heureStripping",
            message: "L'heure de stripping est obligatoire (format ISO datetime).",
          },
        ],
      });
    }

    // Validation : heureStripping doit etre une date valide
    const heureStripping = new Date(body.heureStripping);
    if (isNaN(heureStripping.getTime())) {
      return apiError(400, "Erreurs de validation.", {
        errors: [
          {
            field: "heureStripping",
            message: "L'heure de stripping doit etre une date ISO valide.",
          },
        ],
      });
    }

    // Validation : poidsOeufsPontesG optionnel > 0
    if (body.poidsOeufsPontesG !== undefined && body.poidsOeufsPontesG !== null) {
      if (typeof body.poidsOeufsPontesG !== "number" || body.poidsOeufsPontesG <= 0) {
        return apiError(400, "Erreurs de validation.", {
          errors: [
            {
              field: "poidsOeufsPontesG",
              message: "Le poids des oeufs doit etre un nombre superieur a 0.",
            },
          ],
        });
      }
    }

    // Validation : nombreOeufsEstime optionnel > 0
    if (body.nombreOeufsEstime !== undefined && body.nombreOeufsEstime !== null) {
      if (
        !Number.isInteger(body.nombreOeufsEstime) ||
        (body.nombreOeufsEstime as number) <= 0
      ) {
        return apiError(400, "Erreurs de validation.", {
          errors: [
            {
              field: "nombreOeufsEstime",
              message: "Le nombre d'oeufs estime doit etre un entier superieur a 0.",
            },
          ],
        });
      }
    }

    const dto: StrippingStepDTO = {
      heureStripping: body.heureStripping as string,
      ...(body.poidsOeufsPontesG !== undefined && {
        poidsOeufsPontesG: body.poidsOeufsPontesG as number,
      }),
      ...(body.nombreOeufsEstime !== undefined && {
        nombreOeufsEstime: body.nombreOeufsEstime as number,
      }),
      ...(body.qualiteOeufs !== undefined && {
        qualiteOeufs: body.qualiteOeufs as StrippingStepDTO["qualiteOeufs"],
      }),
      ...(body.methodeMale !== undefined && {
        methodeMale: body.methodeMale as StrippingStepDTO["methodeMale"],
      }),
      ...(body.motiliteSperme !== undefined && {
        motiliteSperme: body.motiliteSperme as StrippingStepDTO["motiliteSperme"],
      }),
      ...(body.notes !== undefined && { notes: body.notes as string }),
    };

    const ponte = await updateStripping(id, auth.activeSiteId, dto);

    return NextResponse.json(ponte);
  } catch (error) {
    return handleApiError(
      "PATCH /api/reproduction/pontes/[id]/stripping",
      error,
      "Erreur serveur lors de la mise a jour du stripping."
    );
  }
}
