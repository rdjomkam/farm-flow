import { IndicateursPanel } from "@/components/dashboard/indicateurs-panel";
import { getDashboardIndicateurs } from "@/lib/queries/dashboard";

interface IndicateursSectionProps {
  siteId: string;
}

export async function IndicateursSection({ siteId }: IndicateursSectionProps) {
  const indicateurs = await getDashboardIndicateurs(siteId);

  if (indicateurs.length === 0) return null;

  return <IndicateursPanel indicateurs={indicateurs} />;
}
