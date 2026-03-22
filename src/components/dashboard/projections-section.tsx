import { Projections } from "@/components/dashboard/projections";
import { getProjectionsDashboard } from "@/lib/queries/dashboard";

interface ProjectionsSectionProps {
  siteId: string;
}

export async function ProjectionsSection({ siteId }: ProjectionsSectionProps) {
  const projections = await getProjectionsDashboard(siteId);

  return <Projections projections={projections} />;
}
