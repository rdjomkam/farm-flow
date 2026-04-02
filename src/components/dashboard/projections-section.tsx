import { Projections } from "@/components/dashboard/projections";
import type { ProjectionVague } from "@/types";
import { Role } from "@/types";

interface ProjectionsSectionProps {
  projections: ProjectionVague[];
  userRole: Role;
}

export function ProjectionsSection({ projections, userRole }: ProjectionsSectionProps) {
  return <Projections projections={projections} userRole={userRole} />;
}
