import { RecentActivity } from "@/components/dashboard/recent-activity";

interface RecentReleve {
  id: string;
  typeReleve: string;
  date: Date;
  createdAt: Date;
  vague: { code: string } | null;
  bac: { nom: string } | null;
}

interface RecentActivitySectionProps {
  releves: RecentReleve[];
}

export function RecentActivitySection({ releves }: RecentActivitySectionProps) {
  return <RecentActivity releves={releves} />;
}
