import { RecentActivity } from "@/components/dashboard/recent-activity";
import { getRecentActivity } from "@/lib/queries/dashboard";

interface RecentActivitySectionProps {
  siteId: string;
}

export async function RecentActivitySection({ siteId }: RecentActivitySectionProps) {
  const recentReleves = await getRecentActivity(siteId);

  return <RecentActivity releves={recentReleves} />;
}
