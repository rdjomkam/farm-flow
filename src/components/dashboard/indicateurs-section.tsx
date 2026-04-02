import { IndicateursPanel } from "@/components/dashboard/indicateurs-panel";
import type { IndicateursBenchmarkVague } from "@/types";

interface IndicateursSectionProps {
  indicateurs: IndicateursBenchmarkVague[];
}

export function IndicateursSection({ indicateurs }: IndicateursSectionProps) {
  if (indicateurs.length === 0) return null;

  return <IndicateursPanel indicateurs={indicateurs} />;
}
