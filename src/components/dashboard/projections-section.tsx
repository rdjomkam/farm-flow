import { Projections } from "@/components/dashboard/projections";
import { getProjectionsDashboard } from "@/lib/queries/dashboard";
import { getServerSession } from "@/lib/auth";
import { Role } from "@/types";

interface ProjectionsSectionProps {
  siteId: string;
}

export async function ProjectionsSection({ siteId }: ProjectionsSectionProps) {
  const [projections, session] = await Promise.all([
    getProjectionsDashboard(siteId),
    getServerSession(),
  ]);

  const userRole: Role = session?.role ?? Role.GERANT;

  return <Projections projections={projections} userRole={userRole} />;
}
