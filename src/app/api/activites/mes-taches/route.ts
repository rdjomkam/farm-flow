import { NextRequest, NextResponse } from "next/server";
import { getMyTasks } from "@/lib/queries";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { apiError, handleApiError } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.PLANNING_VOIR);

    const tasks = await getMyTasks(auth.activeSiteId, auth.userId);

    return NextResponse.json({ activites: tasks, total: tasks.length });
  } catch (error) {
    return handleApiError("GET /api/activites/mes-taches", error, "Erreur serveur.");
  }
}
